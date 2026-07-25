import { describe, expect, test } from 'bun:test';
import { classifyKickUrl } from '@/lib/kick/classify';
import { formatBytes, formatDuration, renditionLabel } from '@/lib/format';
import { sniffContainer } from '@/lib/engine/container';

describe('classifyKickUrl', () => {
  test('resolves a VOD url', () => {
    const t = classifyKickUrl(
      'https://kick.com/xqc/videos/12345678-1234-1234-1234-123456789abc',
    );
    expect(t).toEqual({
      kind: 'vod',
      slug: 'xqc',
      id: '12345678-1234-1234-1234-123456789abc',
      pageUrl: 'https://kick.com/xqc/videos/12345678-1234-1234-1234-123456789abc',
    });
  });

  test('accepts www and trailing path', () => {
    const t = classifyKickUrl(
      'https://www.kick.com/some-chan/videos/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee?t=10',
    );
    expect(t?.kind).toBe('vod');
    expect(t?.slug).toBe('some-chan');
  });

  test('rejects non-kick hosts', () => {
    expect(
      classifyKickUrl('https://kick.com.evil.com/x/videos/12345678-1234-1234-1234-123456789abc'),
    ).toBeNull();
    expect(classifyKickUrl('https://twitch.tv/x/videos/123')).toBeNull();
  });

  test('rejects live and clip pages (VOD-only)', () => {
    expect(classifyKickUrl('https://kick.com/xqc')).toBeNull();
    expect(classifyKickUrl('https://kick.com/xqc/clips/clip_ABC123')).toBeNull();
  });

  test('rejects malformed input', () => {
    expect(classifyKickUrl('not a url')).toBeNull();
    expect(classifyKickUrl('https://kick.com/x/videos/not-a-uuid')).toBeNull();
  });

  test('tolerates looser /video(s)/{uuid} shapes', () => {
    const uuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    expect(classifyKickUrl(`https://kick.com/videos/${uuid}`)).toMatchObject({
      kind: 'vod',
      id: uuid,
    });
    expect(classifyKickUrl(`https://kick.com/video/${uuid}`)).toMatchObject({
      kind: 'vod',
      id: uuid,
    });
    expect(classifyKickUrl(`https://kick.com/xqc/video/${uuid}`)).toMatchObject({
      kind: 'vod',
      slug: 'xqc',
      id: uuid,
    });
  });

  test('does not treat a bare uuid off a video path as a VOD', () => {
    const uuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    expect(classifyKickUrl(`https://kick.com/xqc/${uuid}`)).toBeNull();
  });
});

describe('formatDuration', () => {
  test('formats', () => {
    expect(formatDuration(undefined)).toBe('--:--');
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(3_661_000)).toBe('1:01:01');
    expect(formatDuration(-5)).toBe('--:--');
  });
});

describe('formatBytes', () => {
  test('formats', () => {
    expect(formatBytes(undefined)).toBe('--');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(5.5 * 1024 * 1024 * 1024)).toBe('5.5 GB');
  });
});

describe('renditionLabel', () => {
  test('derives labels', () => {
    expect(renditionLabel(1080, 60)).toBe('1080p60');
    expect(renditionLabel(1080, 59.94)).toBe('1080p60');
    expect(renditionLabel(720, 30)).toBe('720p');
    expect(renditionLabel(480, undefined)).toBe('480p');
    expect(renditionLabel(undefined, undefined)).toBe('auto');
  });
});

describe('sniffContainer', () => {
  test('detects MPEG-TS by sync bytes', () => {
    const ts = new Uint8Array(189);
    ts[0] = 0x47;
    ts[188] = 0x47;
    expect(sniffContainer(ts)).toBe('ts');
  });

  test('detects fMP4 boxes', () => {
    const box = (t: string) => {
      const b = new Uint8Array(8);
      for (let i = 0; i < 4; i++) b[4 + i] = t.charCodeAt(i);
      return b;
    };
    expect(sniffContainer(box('ftyp'))).toBe('fmp4');
    expect(sniffContainer(box('styp'))).toBe('fmp4');
    expect(sniffContainer(box('moof'))).toBe('fmp4');
  });

  test('falls back and reports unknown', () => {
    expect(sniffContainer(new Uint8Array([0x47]))).toBe('ts');
    expect(sniffContainer(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toBe('unknown');
  });
});
