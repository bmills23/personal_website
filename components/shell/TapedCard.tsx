export function TapedCard({
  children,
  alt = false,
  className = '',
}: {
  children: React.ReactNode
  alt?: boolean
  className?: string
}) {
  return (
    <div
      className={`relative rounded-sm border border-card-border bg-card p-5 shadow-[2px_3px_0_rgba(32,36,43,0.07)] sm:p-6 ${className}`}
      style={{ transform: `rotate(var(${alt ? '--rotate-alt' : '--rotate'}))` }}
    >
      <span
        aria-hidden="true"
        className="absolute -top-3 left-8 h-4 w-16"
        style={{
          transform: `rotate(var(${alt ? '--rotate' : '--rotate-alt'}))`,
          // Theme tokens via color-mix rather than literal rgba, so the tape
          // tracks --color-highlighter / --color-card-border if those change.
          background:
            'linear-gradient(90deg, color-mix(in srgb, var(--color-highlighter) 15%, transparent) 0%, color-mix(in srgb, var(--color-highlighter) 50%, transparent) 12%, color-mix(in srgb, var(--color-highlighter) 50%, transparent) 88%, color-mix(in srgb, var(--color-highlighter) 15%, transparent) 100%)',
          boxShadow:
            'inset 0 0 0 1px color-mix(in srgb, var(--color-card-border) 35%, transparent)',
        }}
      />
      {children}
    </div>
  )
}
