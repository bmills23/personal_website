'use client'

import { motion, useReducedMotion } from 'motion/react'

export function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode
  delay?: number
}) {
  const reduced = useReducedMotion()
  if (reduced) return <>{children}</>
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
