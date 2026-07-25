import type { VideoSource } from '@/lib/types';

/**
 * Typed message protocol between contexts. Kept intentionally small — only
 * control messages cross the IPC boundary, never media buffers.
 */

/** popup -> content script (of the active kick.com tab). */
export interface DetectRequest {
  type: 'GET_DETECTION';
}

/** popup -> background service worker. */
export interface OpenDownloaderRequest {
  type: 'OPEN_DOWNLOADER';
  source: VideoSource;
}

export type RuntimeMessage = DetectRequest | OpenDownloaderRequest;

/** content script -> popup: the detection result (null when not a VOD). */
export type DetectResponse = VideoSource | null;

/** background -> popup: acknowledgement after opening the downloader page. */
export interface OpenDownloaderResponse {
  ok: boolean;
  jobId?: string;
}

/** Session-storage key for a pending download job. */
export function jobKey(jobId: string): string {
  return `job:${jobId}`;
}
