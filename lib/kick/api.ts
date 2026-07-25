import type { KickTarget, VideoSource } from '@/lib/types';

export class KickApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'KickApiError';
  }
}

/** Pick the first string value among candidate paths, if any. */
function firstString(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

/**
 * Resolve a Kick VOD's master playlist and metadata via the public JSON API.
 *
 * MUST be called from a kick.com origin context (the content script) so the
 * request is same-origin and rides the user's validated session/cookies —
 * this sidesteps Cloudflare's TLS fingerprinting entirely. `credentials`
 * are included so subscriber-only VODs resolve when the user has access.
 *
 * Endpoint: GET https://kick.com/api/v1/video/{uuid} -> { source, duration, ... }
 */
export async function fetchVodSource(target: KickTarget): Promise<VideoSource> {
  const res = await fetch(`https://kick.com/api/v1/video/${target.id}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new KickApiError(
      `Kick API returned ${res.status} for VOD ${target.id}`,
      res.status,
    );
  }

  const data: any = await res.json();
  const masterUrl = data?.source;
  if (typeof masterUrl !== 'string' || masterUrl.length === 0) {
    throw new KickApiError('VOD response did not include a playable source');
  }

  // Kick reports VOD duration in milliseconds (yt-dlp divides by 1000).
  const durationMs =
    typeof data?.duration === 'number' ? data.duration : undefined;

  return {
    target,
    masterUrl,
    direct: false,
    title: firstString(
      data?.livestream?.session_title,
      data?.session_title,
      data?.title,
    ),
    durationMs,
    thumbnail: firstString(
      data?.livestream?.thumbnail?.src,
      data?.thumbnail?.src,
      data?.thumbnail,
    ),
  };
}
