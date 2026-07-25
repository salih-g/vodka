import { fetchVodSource } from '@/lib/kick/api';
import type { RuntimeMessage } from '@/lib/messaging';

/**
 * Runs on kick.com purely as a same-origin resolve fallback. Detection and the
 * primary API call now happen in the extension context (popup/downloader), so
 * the extension works on already-open tabs and for pasted links without a tab.
 * This only kicks in if the extension-origin API call is blocked (e.g.
 * Cloudflare) and a kick.com tab happens to be open.
 */
export default defineContentScript({
  matches: ['*://kick.com/*', '*://*.kick.com/*'],
  main() {
    browser.runtime.onMessage.addListener((message: RuntimeMessage) => {
      if (message?.type === 'RESOLVE') {
        return fetchVodSource(message.target).catch(() => null);
      }
      return undefined;
    });
  },
});
