import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ICONS } from './icon-list.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'icons')
mkdirSync(out, { recursive: true })

// Phosphor ships raw SVG in @phosphor-icons/core under assets/<weight>/<name>.svg
const source = join(root, 'node_modules', '@phosphor-icons', 'core', 'assets', 'regular')

for (const name of ICONS) {
  const file = join(source, `${name}.svg`)
  if (!existsSync(file)) {
    console.error(`missing phosphor icon: ${name} (looked in ${file})`)
    process.exit(1)
  }
  const raw = readFileSync(file, 'utf8')
  writeFileSync(join(out, `${name}.svg`), roughen(raw))
  console.log(`icon  ${name}`)
}

/**
 * Applies a hand-drawn treatment. Phosphor icons are filled paths, so rather
 * than re-stroking them through RoughJS's canvas API (which needs a DOM), we
 * run the artwork through an SVG displacement filter for a slight jitter.
 * This keeps the build dependency-light and deterministic.
 */
function roughen(svg) {
  const filter = `<filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="9" xChannelSelector="R" yChannelSelector="G"/></filter>`

  let out = svg.replace(/fill="#[0-9a-fA-F]{3,6}"/g, 'fill="currentColor"')

  // Phosphor's raw assets carry a viewBox but no explicit width/height
  // attribute. components/Icon.tsx resizes icons by string-replacing
  // width="..."/height="..." on the root <svg>, so those attributes must
  // exist here or the size prop silently does nothing.
  if (!/\swidth="/.test(out)) {
    out = out.replace(/<svg([^>]*)>/, '<svg$1 width="256" height="256">')
  }

  return out
    .replace(/<svg([^>]*)>/, `<svg$1><defs>${filter}</defs><g filter="url(#rough)">`)
    .replace('</svg>', '</g></svg>')
    .replace(/<svg(?![^>]*fill=)([^>]*)>/, '<svg$1 fill="currentColor">')
}
