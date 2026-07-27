'use client'

import { useEffect, useRef, useState } from 'react'
import { DrawnUnderline } from './DrawnUnderline'

/**
 * A section heading that writes itself in on scroll. Header text is
 * database-driven and editable, so a genuine stroke-drawn handwriting effect
 * (pre-computed SVG paths per glyph) is not possible here; instead the text
 * gets an ink-wipe clip-path reveal while the fixed-path DrawnUnderline gets
 * a real stroke-dashoffset draw.
 *
 * The text itself is a plain child of a plain heading tag: it is present in
 * the server-rendered HTML, the accessibility tree, and is selectable,
 * whether or not the animation ever runs. The animation is CSS-only and
 * gated on a `.js-ready` class added by an inline script in the document
 * head (see app/layout.tsx), and the hidden state lives inside a
 * `prefers-reduced-motion: no-preference` media query (see app/globals.css).
 * That means: no JavaScript -> no js-ready class -> no clip-path -> normal
 * visible text, and reduced motion -> no clip-path -> normal visible text.
 * Do not move the clipping into a motion `initial` prop; that would
 * server-render the hidden state into the HTML.
 */
export function WrittenHeading({
  children,
  as: Tag = 'h2',
  underline = true,
  className = '',
}: {
  children: React.ReactNode
  as?: 'h1' | 'h2' | 'h3'
  underline?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [written, setWritten] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || written) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setWritten(true)
          observer.disconnect()
        }
      },
      { rootMargin: '-60px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [written])

  return (
    <div ref={ref} data-write data-written={written ? 'true' : undefined}>
      <Tag className={className}>
        <span className="write-ink inline-block">{children}</span>
      </Tag>
      {underline ? <DrawnUnderline /> : null}
    </div>
  )
}
