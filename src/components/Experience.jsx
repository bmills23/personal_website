import { motion } from 'framer-motion'
import { Briefcase, GraduationCap } from 'lucide-react'
import { useInView } from '../hooks/useInView'
import { experience } from '../data/content'
import SectionHeader from './SectionHeader'

function TimelineItem({ item, index }) {
  const [ref, isInView] = useInView({ threshold: 0.1 })
  const isEducation = item.role.includes('B.S.') || item.role.includes('B.A.')
  const Icon = isEducation ? GraduationCap : Briefcase

  return (
    <div ref={ref} className="relative pl-8 pb-12 last:pb-0">
      {/* Timeline line */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />

      {/* Timeline dot */}
      <motion.div
        initial={{ scale: 0 }}
        animate={isInView ? { scale: 1 } : {}}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="absolute -left-3 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary bg-bg"
      >
        <Icon size={12} className="text-primary" />
      </motion.div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={isInView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="mb-2">
          <h3 className="font-heading text-lg font-semibold">{item.role}</h3>
          <p className="text-primary">{item.company}</p>
        </div>
        <div className="mb-3 flex flex-wrap gap-3 font-mono text-xs text-text-muted">
          <span>{item.period}</span>
          <span>{item.location}</span>
        </div>
        <p className="mb-3 text-sm text-text-secondary">{item.description}</p>

        {item.highlights && (
          <ul className="mb-4 space-y-1">
            {item.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                {h}
              </li>
            ))}
          </ul>
        )}

        {item.tech && (
          <div className="flex flex-wrap gap-2">
            {item.tech.map(t => (
              <span
                key={t}
                className="rounded-full border border-border bg-surface-elevated px-2 py-0.5 font-mono text-xs text-text-muted"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}

export default function Experience() {
  return (
    <section id="experience" className="px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <SectionHeader
          label="Experience"
          title="Where I've Been"
          description="My professional journey and education."
        />

        <div>
          {experience.map((item, i) => (
            <TimelineItem key={i} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
