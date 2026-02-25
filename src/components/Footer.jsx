import { socialLinks } from '../data/content'
import SocialIcon from './SocialIcon'

export default function Footer() {
  return (
    <footer className="border-t border-border px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-4">
          {socialLinks.map(link => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted transition-colors hover:text-primary"
            >
              <SocialIcon name={link.name} size={18} />
            </a>
          ))}
        </div>

        <p className="text-sm text-text-muted">
          &copy; {new Date().getFullYear()} Bryan Mills. Built with React + Tailwind CSS.
        </p>
      </div>
    </footer>
  )
}
