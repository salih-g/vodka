import { fetchVodSource } from '@/lib/kick/api';
import { classifyKickUrl } from '@/lib/kick/classify';
import type { DetectResponse, RuntimeMessage } from '@/lib/messaging';

/**
 * Runs on kick.com. Resolves the current page's VOD source on demand — the
 * fetch is same-origin here, so it rides the user's session and never trips
 * Cloudflare. The heavy download happens elsewhere (the downloader page).
 */
export default defineContentScript({
  matches: ['*://kick.com/*', '*://*.kick.com/*'],
  main() {
    browser.runtime.onMessage.addListener((message: RuntimeMessage) => {
      if (message?.type === 'GET_DETECTION') {
        return detect();
      }
      return undefined;
    });
  },
});

async function detect(): Promise<DetectResponse> {
  const target = classifyKickUrl(location.href);
  if (!target || target.kind !== 'vod') return null;
  try {
    return await fetchVodSource(target);
  } catch {
    return null;
  }
}
