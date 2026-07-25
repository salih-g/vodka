import type { OpenDownloaderResponse, RuntimeMessage } from '@/lib/messaging';
import { jobKey } from '@/lib/messaging';
import type { VideoSource } from '@/lib/types';

/**
 * Thin coordinator. The service worker never owns a download — it only stores
 * the pending job and opens the dedicated downloader page (a real tab), which
 * has the DOM, the user gesture, and the File System Access API that a
 * multi-hour transfer requires. The SW dies on idle; the tab does not.
 */
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: RuntimeMessage) => {
    if (message?.type === 'OPEN_DOWNLOADER') {
      return openDownloader(message.source);
    }
    return undefined;
  });
});

async function openDownloader(
  source: VideoSource,
): Promise<OpenDownloaderResponse> {
  const jobId = crypto.randomUUID();
  await browser.storage.session.set({ [jobKey(jobId)]: source });
  const url = `${browser.runtime.getURL('/downloader.html')}?job=${jobId}`;
  await browser.tabs.create({ url });
  return { ok: true, jobId };
}
