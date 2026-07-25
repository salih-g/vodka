import { useEffect, useState } from 'react';
import { Atmosphere, CropCorners, Wordmark } from '@/components/ui';
import type { RuntimeMessage } from '@/lib/messaging';
import type { VideoSource } from '@/lib/types';
import { formatDuration } from '@/lib/format';

type View =
  | { status: 'loading' }
  | { status: 'idle' }
  | { status: 'ready'; source: VideoSource };

export default function App() {
  const [view, setView] = useState<View>({ status: 'loading' });
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let alive = true;
    detectActiveTab().then((source) => {
      if (!alive) return;
      setView(source ? { status: 'ready', source } : { status: 'idle' });
    });
    return () => {
      alive = false;
    };
  }, []);

  async function start(source: VideoSource) {
    setStarting(true);
    try {
      await browser.runtime.sendMessage({
        type: 'OPEN_DOWNLOADER',
        source,
      } satisfies RuntimeMessage);
      window.close();
    } catch {
      setStarting(false);
    }
  }

  return (
    <div className="relative isolate flex w-[360px] flex-col overflow-hidden bg-ink-950">
      <Atmosphere />

      <header className="flex items-center justify-between px-4 pb-3 pt-4">
        <Wordmark />
        <StatusLed active={view.status === 'ready'} />
      </header>

      <div className="px-4 pb-4">
        {view.status === 'loading' && <Skeleton />}
        {view.status === 'idle' && <EmptyState />}
        {view.status === 'ready' && (
          <ReadyState
            source={view.source}
            starting={starting}
            onStart={() => start(view.source)}
          />
        )}
      </div>

      <footer className="border-t border-white/5 px-4 py-2.5">
        <p className="font-mono text-[9px] uppercase leading-relaxed tracking-[0.14em] text-dim">
          kendi içeriğin · offline arşiv · redistribution yok
        </p>
      </footer>
    </div>
  );
}

async function detectActiveTab(): Promise<VideoSource | null> {
  try {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return null;
    const res = (await browser.tabs.sendMessage(tab.id, {
      type: 'GET_DETECTION',
    } satisfies RuntimeMessage)) as VideoSource | null;
    return res ?? null;
  } catch {
    return null;
  }
}

function StatusLed({ active }: { active: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={
          active
            ? 'fx-rec size-1.5 rounded-full bg-brand-500'
            : 'size-1.5 rounded-full bg-ink-600'
        }
      />
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-dim">
        {active ? 'ready' : 'idle'}
      </span>
    </span>
  );
}

function ReadyState({
  source,
  starting,
  onStart,
}: {
  source: VideoSource;
  starting: boolean;
  onStart: () => void;
}) {
  return (
    <div className="fx-rise space-y-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-md border border-white/10 bg-ink-850">
        {source.thumbnail ? (
          <img
            src={source.thumbnail}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="size-full bg-gradient-to-br from-ink-800 to-ink-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent" />
        <CropCorners />
        {source.durationMs !== undefined && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-ink-950/80 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-fg backdrop-blur">
            {formatDuration(source.durationMs)}
          </span>
        )}
      </div>

      <div>
        <h1 className="line-clamp-2 text-[15px] font-semibold leading-snug text-fg">
          {source.title ?? 'Kick VOD'}
        </h1>
        <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1 rounded-full bg-brand-500" />
            {source.target.slug}
          </span>
          <span className="text-dim">/</span>
          <span>vod</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onStart}
        disabled={starting}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-500 py-2.5 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-950 transition hover:bg-brand-400 active:scale-[0.99] disabled:opacity-60"
      >
        {starting ? 'açılıyor…' : 'indir'}
        {!starting && <span aria-hidden>→</span>}
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="fx-rise rounded-md border border-dashed border-white/10 bg-ink-900/50 px-5 py-7 text-center">
      <div className="mx-auto mb-3 grid size-10 place-items-center rounded-md border border-white/10 text-dim">
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M10 9l5 3-5 3z" />
        </svg>
      </div>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        vod bulunamadı
      </p>
      <p className="mx-auto mt-2 max-w-[240px] font-mono text-[10px] leading-relaxed tracking-wide text-dim">
        bir kick vod sayfası aç
        <br />
        <span className="text-brand-500/70">kick.com/kanal/videos/…</span>
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="fx-scan aspect-video w-full animate-pulse rounded-md bg-ink-850" />
      <div className="h-3.5 w-3/4 animate-pulse rounded bg-ink-850" />
      <div className="h-2.5 w-1/3 animate-pulse rounded bg-ink-850" />
      <div className="h-10 w-full animate-pulse rounded-md bg-ink-850" />
    </div>
  );
}
