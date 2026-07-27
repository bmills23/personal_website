export function MarginNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-hand text-lg text-pencil"
      style={{ transform: 'rotate(-2deg)' }}
    >
      {children}
    </p>
  )
}
