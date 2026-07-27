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
      <div className="absolute inset-y-0 left-10 w-px bg-margin-rule opacity-60 sm:left-16" />
    </div>
  )
}
