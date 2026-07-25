import type { KickTarget } from '@/lib/types';

/**
 * VOD path: /{slug}/videos/{uuid}, where uuid is the canonical 8-4-4-4-12 hex.
 * Mirrors yt-dlp's KickVODIE valid-url shape.
 */
const VOD_PATH_RE =
  /^\/([\w-]+)\/videos\/([\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12})/i;

function isKickHost(hostname: string): boolean {
  return /(^|\.)kick\.com$/i.test(hostname);
}

/**
 * Classify a Kick URL into a downloadable target. VOD-only for now; live and
 * clip kinds are part of the type model but not yet resolved.
 *
 * Returns null when the URL is not a Kick page or not a supported target.
 */
export function classifyKickUrl(rawUrl: string): KickTarget | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!isKickHost(url.hostname)) return null;

  const vod = url.pathname.match(VOD_PATH_RE);
  if (vod) {
    return { kind: 'vod', slug: vod[1], id: vod[2], pageUrl: rawUrl };
  }

  return null;
}
