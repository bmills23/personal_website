import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ICONS } from '@/scripts/icon-list.mjs'

const KNOWN_ICONS = new Set(ICONS)

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
  // name is interpolated into a file path and the result is inlined via
  // dangerouslySetInnerHTML, so it must be enforced against the known icon
  // list rather than merely trusted by convention: a future caller passing a
  // computed value must not be able to read an arbitrary local file.
  if (!KNOWN_ICONS.has(name)) {
    throw new Error(
      `Icon: unknown icon name "${name}". Add it to scripts/icon-list.mjs and run npm run icons first.`
    )
  }
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
