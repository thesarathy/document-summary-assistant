interface DocumentGlyphProps {
  scanning?: boolean;
  className?: string;
}

/** A minimal page glyph. When `scanning`, a line sweeps down it — the app's
 * signature processing indicator, standing in for a generic spinner. */
export function DocumentGlyph({ scanning = false, className = "" }: DocumentGlyphProps) {
  return (
    <div className={`relative w-14 h-[4.5rem] ${className}`} aria-hidden="true">
      <svg viewBox="0 0 56 72" fill="none" className="w-full h-full">
        <path
          d="M8 4h30l10 10v54a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
          stroke="var(--color-ink-muted)"
          strokeWidth="1.5"
          fill="var(--color-paper-raised)"
        />
        <path d="M38 4v10h10" stroke="var(--color-ink-muted)" strokeWidth="1.5" />
        <line x1="14" y1="30" x2="42" y2="30" stroke="var(--color-line)" strokeWidth="2" />
        <line x1="14" y1="38" x2="42" y2="38" stroke="var(--color-line)" strokeWidth="2" />
        <line x1="14" y1="46" x2="34" y2="46" stroke="var(--color-line)" strokeWidth="2" />
        <line x1="14" y1="54" x2="38" y2="54" stroke="var(--color-line)" strokeWidth="2" />
      </svg>
      {scanning && (
        <div
          className="scan-line absolute left-0.5 right-0.5 h-6 rounded-sm pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent, color-mix(in srgb, var(--color-accent) 35%, transparent), transparent)",
          }}
        />
      )}
    </div>
  );
}
