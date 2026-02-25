import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowDown, Mail } from 'lucide-react'
import { personalInfo, socialLinks } from '../data/content'
import SocialIcon from './SocialIcon'

export default function Hero() {
  const [typedText, setTypedText] = useState('')
  const [showCursor, setShowCursor] = useState(true)

  useEffect(() => {
    const text = personalInfo.tagline
    let i = 0
    const interval = setInterval(() => {
      if (i <= text.length) {
        setTypedText(text.slice(0, i))
        i++
      } else {
        clearInterval(interval)
      }
    }, 35)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setShowCursor(c => !c), 530)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-secondary/5 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Avatar placeholder */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.8 }}
          className="mx-auto mb-8 h-32 w-32 overflow-hidden rounded-full ring-4 ring-primary-glow"
        >
          <div className="flex h-full w-full items-center justify-center bg-surface-elevated font-heading text-3xl font-bold text-primary">
            BM
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <h1 className="mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text font-heading text-5xl font-bold text-transparent md:text-7xl">
            {personalInfo.name}
          </h1>
          <p className="mb-6 font-heading text-xl font-light text-text-secondary md:text-2xl">
            {personalInfo.title}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mb-8 h-8"
        >
          <span className="font-mono text-text-secondary">
            {typedText}
            <span className={`${showCursor ? 'opacity-100' : 'opacity-0'} text-primary`}>|</span>
          </span>
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="mb-8 flex flex-wrap items-center justify-center gap-4"
        >
          <a
            href="#contact"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
          >
            <Mail size={18} />
            Get in Touch
          </a>
          <a
            href="#projects"
            className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 font-medium text-text-secondary transition-colors hover:border-primary hover:text-primary"
          >
            View Projects
          </a>
        </motion.div>

        {/* Social links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mb-12 flex items-center justify-center gap-4"
        >
          {socialLinks.map(link => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted transition-colors hover:text-primary"
            >
              <SocialIcon name={link.name} size={22} />
            </a>
          ))}
        </motion.div>

        {/* Scroll indicator */}
        <motion.a
          href="#about"
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="inline-block text-text-muted"
        >
          <ArrowDown size={24} />
        </motion.a>
      </div>
    </section>
  )
}
