/** Full-bleed atmosphere layer: neon bloom + film grain, behind content. */
export function Atmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="fx-bloom absolute inset-0" />
      <div className="fx-grain absolute inset-0" />
    </div>
  );
}

/** The mark: a martini glass that doubles as a download/play triangle. */
export function GlassMark({ className = 'size-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4h16l-8 9-8-9Z" />
      <path d="M12 13v6" />
      <path d="M7.5 20h9" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="glow-ring text-glow grid size-9 place-items-center rounded-md border border-brand-500/30 bg-ink-900 text-brand-500">
        <GlassMark className="size-5" />
      </span>
      <div className="leading-none">
        <div className="text-glow font-mono text-[15px] font-semibold uppercase tracking-[0.22em] text-fg">
          vodka
        </div>
        {!compact && (
          <div className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.34em] text-dim">
            kick vod capture
          </div>
        )}
      </div>
    </div>
  );
}

/** Decorative viewfinder corner ticks around a framed element. */
export function CropCorners() {
  const base = 'absolute size-3 border-brand-500/50';
  return (
    <>
      <span className={`${base} left-0 top-0 border-l border-t`} />
      <span className={`${base} right-0 top-0 border-r border-t`} />
      <span className={`${base} bottom-0 left-0 border-b border-l`} />
      <span className={`${base} bottom-0 right-0 border-b border-r`} />
    </>
  );
}
