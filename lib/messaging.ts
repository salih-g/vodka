import type { KickTarget, VideoSource } from '@/lib/types';

/**
 * Typed message protocol between contexts. Only small control messages cross
 * the IPC boundary — never media buffers.
 */

/** popup/downloader -> content script (of an open kick.com tab): same-origin resolve. */
export interface ResolveRequest {
  type: 'RESOLVE';
  target: KickTarget;
}

/** popup -> background service worker: open the downloader for a target. */
export interface OpenDownloaderRequest {
  type: 'OPEN_DOWNLOADER';
  target: KickTarget;
  /** Optional pre-resolved source (popup preview), lets the downloader skip a re-resolve. */
  source?: VideoSource;
}

export type RuntimeMessage = ResolveRequest | OpenDownloaderRequest;

/** content script -> caller: resolved source, or null on failure. */
export type ResolveResponse = VideoSource | null;

/** background -> popup: acknowledgement after opening the downloader page. */
export interface OpenDownloaderResponse {
  ok: boolean;
  jobId?: string;
}

/** Session-storage key for a pending download job. */
export function jobKey(jobId: string): string {
  return `job:${jobId}`;
}
