import { useEffect, useState } from 'react';
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
    <div className="flex w-[360px] flex-col bg-ink-950 text-neutral-200">
      <Header />
      <div className="px-4 pb-3">
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
      <Footer />
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
    // No content script here — not a kick.com page.
    return null;
  }
}

function Header() {
  return (
    <header className="flex items-center gap-2.5 px-4 pb-3 pt-4">
      <Logo />
      <div className="leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-semibold tracking-tight text-white">
            vodka
          </span>
          <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-400">
            VOD
          </span>
        </div>
        <p className="text-[11px] text-neutral-500">Kick VOD indirici</p>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-500/20">
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
    <div className="overflow-hidden rounded-2xl border border-ink-700/60 bg-ink-900">
      <Thumb source={source} />
      <div className="p-3.5">
        <h1 className="line-clamp-2 text-sm font-semibold text-white">
          {source.title ?? 'Kick VOD'}
        </h1>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-neutral-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-brand-500" />
            {source.target.slug}
          </span>
          {source.durationMs !== undefined && (
            <span>· {formatDuration(source.durationMs)}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-brand-400 active:scale-[0.99] disabled:opacity-60"
        >
          {starting ? 'Açılıyor…' : 'İndir'}
        </button>
      </div>
    </div>
  );
}

function Thumb({ source }: { source: VideoSource }) {
  return (
    <div className="relative aspect-video w-full bg-ink-800">
      {source.thumbnail ? (
        <img
          src={source.thumbnail}
          alt=""
          className="size-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="grid size-full place-items-center bg-gradient-to-br from-ink-800 to-ink-900" />
      )}
      <div className="absolute inset-0 grid place-items-center bg-black/20">
        <div className="grid size-10 place-items-center rounded-full bg-black/50 backdrop-blur">
          <svg
            viewBox="0 0 24 24"
            className="size-5 text-white"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-ink-700/60 bg-ink-900 p-5 text-center">
      <div className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-ink-800 text-neutral-500">
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M10 9l5 3-5 3z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-neutral-200">VOD bulunamadı</p>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
        İndirmek için bir Kick VOD sayfası aç:
      </p>
      <p className="mt-1 font-mono text-[11px] text-neutral-400">
        kick.com/kanal/videos/…
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-700/60 bg-ink-900">
      <div className="aspect-video w-full animate-pulse bg-ink-800" />
      <div className="space-y-2 p-3.5">
        <div className="h-3.5 w-3/4 animate-pulse rounded bg-ink-800" />
        <div className="h-2.5 w-1/3 animate-pulse rounded bg-ink-800" />
        <div className="mt-2 h-9 w-full animate-pulse rounded-xl bg-ink-800" />
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink-800 px-4 py-2.5">
      <p className="text-[10px] leading-relaxed text-neutral-600">
        Yalnızca kendi içeriğin veya indirme izni olan içerik için kullan.
      </p>
    </footer>
  );
}
