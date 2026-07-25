// Minimal ambient types for videojs/m3u8-parser (ships no types).
declare module 'm3u8-parser' {
  export interface ByteRange {
    length: number;
    offset: number;
  }

  export interface SegmentKey {
    method?: string;
    uri?: string;
    iv?: Uint8Array;
  }

  export interface SegmentMap {
    uri: string;
    byterange?: ByteRange;
  }

  export interface Segment {
    uri: string;
    duration?: number;
    timeline?: number;
    discontinuity?: boolean;
    byterange?: ByteRange;
    key?: SegmentKey;
    map?: SegmentMap;
  }

  export interface PlaylistAttributes {
    BANDWIDTH?: number;
    'AVERAGE-BANDWIDTH'?: number;
    RESOLUTION?: { width: number; height: number };
    CODECS?: string;
    'FRAME-RATE'?: number;
    [key: string]: unknown;
  }

  export interface Playlist {
    uri: string;
    attributes?: PlaylistAttributes;
  }

  export interface Manifest {
    allowCache?: boolean;
    endList?: boolean;
    mediaSequence?: number;
    targetDuration?: number;
    totalDuration?: number;
    discontinuityStarts?: number[];
    segments?: Segment[];
    playlists?: Playlist[];
  }

  export class Parser {
    manifest: Manifest;
    push(chunk: string): void;
    end(): void;
    addParser(options: unknown): void;
  }
}
