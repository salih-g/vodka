// Minimal ambient types for videojs/mux.js (ships no types). Only the
// fragmented-MP4 transmuxer surface this project uses is declared.
declare module 'mux.js' {
  export interface TransmuxerOptions {
    remux?: boolean;
    keepOriginalTimestamps?: boolean;
    baseMediaDecodeTime?: number;
  }

  export interface TransmuxSegment {
    /** ftyp + moov — emitted with every 'data' event; write it once. */
    initSegment: Uint8Array;
    /** moof + mdat for this fragment. */
    data: Uint8Array;
    type?: string;
  }

  export class Transmuxer {
    constructor(options?: TransmuxerOptions);
    on(event: 'data', cb: (segment: TransmuxSegment) => void): void;
    on(event: 'done', cb: () => void): void;
    on(event: string, cb: (...args: unknown[]) => void): void;
    off(event: string, cb?: (...args: unknown[]) => void): void;
    push(data: Uint8Array): void;
    flush(): void;
    reset(): void;
    setBaseMediaDecodeTime(time: number): void;
  }

  const muxjs: {
    mp4: { Transmuxer: typeof Transmuxer };
  };
  export default muxjs;
}
