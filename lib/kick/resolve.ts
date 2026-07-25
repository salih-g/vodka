import { browser } from 'wxt/browser';
import type { KickTarget, VideoSource } from '@/lib/types';
import type { ResolveRequest } from '@/lib/messaging';
import { fetchVodSource } from './api';

/**
 * Resolve a VOD from any extension page/service-worker context.
 *
 * Primary path: a direct call to the Kick API. From an extension context this
 * is cross-origin but privileged (host_permissions bypass CORS) and credentialed
 * (`credentials:'include'` sends the user's kick.com cookies), so it works even
 * with NO kick.com tab open — which is what powers link-paste downloads.
 *
 * Fallback: if the direct call fails (e.g. Cloudflare rejects the extension
 * origin), run the same request inside an open kick.com tab (same-origin, rides
 * the validated page session) via the content script.
 */
export async function resolveVodSource(target: KickTarget): Promise<VideoSource> {
  try {
    return await fetchVodSource(target);
  } catch (primary) {
    const viaTab = await resolveViaKickTab(target);
    if (viaTab) return viaTab;
    throw primary;
  }
}

async function resolveViaKickTab(
  target: KickTarget,
): Promise<VideoSource | null> {
  let tabs;
  try {
    tabs = await browser.tabs.query({
      url: ['*://kick.com/*', '*://*.kick.com/*'],
    });
  } catch {
    return null;
  }
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    try {
      const res = (await browser.tabs.sendMessage(tab.id, {
        type: 'RESOLVE',
        target,
      } satisfies ResolveRequest)) as VideoSource | null;
      if (res) return res;
    } catch {
      // No content script in this tab; try the next.
    }
  }
  return null;
}
