import type { DownloadProgress, Rendition } from '@/lib/types';
import { fetchMediaPlaylist } from './playlist';
import { fetchBytes } from './segments';
import { sniffContainer } from './container';
import { Fmp4Muxer, TsMuxer, type Muxer } from './muxer';
import type { FileSink } from './sink';

export interface DownloadOptions {
  rendition: Rendition;
  sink: FileSink;
  signal: AbortSignal;
  onProgress: (progress: DownloadProgress) => void;
  /** Polled between segments; while true the loop parks without buffering more. */
  isPaused?: () => boolean;
  /** Concurrent segment fetches (default 5). */
  concurrency?: number;
}

const SPEED_WINDOW_MS = 3000;

function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Constant-memory HLS -> MP4 download.
 *
 * Segments are fetched with bounded concurrency into a small ordered window,
 * transmuxed one at a time (single reused muxer), and each output chunk is
 * awaited to disk before the next — so peak memory is O(concurrency x segment)
 * regardless of total length. Writes happen strictly in playlist order.
 */
export async function runDownload(opts: DownloadOptions): Promise<void> {
  const { rendition, sink, signal, onProgress } = opts;
  const concurrency = Math.max(1, opts.concurrency ?? 5);

  onProgress(makeProgress('resolving', 0, 0, 0, 0, 0));

  const media = await fetchMediaPlaylist(rendition.uri, signal);
  const total = media.segments.length;
  if (total === 0) throw new Error('Playlist has no segments');

  // Choose the muxer. fMP4 sources are byte-copied; everything else is TS.
  let muxer: Muxer;
  if (media.isFmp4) {
    const first = media.segments[0];
    const init = first.map
      ? await fetchBytes(first.map.uri, first.map.byterange, { signal })
      : undefined;
    muxer = new Fmp4Muxer(init);
  } else {
    muxer = new TsMuxer();
  }

  // Bounded, in-order prefetch window keyed by segment index.
  const window = new Map<number, Promise<Uint8Array>>();
  let fetchIdx = 0;
  const pump = () => {
    while (fetchIdx < total && window.size < concurrency && !signal.aborted) {
      const i = fetchIdx++;
      const seg = media.segments[i];
      window.set(i, fetchBytes(seg.uri, seg.byterange, { signal }));
    }
  };
  pump();

  let bytesDownloaded = 0;
  let bytesWritten = 0;
  // fMP4 is already resolved from the manifest; for the TS assumption we sniff
  // the first segment once to confirm (or switch) the container.
  let sniffed = media.isFmp4;
  const samples: Array<{ t: number; b: number }> = [
    { t: performance.now(), b: 0 },
  ];

  try {
    for (let i = 0; i < total; i++) {
      assertNotAborted(signal);
      while (opts.isPaused?.() && !signal.aborted) await delay(200);
      assertNotAborted(signal);

      const bytes = await window.get(i)!;
      window.delete(i);
      pump();

      // Sanity-check the container assumption on the very first TS segment.
      if (!sniffed) {
        sniffed = true;
        if (sniffContainer(bytes) === 'fmp4') muxer = new Fmp4Muxer();
      }

      bytesDownloaded += bytes.byteLength;
      for (const chunk of muxer.push(bytes)) {
        await sink.write(chunk);
        bytesWritten += chunk.byteLength;
      }

      const done = i + 1;
      const speed = updateSpeed(samples, bytesDownloaded);
      const remainingBytes = (bytesDownloaded / done) * (total - done);
      const etaSeconds = speed > 0 ? remainingBytes / speed : undefined;
      onProgress(
        makeProgress(
          'downloading',
          done,
          total,
          bytesDownloaded,
          bytesWritten,
          speed,
          etaSeconds,
        ),
      );
    }

    onProgress(
      makeProgress(
        'finalizing',
        total,
        total,
        bytesDownloaded,
        bytesWritten,
        0,
      ),
    );
    for (const chunk of muxer.finish()) {
      await sink.write(chunk);
      bytesWritten += chunk.byteLength;
    }
    await sink.close();

    onProgress(
      makeProgress('done', total, total, bytesDownloaded, bytesWritten, 0),
    );
  } finally {
    // Swallow rejections of any still-in-flight fetches so aborting is quiet.
    for (const p of window.values()) p.catch(() => {});
  }
}

function updateSpeed(
  samples: Array<{ t: number; b: number }>,
  bytesDownloaded: number,
): number {
  const now = performance.now();
  samples.push({ t: now, b: bytesDownloaded });
  while (samples.length > 1 && now - samples[0].t > SPEED_WINDOW_MS) {
    samples.shift();
  }
  const dt = (now - samples[0].t) / 1000;
  const db = bytesDownloaded - samples[0].b;
  return dt > 0 ? db / dt : 0;
}

function makeProgress(
  phase: DownloadProgress['phase'],
  segmentsDone: number,
  segmentsTotal: number,
  bytesDownloaded: number,
  bytesWritten: number,
  bytesPerSecond: number,
  etaSeconds?: number,
): DownloadProgress {
  return {
    phase,
    segmentsDone,
    segmentsTotal,
    bytesDownloaded,
    bytesWritten,
    bytesPerSecond,
    etaSeconds,
    fraction: segmentsTotal > 0 ? segmentsDone / segmentsTotal : 0,
  };
}
