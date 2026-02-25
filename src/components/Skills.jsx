import { motion } from 'framer-motion'
import { useInView } from '../hooks/useInView'
import { skills } from '../data/content'
import SectionHeader from './SectionHeader'

function getBarColor(level) {
  if (level >= 85) return 'from-primary to-secondary'
  if (level >= 70) return 'from-primary to-primary'
  if (level >= 55) return 'from-secondary to-secondary'
  return 'from-info to-info'
}

function SkillBar({ name, level, label, delay }) {
  const [ref, isInView] = useInView({ threshold: 0.1 })

  return (
    <div ref={ref} className="mb-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm text-text-primary">{name}</span>
        <span className="font-mono text-xs text-text-muted">{level}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-elevated">
        <motion.div
          initial={{ width: 0 }}
          animate={isInView ? { width: `${level}%` } : { width: 0 }}
          transition={{ duration: 1, delay, ease: 'easeOut' }}
          className={`h-full rounded-full bg-gradient-to-r ${getBarColor(level)}`}
        />
      </div>
      <span className="mt-1 inline-block font-mono text-xs text-text-muted">{label}</span>
    </div>
  )
}

export default function Skills() {
  return (
    <section id="skills" className="bg-surface px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          label="Skills"
          title="What I Work With"
          description="Technologies and tools I use to build great software."
        />

        <div className="grid gap-8 md:grid-cols-3">
          {skills.map((category, ci) => (
            <motion.div
              key={category.category}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: ci * 0.15, duration: 0.5 }}
              className="rounded-2xl border border-border bg-card-bg p-6 backdrop-blur-sm"
            >
              <h3 className="mb-6 font-heading text-lg font-semibold">
                {category.category}
              </h3>
              {category.items.map((skill, si) => (
                <SkillBar
                  key={skill.name}
                  {...skill}
                  delay={0.1 + si * 0.08}
                />
              ))}
            </motion.div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <div className="h-2 w-6 rounded-full bg-gradient-to-r from-primary to-secondary" />
            <span>Expert (85%+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-6 rounded-full bg-primary" />
            <span>Advanced (70-84%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-6 rounded-full bg-secondary" />
            <span>Proficient (55-69%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-6 rounded-full bg-info" />
            <span>Working Knowledge</span>
          </div>
        </div>
      </div>
    </section>
  )
}
