import { motion } from 'framer-motion'
import { Briefcase, Rocket, GraduationCap, MapPin } from 'lucide-react'
import { useInView } from '../hooks/useInView'
import { personalInfo, interests } from '../data/content'
import SectionHeader from './SectionHeader'

const highlights = [
  { icon: Briefcase, label: 'Full-Stack', desc: 'End-to-end development' },
  { icon: Rocket, label: 'Builder', desc: 'Shipping products' },
  { icon: GraduationCap, label: 'Learner', desc: 'Always growing' },
  { icon: MapPin, label: 'Remote', desc: 'Work from anywhere' },
]

export default function About() {
  const [ref, isInView] = useInView({ threshold: 0.1 })

  return (
    <section id="about" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          label="About"
          title="Who I Am"
          description="A little bit about my background and what drives me."
        />

        <div ref={ref} className="grid gap-12 md:grid-cols-5">
          {/* Left column */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="md:col-span-2"
          >
            {/* Quote card */}
            <div className="rounded-2xl border border-border bg-card-bg p-6 backdrop-blur-sm">
              <p className="font-mono text-sm italic text-text-secondary">
                {personalInfo.quote}
              </p>
            </div>

            {/* Highlight cards */}
            <div className="mt-6 grid grid-cols-2 gap-4">
              {highlights.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
                  className="rounded-xl border border-border bg-card-bg p-4 backdrop-blur-sm"
                >
                  <item.icon size={20} className="mb-2 text-primary" />
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-text-muted">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right column - bio */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="md:col-span-3"
          >
            <div className="space-y-4">
              {personalInfo.bio.map((paragraph, i) => (
                <p key={i} className="leading-relaxed text-text-secondary">
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Interests */}
            <div className="mt-8">
              <h3 className="mb-4 font-heading text-lg font-semibold">Interests</h3>
              <div className="flex flex-wrap gap-2">
                {interests.map(interest => (
                  <span
                    key={interest}
                    className="rounded-full border border-border bg-surface-elevated px-3 py-1 font-mono text-xs text-text-secondary"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
