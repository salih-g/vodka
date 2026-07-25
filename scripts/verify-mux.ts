/**
 * Real-data verification of the download engine's byte path.
 *
 * Runs the ACTUAL engine modules (playlist parse, segment fetch, container
 * sniff, mux.js transmux) against a public HLS stream that uses the same codecs
 * as Kick (H.264 + AAC in MPEG-TS), writes an MP4, and validates the ISOBMFF
 * box structure — all without a browser or ffmpeg.
 *
 *   bun scripts/verify-mux.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fetchMediaPlaylist, fetchRenditions } from '@/lib/engine/playlist';
import { fetchBytes } from '@/lib/engine/segments';
import { sniffContainer } from '@/lib/engine/container';
import { Fmp4Muxer, TsMuxer, type Muxer } from '@/lib/engine/muxer';

const MASTER = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
const MAX_SEGMENTS = 8;

interface Box {
  type: string;
  size: number;
  offset: number;
}

function topLevelBoxes(buf: Uint8Array): Box[] {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const boxes: Box[] = [];
  let o = 0;
  while (o + 8 <= buf.byteLength) {
    let size = view.getUint32(o);
    const type = String.fromCharCode(buf[o + 4], buf[o + 5], buf[o + 6], buf[o + 7]);
    if (size === 1 && o + 16 <= buf.byteLength) {
      size = Number(view.getBigUint64(o + 8));
    }
    if (size < 8) break;
    boxes.push({ type, size, offset: o });
    o += size;
  }
  return boxes;
}

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`  ✗ ${msg}`);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log(`  ✓ ${msg}`);
}

async function main() {
  console.log(`\n▶ master: ${MASTER}`);
  const renditions = await fetchRenditions(MASTER);
  assert(renditions.length > 0, `resolved ${renditions.length} renditions`);
  console.log(
    '  renditions:',
    renditions
      .map((r) => `${r.label}@${(r.bandwidth / 1e6).toFixed(1)}Mbps`)
      .join(', '),
  );

  const rendition = renditions[renditions.length - 1]; // smallest for speed
  console.log(`\n▶ rendition: ${rendition.label} (${rendition.uri})`);
  const media = await fetchMediaPlaylist(rendition.uri);
  assert(media.segments.length > 0, `media playlist has ${media.segments.length} segments`);
  console.log(`  isFmp4=${media.isFmp4}  targetDuration=${media.targetDuration}`);

  const segments = media.segments.slice(0, MAX_SEGMENTS);
  console.log(`\n▶ processing first ${segments.length} segments`);

  const first = await fetchBytes(segments[0].uri, segments[0].byterange);
  const container = sniffContainer(first);
  assert(container === 'ts' || container === 'fmp4', `sniffed container: ${container}`);

  let muxer: Muxer;
  if (media.isFmp4) {
    const init = segments[0].map
      ? await fetchBytes(segments[0].map.uri, segments[0].map.byterange)
      : undefined;
    muxer = new Fmp4Muxer(init);
  } else {
    muxer = new TsMuxer();
  }

  const chunks: Uint8Array[] = [];
  let downloaded = 0;
  for (let i = 0; i < segments.length; i++) {
    const bytes = i === 0 ? first : await fetchBytes(segments[i].uri, segments[i].byterange);
    downloaded += bytes.byteLength;
    for (const c of muxer.push(bytes)) chunks.push(c);
  }
  for (const c of muxer.finish()) chunks.push(c);

  const out = new Uint8Array(chunks.reduce((a, c) => a + c.byteLength, 0));
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.byteLength;
  }

  mkdirSync('scripts/.out', { recursive: true });
  writeFileSync('scripts/.out/verify.mp4', out);
  console.log(
    `  downloaded ${(downloaded / 1e6).toFixed(2)} MB TS -> wrote ${(out.byteLength / 1e6).toFixed(2)} MB MP4`,
  );

  console.log(`\n▶ validating MP4 box structure`);
  const boxes = topLevelBoxes(out);
  const types = boxes.map((b) => b.type);
  console.log('  top-level boxes:', types.join(' '));

  assert(types[0] === 'ftyp', 'starts with ftyp');
  assert(types.includes('moov'), 'contains moov (has movie header)');
  const moofCount = types.filter((t) => t === 'moof').length;
  const mdatCount = types.filter((t) => t === 'mdat').length;
  assert(moofCount > 0, `contains ${moofCount} moof fragments`);
  assert(mdatCount > 0, `contains ${mdatCount} mdat payloads`);
  assert(types.indexOf('moov') === 1, 'moov immediately follows ftyp (single init)');
  assert(
    types.filter((t) => t === 'moov').length === 1,
    'exactly one moov (init written once)',
  );
  const lastMoov = types.lastIndexOf('moov');
  const firstMoof = types.indexOf('moof');
  assert(firstMoof > lastMoov, 'fragments come after the init segment');

  console.log('\n✅ engine produced a structurally valid fragmented MP4\n');
}

main().catch((err) => {
  console.error('\n❌ verification failed:', err?.message ?? err);
  process.exitCode = 1;
});
