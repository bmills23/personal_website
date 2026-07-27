'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Scroll-triggered reveal for About, product cards, and work tracks. Follows
 * the exact pattern proven in components/shell/WrittenHeading.tsx: a plain
 * div carrying a `data-reveal` marker is always present, in the server-
 * rendered HTML, the accessibility tree, and the DOM whether or not the
 * animation ever runs. The hidden state and the transition are CSS-only,
 * defined in app/globals.css, gated on a `.js-ready` class added by the
 * inline head script (see app/layout.tsx) and nested inside
 * `prefers-reduced-motion: no-preference`. No JavaScript -> no js-ready
 * class -> no hidden style -> content renders normally. Reduced motion ->
 * the hidden style never applies -> content renders normally. Do not move
 * the hidden state into an inline style or a motion `initial` prop; that
 * would server-render the hidden state into the HTML (this is the exact
 * defect this component previously had, using framer-motion, before this
 * rewrite; see the final whole-branch review for the full writeup).
 *
 * `data-revealed` flips from unset to `'true'` once, via IntersectionObserver,
 * the same trigger WrittenHeading uses, so the fade/rise/scale-in only ever
 * plays forward.
 */
export function Reveal({
  children,
  delay = 0,
  variant = 'rise',
}: {
  children: React.ReactNode
  delay?: number
  variant?: 'rise' | 'card'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || revealed) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { rootMargin: '-60px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [revealed])

  return (
    <div
      ref={ref}
      data-reveal={variant}
      data-revealed={revealed ? 'true' : undefined}
      // The only inline style this ever carries is a timing variable, never
      // a hiding style: --reveal-delay is read by the CSS transition in
      // globals.css and has no effect on visibility by itself. Omitted
      // entirely when delay is 0 so the default case has no style attribute
      // at all.
      style={delay ? ({ '--reveal-delay': `${delay}s` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  )
}
