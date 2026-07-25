import muxjs from 'mux.js';

/**
 * Turns source segments into an ordered stream of output chunks to write.
 * Implementations hold only O(1) state — no accumulation of the whole file.
 */
export interface Muxer {
  /** Feed one source segment; returns chunks to write, in order. */
  push(bytes: Uint8Array): Uint8Array[];
  /** Flush any trailing bytes after the last segment. */
  finish(): Uint8Array[];
}

/**
 * MPEG-TS -> fragmented MP4. A single reused Transmuxer keeps decode times
 * chained across segments; the init segment (ftyp+moov) is written exactly
 * once at the start (a second moov would make the file unplayable).
 */
export class TsMuxer implements Muxer {
  private readonly transmuxer = new muxjs.mp4.Transmuxer({ remux: true });
  private wroteInit = false;
  private out: Uint8Array[] = [];

  constructor() {
    this.transmuxer.on('data', (segment) => {
      if (!this.wroteInit) {
        this.out.push(segment.initSegment);
        this.wroteInit = true;
      }
      this.out.push(segment.data);
    });
  }

  push(bytes: Uint8Array): Uint8Array[] {
    this.transmuxer.push(bytes);
    this.transmuxer.flush();
    const chunks = this.out;
    this.out = [];
    return chunks;
  }

  finish(): Uint8Array[] {
    const chunks = this.out;
    this.out = [];
    return chunks;
  }
}

/**
 * Fragmented MP4 / CMAF passthrough: write the EXT-X-MAP init segment once,
 * then each media segment (moof+mdat) verbatim. No transmux, just byte-copy.
 */
export class Fmp4Muxer implements Muxer {
  private wroteInit = false;

  constructor(private readonly initSegment?: Uint8Array) {}

  push(bytes: Uint8Array): Uint8Array[] {
    const chunks: Uint8Array[] = [];
    if (!this.wroteInit && this.initSegment) {
      chunks.push(this.initSegment);
      this.wroteInit = true;
    }
    chunks.push(bytes);
    return chunks;
  }

  finish(): Uint8Array[] {
    return [];
  }
}
