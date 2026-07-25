// Shared domain types for the Kick VOD downloader.

export type KickContentKind = 'vod' | 'live' | 'clip';

/** A classified Kick page target derived from a URL. */
export interface KickTarget {
  kind: KickContentKind;
  /** Channel slug from the URL (e.g. "xqc"). */
  slug: string;
  /** VOD uuid, clip id, or channel slug depending on `kind`. */
  id: string;
  /** The original page URL. */
  pageUrl: string;
}

/** A single quality rendition parsed from the HLS master playlist. */
export interface Rendition {
  /** Human label, e.g. "1080p60". */
  label: string;
  width?: number;
  height?: number;
  frameRate?: number;
  /** Peak bandwidth in bits/second, from EXT-X-STREAM-INF BANDWIDTH. */
  bandwidth: number;
  /** CODECS attribute, e.g. "avc1.640028,mp4a.40.2". */
  codecs?: string;
  /** Absolute media-playlist URL for this rendition. */
  uri: string;
}

/**
 * A resolved downloadable video source. Renditions are populated later, once
 * the master playlist has been fetched from an extension context (the content
 * script cannot fetch the CDN cross-origin).
 */
export interface VideoSource {
  target: KickTarget;
  /** Absolute master m3u8 URL (or a direct progressive file for some clips). */
  masterUrl: string;
  /** True when `masterUrl` is a direct progressive file rather than HLS. */
  direct: boolean;
  title?: string;
  durationMs?: number;
  thumbnail?: string;
}
