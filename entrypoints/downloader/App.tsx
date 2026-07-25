import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Atmosphere, CropCorners, GlassMark, Wordmark } from '@/components/ui';
import { jobKey } from '@/lib/messaging';
import type { DownloadProgress, Rendition, VideoSource } from '@/lib/types';
import { formatBytes, formatDuration } from '@/lib/format';
import { runDownload } from '@/lib/engine/download';
import { PickerAbortError, pickFileSink, toFileName } from '@/lib/engine/sink';
import { fetchRenditions } from '@/lib/engine/playlist';

type Stage =
  | { k: 'loading' }
  | { k: 'missing' }
  | { k: 'resolving' }
  | { k: 'resolveError'; message: string }
  | { k: 'select' }
  | { k: 'running'; progress: DownloadProgress }
  | { k: 'done'; progress: DownloadProgress }
  | { k: 'error'; message: string }
  | { k: 'canceled' };

export default function App() {
  const [source, setSource] = useState<VideoSource | null>(null);
  const [renditions, setRenditions] = useState<Rendition[]>([]);
  const [selected, setSelected] = useState(0);
  const [stage, setStage] = useState<Stage>({ k: 'loading' });
  const [paused, setPaused] = useState(false);

  const controllerRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);
  const lastProgress = useRef<DownloadProgress | null>(null);

  const fileName = useMemo(() => toFileName(source?.title), [source?.title]);

  useEffect(() => {
    (async () => {
      const jobId = new URLSearchParams(location.search).get('job');
      if (!jobId) return setStage({ k: 'missing' });
      const rec = await browser.storage.session.get(jobKey(jobId));
      const s = rec[jobKey(jobId)] as VideoSource | undefined;
      if (!s) return setStage({ k: 'missing' });
      setSource(s);
      document.title = s.title ? `${s.title} · vodka` : 'vodka';
      setStage({ k: 'resolving' });
      try {
        const list = await fetchRenditions(s.masterUrl);
        if (list.length === 0) throw new Error('Kalite bulunamadı');
        setRenditions(list);
        setSelected(0);
        setStage({ k: 'select' });
      } catch (err) {
        setStage({ k: 'resolveError', message: describe(err) });
      }
    })();
  }, []);

  async function onDownload() {
    const rendition = renditions[selected];
    if (!rendition) return;

    let sink;
    try {
      sink = await pickFileSink(fileName);
    } catch (err) {
      if (err instanceof PickerAbortError) return; // user dismissed the dialog
      setStage({ k: 'error', message: describe(err) });
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    pausedRef.current = false;
    setPaused(false);
    lastProgress.current = null;
    setStage({ k: 'running', progress: initialProgress() });

    try {
      await runDownload({
        rendition,
        sink,
        signal: controller.signal,
        isPaused: () => pausedRef.current,
        onProgress: (p) => {
          lastProgress.current = p;
          setStage({ k: 'running', progress: p });
        },
      });
      setStage({ k: 'done', progress: lastProgress.current ?? initialProgress() });
    } catch (err) {
      await sink.abort();
      if (controller.signal.aborted) setStage({ k: 'canceled' });
      else setStage({ k: 'error', message: describe(err) });
    }
  }

  function togglePause() {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }

  function cancel() {
    controllerRef.current?.abort();
  }

  function backToSelect() {
    setStage({ k: 'select' });
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-ink-950">
      <Atmosphere />
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-8">
        <header className="mb-7 flex items-center justify-between">
          <Wordmark />
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-dim">
            downloader
          </span>
        </header>

        {source && stage.k !== 'missing' && <MetaHeader source={source} />}

        <div className="mt-6 flex-1">
          {stage.k === 'loading' && <Ghost label="yükleniyor" />}
          {stage.k === 'missing' && <Missing />}
          {stage.k === 'resolving' && <Ghost label="kaliteler çözümleniyor" />}
          {stage.k === 'resolveError' && (
            <Failure message={stage.message} onRetry={() => location.reload()} />
          )}
          {stage.k === 'select' && source && (
            <QualityPicker
              renditions={renditions}
              selected={selected}
              onSelect={setSelected}
              durationMs={source.durationMs}
              onDownload={onDownload}
            />
          )}
          {stage.k === 'running' && (
            <ProgressHud
              progress={stage.progress}
              rendition={renditions[selected]}
              paused={paused}
              onTogglePause={togglePause}
              onCancel={cancel}
            />
          )}
          {stage.k === 'done' && (
            <DoneCard progress={stage.progress} fileName={fileName} />
          )}
          {stage.k === 'error' && (
            <Failure message={stage.message} onRetry={backToSelect} />
          )}
          {stage.k === 'canceled' && <Canceled onRetry={backToSelect} />}
        </div>

        <footer className="mt-8 border-t border-white/5 pt-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-dim">
            constant-memory hls → mp4 · kendi içeriğin için
          </p>
        </footer>
      </div>
    </div>
  );
}

/* ── Sections ──────────────────────────────────────────────────────────── */

function MetaHeader({ source }: { source: VideoSource }) {
  return (
    <div className="fx-rise flex gap-4">
      <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-md border border-white/10 bg-ink-850">
        {source.thumbnail ? (
          <img src={source.thumbnail} alt="" className="size-full object-cover" />
        ) : (
          <div className="size-full bg-gradient-to-br from-ink-800 to-ink-900" />
        )}
        <CropCorners />
      </div>
      <div className="min-w-0 flex-1 self-center">
        <h1 className="line-clamp-2 text-lg font-semibold leading-snug text-fg">
          {source.title ?? 'Kick VOD'}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1 rounded-full bg-brand-500" />
            {source.target.slug}
          </span>
          {source.durationMs !== undefined && (
            <span className="tabular-nums">{formatDuration(source.durationMs)}</span>
          )}
          <span className="text-dim">mp4</span>
        </div>
      </div>
    </div>
  );
}

function QualityPicker({
  renditions,
  selected,
  onSelect,
  durationMs,
  onDownload,
}: {
  renditions: Rendition[];
  selected: number;
  onSelect: (i: number) => void;
  durationMs?: number;
  onDownload: () => void;
}) {
  return (
    <div className="fx-rise">
      <SectionLabel>kalite seç</SectionLabel>
      <ul className="mt-3 space-y-2">
        {renditions.map((r, i) => {
          const active = i === selected;
          const est = estimateBytes(r.bandwidth, durationMs);
          return (
            <li key={r.uri}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                className={[
                  'flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition',
                  active
                    ? 'glow-ring border-brand-500/50 bg-brand-500/[0.06]'
                    : 'border-white/10 bg-ink-900/40 hover:border-white/20 hover:bg-ink-900',
                ].join(' ')}
              >
                <span
                  className={[
                    'grid size-4 shrink-0 place-items-center rounded-full border',
                    active ? 'border-brand-500' : 'border-ink-600',
                  ].join(' ')}
                >
                  {active && <span className="size-2 rounded-full bg-brand-500" />}
                </span>
                <span className="flex-1">
                  <span className="font-mono text-[15px] font-semibold uppercase tracking-wide text-fg">
                    {r.label}
                  </span>
                  {r.width && r.height && (
                    <span className="ml-2 font-mono text-[11px] tabular-nums text-dim">
                      {r.width}×{r.height}
                    </span>
                  )}
                </span>
                <span className="text-right font-mono text-[11px] tabular-nums leading-tight text-muted">
                  {r.bandwidth > 0 && (
                    <span className="block text-fg">
                      {(r.bandwidth / 1_000_000).toFixed(1)} Mbps
                    </span>
                  )}
                  <span className="text-dim">
                    {est !== undefined ? `~${formatBytes(est)}` : '—'}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onDownload}
        className="group mt-5 flex w-full items-center justify-center gap-2.5 rounded-md bg-brand-500 py-3.5 font-mono text-[13px] font-semibold uppercase tracking-[0.18em] text-ink-950 transition hover:bg-brand-400 active:scale-[0.995]"
      >
        <GlassMark className="size-4" />
        kaydet &amp; indir
      </button>
      <p className="mt-2.5 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-dim">
        kayıt konumu sorulacak · sekmeyi açık tut
      </p>
    </div>
  );
}

function ProgressHud({
  progress,
  rendition,
  paused,
  onTogglePause,
  onCancel,
}: {
  progress: DownloadProgress;
  rendition?: Rendition;
  paused: boolean;
  onTogglePause: () => void;
  onCancel: () => void;
}) {
  const pct = Math.round(progress.fraction * 100);
  const indeterminate = progress.phase === 'resolving' || progress.segmentsTotal === 0;
  const phaseLabel = paused
    ? 'duraklatıldı'
    : progress.phase === 'finalizing'
      ? 'sonlandırılıyor'
      : progress.phase === 'resolving'
        ? 'çözümleniyor'
        : 'kayıt';

  return (
    <div className="fx-rise">
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          <span
            className={[
              'size-2 rounded-full',
              paused ? 'bg-signal-amber' : 'fx-rec bg-brand-500',
            ].join(' ')}
          />
          <SectionLabel>{phaseLabel}</SectionLabel>
          {rendition && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-dim">
              · {rendition.label}
            </span>
          )}
        </div>
        <span className="text-glow font-mono text-3xl font-semibold tabular-nums text-brand-500">
          {indeterminate ? '··' : pct}
          <span className="text-lg text-muted">%</span>
        </span>
      </div>

      <div className="fx-scan relative mt-3 h-2.5 w-full overflow-hidden rounded-full bg-ink-850">
        {indeterminate ? (
          <div className="fx-sweep absolute inset-y-0 left-0 w-1/3 rounded-full bg-brand-500/80" />
        ) : (
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-[width] duration-300 ease-out"
            style={{ width: `${Math.max(pct, 1)}%`, boxShadow: '0 0 14px -2px var(--color-brand-500)' }}
          />
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="segment"
          value={`${progress.segmentsDone}`}
          sub={`/ ${progress.segmentsTotal || '—'}`}
        />
        <Stat label="hız" value={formatBytes(progress.bytesPerSecond)} sub="/s" />
        <Stat
          label="kalan"
          value={
            progress.etaSeconds !== undefined && !paused
              ? formatDuration(progress.etaSeconds * 1000)
              : '—'
          }
        />
        <Stat label="boyut" value={formatBytes(progress.bytesWritten)} />
      </div>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={onTogglePause}
          className="flex-1 rounded-md border border-white/12 bg-ink-900 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fg transition hover:border-white/25 hover:bg-ink-800"
        >
          {paused ? 'devam' : 'duraklat'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border border-signal-red/30 bg-signal-red/[0.06] py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-signal-red transition hover:bg-signal-red/10"
        >
          iptal
        </button>
      </div>
    </div>
  );
}

function DoneCard({
  progress,
  fileName,
}: {
  progress: DownloadProgress;
  fileName: string;
}) {
  return (
    <div className="fx-rise rounded-md border border-brand-500/30 bg-brand-500/[0.04] p-8 text-center">
      <div className="glow-ring mx-auto grid size-14 place-items-center rounded-full border border-brand-500/40 text-brand-500">
        <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <p className="text-glow mt-4 font-mono text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">
        indirildi
      </p>
      <p className="mx-auto mt-2 max-w-sm truncate font-mono text-[12px] text-fg">
        {fileName}
      </p>
      <p className="mt-1 font-mono text-[11px] tabular-nums text-dim">
        {formatBytes(progress.bytesWritten)} · {progress.segmentsTotal} segment
      </p>
      <button
        type="button"
        onClick={() => window.close()}
        className="mt-6 rounded-md border border-white/12 bg-ink-900 px-6 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fg transition hover:border-white/25 hover:bg-ink-800"
      >
        kapat
      </button>
    </div>
  );
}

function Failure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="fx-rise rounded-md border border-signal-red/30 bg-signal-red/[0.04] p-8 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-full border border-signal-red/40 text-signal-red">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </div>
      <p className="mt-4 font-mono text-sm font-semibold uppercase tracking-[0.18em] text-signal-red">
        hata
      </p>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 rounded-md border border-white/12 bg-ink-900 px-6 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fg transition hover:border-white/25 hover:bg-ink-800"
      >
        tekrar dene
      </button>
    </div>
  );
}

function Canceled({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="fx-rise rounded-md border border-white/10 bg-ink-900/40 p-8 text-center">
      <p className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-muted">
        iptal edildi
      </p>
      <p className="mt-2 text-[13px] text-dim">İndirme durduruldu, dosya kaydedilmedi.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 rounded-md border border-white/12 bg-ink-900 px-6 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fg transition hover:border-white/25 hover:bg-ink-800"
      >
        yeniden
      </button>
    </div>
  );
}

function Missing() {
  return (
    <div className="fx-rise rounded-md border border-dashed border-white/10 bg-ink-900/40 p-10 text-center">
      <p className="font-mono text-sm uppercase tracking-[0.18em] text-muted">
        iş bulunamadı
      </p>
      <p className="mt-2 text-[13px] text-dim">
        Bu sayfayı Vodka popup'ından “İndir” diyerek aç.
      </p>
    </div>
  );
}

/* ── Primitives ────────────────────────────────────────────────────────── */

function Ghost({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="fx-scan h-2.5 w-64 max-w-full overflow-hidden rounded-full bg-ink-850">
        <div className="fx-sweep h-full w-1/3 rounded-full bg-brand-500/70" />
      </div>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.24em] text-dim">
        {label}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-white/8 bg-ink-900/40 px-3 py-2.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-dim">
        {label}
      </div>
      <div className="mt-1 font-mono text-[15px] font-semibold tabular-nums text-fg">
        {value}
        {sub && <span className="ml-1 text-[11px] font-normal text-dim">{sub}</span>}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
      {children}
    </span>
  );
}

/* ── helpers ───────────────────────────────────────────────────────────── */

function estimateBytes(bandwidth: number, durationMs?: number): number | undefined {
  if (!bandwidth || !durationMs) return undefined;
  return (bandwidth * (durationMs / 1000)) / 8;
}

function initialProgress(): DownloadProgress {
  return {
    phase: 'resolving',
    segmentsDone: 0,
    segmentsTotal: 0,
    bytesDownloaded: 0,
    bytesWritten: 0,
    bytesPerSecond: 0,
    fraction: 0,
  };
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
