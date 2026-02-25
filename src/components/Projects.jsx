import { motion } from 'framer-motion'
import { ExternalLink, Star } from 'lucide-react'
import { projects } from '../data/content'
import SectionHeader from './SectionHeader'

function ProjectCard({ project, index }) {
  return (
    <motion.a
      href={project.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      whileHover={{ scale: 1.01 }}
      className="block rounded-2xl border border-border bg-card-bg p-6 backdrop-blur-sm transition-colors hover:border-primary"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-heading text-lg font-semibold">{project.title}</h3>
        <div className="flex items-center gap-2">
          {project.featured && (
            <Star size={16} className="fill-secondary text-secondary" />
          )}
          <ExternalLink size={16} className="text-text-muted" />
        </div>
      </div>

      <p className="mb-4 text-sm text-text-secondary">{project.description}</p>

      <div className="flex flex-wrap gap-2">
        {project.tech.map(t => (
          <span
            key={t}
            className="rounded-full border border-border bg-surface-elevated px-2 py-0.5 font-mono text-xs text-text-muted"
          >
            {t}
          </span>
        ))}
      </div>
    </motion.a>
  )
}

export default function Projects() {
  const featured = projects.filter(p => p.featured)
  const other = projects.filter(p => !p.featured)

  return (
    <section id="projects" className="bg-surface px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          label="Projects"
          title="What I've Built"
          description="Featured projects and side experiments."
        />

        {/* Featured projects */}
        <div className="mb-8 grid gap-6 md:grid-cols-2">
          {featured.map((p, i) => (
            <ProjectCard key={p.title} project={p} index={i} />
          ))}
        </div>

        {/* Other projects */}
        {other.length > 0 && (
          <div className="grid gap-6 md:grid-cols-3">
            {other.map((p, i) => (
              <ProjectCard key={p.title} project={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
