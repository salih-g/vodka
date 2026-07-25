export type Container = 'ts' | 'fmp4' | 'unknown';

/**
 * Cheap byte sniff on a segment's leading bytes.
 * - MPEG-TS: sync byte 0x47, repeating every 188 bytes.
 * - ISOBMFF/fMP4: an 'ftyp' / 'styp' / 'moof' box at offset 4.
 */
export function sniffContainer(bytes: Uint8Array): Container {
  if (bytes.length >= 189 && bytes[0] === 0x47 && bytes[188] === 0x47) {
    return 'ts';
  }
  if (bytes.length >= 8) {
    const box = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (box === 'ftyp' || box === 'styp' || box === 'moof') return 'fmp4';
  }
  if (bytes.length >= 1 && bytes[0] === 0x47) return 'ts';
  return 'unknown';
}
