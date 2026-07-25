import { useEffect, useState } from 'react';
import { jobKey } from '@/lib/messaging';
import type { VideoSource } from '@/lib/types';
import { formatDuration } from '@/lib/format';

export default function App() {
  const [source, setSource] = useState<VideoSource | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    (async () => {
      const jobId = new URLSearchParams(location.search).get('job');
      if (!jobId) return setMissing(true);
      const rec = await browser.storage.session.get(jobKey(jobId));
      const s = rec[jobKey(jobId)] as VideoSource | undefined;
      if (!s) return setMissing(true);
      setSource(s);
      document.title = s.title ? `${s.title} — Vodka` : 'Vodka — İndirici';
    })();
  }, []);

  return (
    <div className="min-h-screen bg-ink-950 text-neutral-200">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <header className="mb-8 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-500/20">
            <svg
              viewBox="0 0 24 24"
              className="size-5 text-ink-950"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3v12" />
              <path d="m7 11 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">
              vodka
            </h1>
            <p className="text-xs text-neutral-500">Kick VOD indirici</p>
          </div>
        </header>

        {missing && <Missing />}
        {source && <Job source={source} />}
      </div>
    </div>
  );
}

function Missing() {
  return (
    <div className="rounded-2xl border border-ink-700/60 bg-ink-900 p-8 text-center">
      <p className="text-sm font-medium text-neutral-200">
        İndirme işi bulunamadı
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        Bu sayfayı Vodka popup'ından “İndir” diyerek aç.
      </p>
    </div>
  );
}

function Job({ source }: { source: VideoSource }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-700/60 bg-ink-900">
      <div className="relative aspect-video w-full bg-ink-800">
        {source.thumbnail && (
          <img
            src={source.thumbnail}
            alt=""
            className="size-full object-cover opacity-90"
          />
        )}
      </div>
      <div className="p-5">
        <h2 className="text-base font-semibold text-white">
          {source.title ?? 'Kick VOD'}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-brand-500" />
            {source.target.slug}
          </span>
          {source.durationMs !== undefined && (
            <span>{formatDuration(source.durationMs)}</span>
          )}
          <span className="font-mono text-[11px] text-neutral-600">
            {source.target.id}
          </span>
        </div>

        <div className="mt-5 rounded-xl border border-ink-700/60 bg-ink-950/50 p-4">
          <div className="flex items-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-brand-500" />
            <p className="text-sm font-medium text-neutral-200">
              Kaynak çözümlendi
            </p>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">
            Master playlist hazır. Kalite seçimi ve sabit-bellekli indirme
            motoru bir sonraki adımda bağlanacak.
          </p>
        </div>
      </div>
    </div>
  );
}
