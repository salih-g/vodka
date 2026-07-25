import type { OpenDownloaderResponse, RuntimeMessage } from '@/lib/messaging';
import { jobKey } from '@/lib/messaging';
import type { DownloadJob } from '@/lib/types';

/**
 * Thin coordinator. Stores the pending job and opens the dedicated downloader
 * page (a real tab) — the only MV3 context with the DOM, the user gesture, and
 * the File System Access API a multi-hour transfer needs. It never owns a
 * download itself.
 */
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: RuntimeMessage) => {
    if (message?.type === 'OPEN_DOWNLOADER') {
      return openDownloader({ target: message.target, source: message.source });
    }
    return undefined;
  });
});

async function openDownloader(job: DownloadJob): Promise<OpenDownloaderResponse> {
  const jobId = crypto.randomUUID();
  await browser.storage.session.set({ [jobKey(jobId)]: job });
  const url = `${browser.runtime.getURL('/downloader.html')}?job=${jobId}`;
  await browser.tabs.create({ url });
  return { ok: true, jobId };
}
