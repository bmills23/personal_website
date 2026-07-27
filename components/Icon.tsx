import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Server component: inlines the pre-sketched SVG so it inherits currentColor. */
export function Icon({
  name,
  size = 20,
  className = '',
}: {
  name: string
  size?: number
  className?: string
}) {
  const svg = readFileSync(join(process.cwd(), 'public', 'icons', `${name}.svg`), 'utf8')
    .replace(/width="[^"]*"/, `width="${size}"`)
    .replace(/height="[^"]*"/, `height="${size}"`)
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ display: 'inline-flex' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
