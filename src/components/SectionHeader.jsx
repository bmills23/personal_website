import { motion } from 'framer-motion'
import { useInView } from '../hooks/useInView'

export default function SectionHeader({ label, title, description }) {
  const [ref, isInView] = useInView({ threshold: 0.2 })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6 }}
      className="mb-16 text-center"
    >
      <span className="mb-4 inline-block font-mono text-sm uppercase tracking-wider text-primary">
        {label}
      </span>
      <h2 className="mb-4 font-heading text-3xl font-bold md:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mx-auto max-w-2xl text-text-secondary">{description}</p>
      )}
      <div className="mx-auto mt-6 h-1 w-16 rounded-full bg-gradient-to-r from-primary to-secondary" />
    </motion.div>
  )
}
