export function Stamp({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block rounded-sm border-2 border-stamp px-2.5 py-1.5 font-body text-[10px] tracking-[0.16em] text-stamp opacity-80"
      style={{ transform: 'rotate(6deg)' }}
    >
      {children}
    </span>
  )
}
