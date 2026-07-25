import type { ByteRange } from './playlist';

export interface FetchOptions {
  signal?: AbortSignal;
  retries?: number;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

function rangeHeader(byterange?: ByteRange): Record<string, string> {
  if (!byterange) return {};
  const end = byterange.offset + byterange.length - 1;
  return { Range: `bytes=${byterange.offset}-${end}` };
}

/**
 * Fetch a URL (optionally a byte range) as bytes, with bounded retry and
 * exponential backoff + jitter. Aborts propagate immediately without retrying.
 */
export async function fetchBytes(
  url: string,
  byterange?: ByteRange,
  opts: FetchOptions = {},
): Promise<Uint8Array> {
  const { signal, retries = 4 } = opts;
  const headers = rangeHeader(byterange);

  let attempt = 0;
  for (;;) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const res = await fetch(url, { credentials: 'include', headers, signal });
      if (!res.ok && res.status !== 206) {
        throw new Error(`HTTP ${res.status}`);
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength === 0) throw new Error('empty response');
      return bytes;
    } catch (err) {
      if (signal?.aborted) throw err;
      attempt++;
      if (attempt > retries) throw err;
      const backoff = Math.min(5000, 250 * 2 ** (attempt - 1));
      await delay(backoff + Math.random() * 150, signal);
    }
  }
}
