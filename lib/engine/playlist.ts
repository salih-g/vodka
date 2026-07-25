import { Parser } from 'm3u8-parser';
import type { Rendition } from '@/lib/types';
import { renditionLabel } from '@/lib/format';

export interface ByteRange {
  offset: number;
  length: number;
}

export interface MediaSegmentRef {
  /** Absolute segment URL. */
  uri: string;
  duration: number;
  byterange?: ByteRange;
  /** EXT-X-MAP init segment (present => source is fMP4). */
  map?: { uri: string; byterange?: ByteRange };
  key?: { method?: string; uri?: string; iv?: Uint8Array };
}

export interface MediaPlaylist {
  segments: MediaSegmentRef[];
  targetDuration?: number;
  totalDuration: number;
  /** True when segments are fragmented MP4 (any EXT-X-MAP present). */
  isFmp4: boolean;
}

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, { credentials: 'include', signal });
  if (!res.ok) throw new Error(`Playlist fetch failed (HTTP ${res.status})`);
  return res.text();
}

function parse(text: string) {
  const parser = new Parser();
  parser.push(text);
  parser.end();
  return parser.manifest;
}

function absolute(uri: string, base: string): string {
  return new URL(uri, base).href;
}

/**
 * Fetch and parse a master playlist into quality renditions, highest first.
 * If the URL turns out to be a media playlist (single-quality VOD), returns a
 * single synthetic rendition pointing at it.
 */
export async function fetchRenditions(
  masterUrl: string,
  signal?: AbortSignal,
): Promise<Rendition[]> {
  const manifest = parse(await fetchText(masterUrl, signal));
  const playlists = manifest.playlists ?? [];

  if (playlists.length === 0) {
    // Master was actually a media playlist — one implicit rendition.
    return [{ label: 'auto', bandwidth: 0, uri: masterUrl }];
  }

  const renditions: Rendition[] = playlists.map((p) => {
    const attr = p.attributes ?? {};
    const resolution = attr.RESOLUTION;
    const frameRate =
      typeof attr['FRAME-RATE'] === 'number' ? attr['FRAME-RATE'] : undefined;
    const bandwidth =
      (typeof attr.BANDWIDTH === 'number' ? attr.BANDWIDTH : undefined) ??
      (typeof attr['AVERAGE-BANDWIDTH'] === 'number'
        ? attr['AVERAGE-BANDWIDTH']
        : 0);
    return {
      label: renditionLabel(resolution?.height, frameRate),
      width: resolution?.width,
      height: resolution?.height,
      frameRate,
      bandwidth,
      codecs: typeof attr.CODECS === 'string' ? attr.CODECS : undefined,
      uri: absolute(p.uri, masterUrl),
    };
  });

  renditions.sort((a, b) => b.bandwidth - a.bandwidth);
  return renditions;
}

/** Fetch and parse a rendition's media playlist into ordered segments. */
export async function fetchMediaPlaylist(
  renditionUrl: string,
  signal?: AbortSignal,
): Promise<MediaPlaylist> {
  const manifest = parse(await fetchText(renditionUrl, signal));
  const raw = manifest.segments ?? [];

  let isFmp4 = false;
  const segments: MediaSegmentRef[] = raw.map((s) => {
    const map = s.map
      ? {
          uri: absolute(s.map.uri, renditionUrl),
          byterange: s.map.byterange,
        }
      : undefined;
    if (map) isFmp4 = true;
    return {
      uri: absolute(s.uri, renditionUrl),
      duration: s.duration ?? 0,
      byterange: s.byterange,
      map,
      key: s.key,
    };
  });

  const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);
  return {
    segments,
    targetDuration: manifest.targetDuration,
    totalDuration,
    isFmp4,
  };
}
