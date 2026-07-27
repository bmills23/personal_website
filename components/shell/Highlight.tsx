export function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        backgroundImage:
          'linear-gradient(transparent 62%, var(--color-highlighter) 62%)',
      }}
    >
      {children}
    </span>
  )
}
