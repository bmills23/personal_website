import { motion } from 'framer-motion'
import { Mail, MapPin, ArrowUpRight } from 'lucide-react'
import { useInView } from '../hooks/useInView'
import { personalInfo, socialLinks } from '../data/content'
import SocialIcon from './SocialIcon'
import SectionHeader from './SectionHeader'

const contactCards = [
  {
    icon: Mail,
    label: 'Email',
    value: personalInfo.email,
    href: `mailto:${personalInfo.email}`,
  },
  {
    icon: MapPin,
    label: 'Location',
    value: personalInfo.location,
    href: null,
  },
]

export default function Contact() {
  const [ref, isInView] = useInView({ threshold: 0.1 })

  return (
    <section id="contact" className="bg-surface px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          label="Contact"
          title="Get in Touch"
          description="I'm always open to new opportunities and interesting conversations."
        />

        <div ref={ref} className="grid gap-8 md:grid-cols-2">
          {/* Contact cards */}
          <div className="space-y-4">
            {contactCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, x: -20 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.1 + i * 0.1, duration: 0.5 }}
              >
                {card.href ? (
                  <a
                    href={card.href}
                    target={card.href.startsWith('mailto') ? undefined : '_blank'}
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-border bg-card-bg p-4 backdrop-blur-sm transition-colors hover:border-primary"
                  >
                    <div className="flex items-center gap-4">
                      <card.icon size={20} className="text-primary" />
                      <div>
                        <p className="text-xs text-text-muted">{card.label}</p>
                        <p className="text-sm font-medium">{card.value}</p>
                      </div>
                    </div>
                    <ArrowUpRight size={16} className="text-text-muted" />
                  </a>
                ) : (
                  <div className="flex items-center gap-4 rounded-xl border border-border bg-card-bg p-4 backdrop-blur-sm">
                    <card.icon size={20} className="text-primary" />
                    <div>
                      <p className="text-xs text-text-muted">{card.label}</p>
                      <p className="text-sm font-medium">{card.value}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Social links + CTA */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex flex-col justify-between"
          >
            <div className="mb-6 grid grid-cols-2 gap-4">
              {socialLinks.map(link => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-border bg-card-bg p-4 backdrop-blur-sm transition-colors hover:border-primary"
                >
                  <SocialIcon name={link.name} size={20} />
                  <span className="text-sm capitalize">{link.name}</span>
                </a>
              ))}
            </div>

            <a
              href={`mailto:${personalInfo.email}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-6 py-4 text-lg font-medium text-white transition-opacity hover:opacity-90"
            >
              <Mail size={20} />
              Send me an email
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
