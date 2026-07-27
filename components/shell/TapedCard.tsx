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
          background:
            'linear-gradient(90deg, rgba(242,220,150,0.15) 0%, rgba(242,220,150,0.5) 12%, rgba(242,220,150,0.5) 88%, rgba(242,220,150,0.15) 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(203,215,221,0.35)',
        }}
      />
      {children}
    </div>
  )
}
