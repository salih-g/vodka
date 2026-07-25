import { useEffect, useMemo, useState } from 'react';
import { Atmosphere, CropCorners, Wordmark } from '@/components/ui';
import type { RuntimeMessage } from '@/lib/messaging';
import type { KickTarget, VideoSource } from '@/lib/types';
import { classifyKickUrl } from '@/lib/kick/classify';
import { resolveVodSource } from '@/lib/kick/resolve';
import { formatDuration } from '@/lib/format';

export default function App() {
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<VideoSource | null>(null);
  const [resolving, setResolving] = useState(false);
  const [starting, setStarting] = useState(false);

  const target = useMemo(() => classifyKickUrl(url.trim()), [url]);
  const invalid = url.trim().length > 0 && !target;

  // Prefill from the active tab (no content script needed).
  useEffect(() => {
    browser.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (tab?.url && classifyKickUrl(tab.url)) setUrl(tab.url);
      })
      .catch(() => {});
  }, []);

  // Non-blocking preview enrich — never gates the download.
  useEffect(() => {
    if (!target) {
      setPreview(null);
      return;
    }
    let alive = true;
    setResolving(true);
    setPreview(null);
    resolveVodSource(target)
      .then((s) => alive && setPreview(s))
      .catch(() => {})
      .finally(() => alive && setResolving(false));
    return () => {
      alive = false;
    };
  }, [target?.id]);

  async function start() {
    if (!target || starting) return;
    setStarting(true);
    try {
      await browser.runtime.sendMessage({
        type: 'OPEN_DOWNLOADER',
        target,
        source: preview ?? undefined,
      } satisfies RuntimeMessage);
      window.close();
    } catch {
      setStarting(false);
    }
  }

  return (
    <div className="relative isolate flex w-[380px] flex-col overflow-hidden bg-ink-950">
      <Atmosphere />

      <header className="flex items-center justify-between px-4 pb-3 pt-4">
        <Wordmark />
        <StatusLed active={!!target} />
      </header>

      <div className="space-y-3 px-4 pb-4">
        <UrlBar
          value={url}
          onChange={setUrl}
          onSubmit={start}
          valid={!!target}
          invalid={invalid}
        />

        {target ? (
          <Card
            target={target}
            preview={preview}
            resolving={resolving}
            starting={starting}
            onStart={start}
          />
        ) : (
          <Hint invalid={invalid} />
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

function UrlBar({
  value,
  onChange,
  onSubmit,
  valid,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  valid: boolean;
  invalid: boolean;
}) {
  return (
    <div
      className={[
        'flex items-center gap-2 rounded-md border bg-ink-900 px-3 py-2 transition-colors',
        invalid
          ? 'border-signal-red/40'
          : valid
            ? 'border-brand-500/40'
            : 'border-white/10 focus-within:border-white/25',
      ].join(' ')}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4 shrink-0 text-dim"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
        <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
        }}
        spellCheck={false}
        autoFocus
        placeholder="kick.com/kanal/videos/…"
        className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-fg placeholder:text-dim focus:outline-none"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={!valid}
        aria-label="İndir"
        className="grid size-6 shrink-0 place-items-center rounded text-ink-950 transition disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-dim data-[ok=true]:bg-brand-500 data-[ok=true]:hover:bg-brand-400"
        data-ok={valid}
      >
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      </button>
    </div>
  );
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
        {active ? 'vod' : 'idle'}
      </span>
    </span>
  );
}

function Card({
  target,
  preview,
  resolving,
  starting,
  onStart,
}: {
  target: KickTarget;
  preview: VideoSource | null;
  resolving: boolean;
  starting: boolean;
  onStart: () => void;
}) {
  return (
    <div className="fx-rise space-y-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-md border border-white/10 bg-ink-850">
        {preview?.thumbnail ? (
          <img src={preview.thumbnail} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="size-full bg-gradient-to-br from-ink-800 to-ink-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent" />
        <CropCorners />
        {preview?.durationMs !== undefined && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-ink-950/80 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-fg backdrop-blur">
            {formatDuration(preview.durationMs)}
          </span>
        )}
      </div>

      <div>
        <h1 className="line-clamp-2 min-h-[1.25rem] text-[14px] font-semibold leading-snug text-fg">
          {preview?.title ?? (resolving ? 'Çözümleniyor…' : 'Kick VOD')}
        </h1>
        <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1 rounded-full bg-brand-500" />
            {target.slug || 'kick'}
          </span>
          <span className="text-dim">/</span>
          <span>vod</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onStart}
        disabled={starting}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-500 py-2.5 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-950 transition-colors hover:bg-brand-400 active:scale-[0.99] disabled:opacity-60"
      >
        {starting ? 'açılıyor…' : 'indir'}
        {!starting && <span aria-hidden>→</span>}
      </button>
    </div>
  );
}

function Hint({ invalid }: { invalid: boolean }) {
  return (
    <div className="fx-rise rounded-md border border-dashed border-white/10 bg-ink-900/50 px-5 py-6 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
        {invalid ? 'geçersiz link' : 'vod bekleniyor'}
      </p>
      <p className="mx-auto mt-2 max-w-[260px] font-mono text-[10px] leading-relaxed tracking-wide text-dim">
        {invalid
          ? 'Bu bir Kick VOD linki değil.'
          : 'Bir Kick VOD linki yapıştır ya da bir VOD sayfasındayken aç.'}
        <br />
        <span className="text-brand-500/70">kick.com/kanal/videos/…</span>
      </p>
    </div>
  );
}
