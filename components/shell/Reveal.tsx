'use client'

import { motion, useReducedMotion } from 'motion/react'

export function Reveal({
  children,
  delay = 0,
  variant = 'rise',
}: {
  children: React.ReactNode
  delay?: number
  variant?: 'rise' | 'card'
}) {
  const reduced = useReducedMotion()
  if (reduced) return <>{children}</>

  const initial =
    variant === 'card' ? { opacity: 0, scale: 0.96, y: 10 } : { opacity: 0, y: 16 }
  const whileInView =
    variant === 'card' ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, y: 0 }

  return (
    <motion.div
      initial={initial}
      whileInView={whileInView}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
