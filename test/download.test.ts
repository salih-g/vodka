import { afterEach, describe, expect, test } from 'bun:test';
import { runDownload } from '@/lib/engine/download';
import type { FileSink } from '@/lib/engine/sink';
import type { DownloadProgress, Rendition } from '@/lib/types';

const RENDITION: Rendition = {
  label: 'test',
  bandwidth: 0,
  uri: 'https://test.local/media.m3u8',
};

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function playlist(segments: number): string {
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:7',
    '#EXT-X-TARGETDURATION:4',
    '#EXT-X-MAP:URI="https://test.local/init.mp4"',
  ];
  for (let i = 0; i < segments; i++) {
    lines.push('#EXTINF:4.0,', `https://test.local/seg${i}.m4s`);
  }
  lines.push('#EXT-X-ENDLIST');
  return lines.join('\n');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface MockOptions {
  segments: number;
  delayMs?: number;
  failOnce?: Set<number>;
}

function installMock(opts: MockOptions) {
  const stats = { active: 0, maxActive: 0, attempts: new Map<number, number>() };
  const failed = new Set<number>();

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const signal = init?.signal ?? undefined;
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    if (url.endsWith('.m3u8')) {
      return new Response(playlist(opts.segments), { status: 200 });
    }
    if (url.includes('/init.mp4')) {
      return new Response(new Uint8Array([0xaa]), { status: 200 });
    }

    const m = url.match(/seg(\d+)\.m4s/);
    if (!m) return new Response('not found', { status: 404 });
    const idx = Number(m[1]);
    stats.attempts.set(idx, (stats.attempts.get(idx) ?? 0) + 1);

    stats.active++;
    stats.maxActive = Math.max(stats.maxActive, stats.active);
    try {
      if (opts.delayMs) await sleep(opts.delayMs);
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (opts.failOnce?.has(idx) && !failed.has(idx)) {
        failed.add(idx);
        return new Response('boom', { status: 503 });
      }
      return new Response(new Uint8Array([idx]), { status: 200 });
    } finally {
      stats.active--;
    }
  }) as typeof fetch;

  return stats;
}

function recordingSink() {
  const chunks: number[][] = [];
  let closed = false;
  let aborted = false;
  const sink: FileSink = {
    async write(chunk) {
      chunks.push(Array.from(chunk));
    },
    async close() {
      closed = true;
    },
    async abort() {
      aborted = true;
    },
  };
  return {
    sink,
    get chunks() {
      return chunks;
    },
    get closed() {
      return closed;
    },
    get aborted() {
      return aborted;
    },
  };
}

describe('runDownload', () => {
  test('writes init once then segments in playlist order', async () => {
    installMock({ segments: 6 });
    const out = recordingSink();

    await runDownload({
      rendition: RENDITION,
      sink: out.sink,
      signal: new AbortController().signal,
      onProgress: () => {},
    });

    // init [0xAA] first, then each segment byte in order 0..5
    expect(out.chunks[0]).toEqual([0xaa]);
    const afterInit = out.chunks.slice(1).map((c) => c[0]);
    expect(afterInit).toEqual([0, 1, 2, 3, 4, 5]);
    expect(out.closed).toBe(true);
  });

  test('reports a done progress with correct totals', async () => {
    installMock({ segments: 4 });
    const out = recordingSink();
    const events: DownloadProgress[] = [];

    await runDownload({
      rendition: RENDITION,
      sink: out.sink,
      signal: new AbortController().signal,
      onProgress: (p) => events.push(p),
    });

    const done = events.at(-1)!;
    expect(done.phase).toBe('done');
    expect(done.segmentsDone).toBe(4);
    expect(done.segmentsTotal).toBe(4);
    expect(done.fraction).toBe(1);
  });

  test('respects the concurrency bound', async () => {
    const stats = installMock({ segments: 12, delayMs: 15 });
    const out = recordingSink();

    await runDownload({
      rendition: RENDITION,
      sink: out.sink,
      signal: new AbortController().signal,
      concurrency: 3,
      onProgress: () => {},
    });

    expect(stats.maxActive).toBeLessThanOrEqual(3);
    expect(out.chunks.slice(1).map((c) => c[0])).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
  });

  test('retries a transient segment failure', async () => {
    const stats = installMock({ segments: 5, failOnce: new Set([2]) });
    const out = recordingSink();

    await runDownload({
      rendition: RENDITION,
      sink: out.sink,
      signal: new AbortController().signal,
      onProgress: () => {},
    });

    expect(stats.attempts.get(2)).toBe(2); // failed once, retried, succeeded
    expect(out.chunks.slice(1).map((c) => c[0])).toEqual([0, 1, 2, 3, 4]);
    expect(out.closed).toBe(true);
  });

  test('cancel aborts the download without closing the file', async () => {
    installMock({ segments: 40, delayMs: 5 });
    const out = recordingSink();
    const controller = new AbortController();

    const run = runDownload({
      rendition: RENDITION,
      sink: out.sink,
      signal: controller.signal,
      onProgress: (p) => {
        if (p.segmentsDone >= 2) controller.abort();
      },
    });

    await expect(run).rejects.toThrow();
    expect(out.closed).toBe(false);
    expect(out.chunks.length).toBeLessThan(41); // did not write everything
  });

  test('pause then resume still completes in order', async () => {
    installMock({ segments: 6, delayMs: 3 });
    const out = recordingSink();
    let paused = false;

    await runDownload({
      rendition: RENDITION,
      sink: out.sink,
      signal: new AbortController().signal,
      isPaused: () => paused,
      onProgress: (p) => {
        if (p.segmentsDone === 2 && !paused) {
          paused = true;
          setTimeout(() => {
            paused = false;
          }, 40);
        }
      },
    });

    expect(out.chunks.slice(1).map((c) => c[0])).toEqual([0, 1, 2, 3, 4, 5]);
    expect(out.closed).toBe(true);
  });
});
