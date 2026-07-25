import type { KickTarget } from '@/lib/types';

const UUID = '[\\da-f]{8}-(?:[\\da-f]{4}-){3}[\\da-f]{12}';
/** Canonical VOD path: /{slug}/videos/{uuid} (matches yt-dlp's KickVODIE). */
const CANONICAL_RE = new RegExp(`^/([\\w-]+)/videos/(${UUID})`, 'i');
/** A UUID appearing on a /video(s)/ path — tolerant of URL-shape drift. */
const VIDEO_PATH_RE = new RegExp(`/videos?/`, 'i');
const UUID_RE = new RegExp(UUID, 'i');

function isKickHost(hostname: string): boolean {
  return /(^|\.)kick\.com$/i.test(hostname);
}

/**
 * Classify a Kick URL into a downloadable VOD target. VOD-only.
 *
 * Accepts the canonical `/{slug}/videos/{uuid}` as well as looser shapes that
 * still carry a UUID on a `/video(s)/` path, so a URL-format change on Kick's
 * side doesn't silently break detection. Only the UUID is needed for the API;
 * the slug is cosmetic. Returns null when the URL is not a Kick VOD.
 */
export function classifyKickUrl(rawUrl: string): KickTarget | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!isKickHost(url.hostname)) return null;

  const path = url.pathname;

  const canonical = path.match(CANONICAL_RE);
  if (canonical) {
    return { kind: 'vod', slug: canonical[1], id: canonical[2], pageUrl: rawUrl };
  }

  if (VIDEO_PATH_RE.test(path)) {
    const uuid = path.match(UUID_RE)?.[0];
    if (uuid) {
      const slug =
        path
          .split('/')
          .filter(Boolean)
          .find((seg) => seg !== 'video' && seg !== 'videos' && !UUID_RE.test(seg)) ??
        '';
      return { kind: 'vod', slug, id: uuid, pageUrl: rawUrl };
    }
  }

  return null;
}
