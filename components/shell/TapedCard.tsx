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
        className="absolute -top-3 left-8 h-4 w-14 bg-highlighter/60"
        style={{ transform: `rotate(var(${alt ? '--rotate' : '--rotate-alt'}))` }}
      />
      {children}
    </div>
  )
}
