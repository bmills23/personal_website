export function PaperBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(var(--color-grid) 1px, transparent 1px), linear-gradient(90deg, var(--color-grid) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      />
      {/* The margin rule belongs to the page's text column, not the window. */}
      <div className="relative mx-auto h-full w-full max-w-4xl">
        <div className="absolute inset-y-0 left-2.5 w-px bg-margin-rule opacity-70 sm:left-4" />
      </div>
    </div>
  )
}
