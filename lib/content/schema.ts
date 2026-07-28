import { z } from 'zod'

/**
 * Max lengths for every array in the content document, keyed by the dotted
 * path to that array (with any intermediate index segments dropped). This is
 * the single source of truth: the schema's `.max()` calls below reference
 * these same constants, and `lib/content/paths.ts` reads this object to
 * bound the array indices it accepts in an editable path. Changing a limit
 * here changes both what the schema accepts and what the allowlist accepts,
 * so the two cannot desync.
 */
export const ARRAY_LIMITS = {
  products: 6,
  tracks: 3,
  'about.paragraphs': 5,
  'products.tags': 8,
  'products.links': 4,
  'footer.links': 6,
  'tracks.entries': 10,
  'hero.highlights': 4,
} as const

const linkSchema = z.object({
  label: z.string().min(1).max(60),
  url: z.url({ protocol: /^https?$/ }),
})

export const productSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(60),
  tagline: z.string().min(1).max(120),
  body: z.string().min(1).max(600),
  tags: z.array(z.string().min(1).max(30)).max(ARRAY_LIMITS['products.tags']),
  links: z.array(linkSchema).max(ARRAY_LIMITS['products.links']),
})

export const trackEntrySchema = z.object({
  id: z.string().min(1).max(40),
  org: z.string().min(1).max(80),
  role: z.string().min(1).max(80),
  period: z.string().min(1).max(40),
  body: z.string().max(600),
})

const trackSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(60),
  entries: z.array(trackEntrySchema).max(ARRAY_LIMITS['tracks.entries']),
})

export const contentSchema = z.object({
  version: z.literal(1),
  hero: z.object({
    kicker: z.string().min(1).max(80),
    name: z.string().min(1).max(60),
    lede: z.string().min(1).max(400),
    stamp: z.string().min(1).max(20),
    highlights: z.array(z.string().min(1).max(60)).max(ARRAY_LIMITS['hero.highlights']),
  }),
  about: z.object({
    heading: z.string().min(1).max(80),
    paragraphs: z.array(z.string().min(1).max(800)).min(1).max(ARRAY_LIMITS['about.paragraphs']),
    marginNote: z.string().max(80),
  }),
  products: z.array(productSchema).max(ARRAY_LIMITS.products),
  tracks: z.array(trackSchema).max(ARRAY_LIMITS.tracks),
  contact: z.object({
    heading: z.string().min(1).max(80),
    blurb: z.string().max(400),
  }),
  footer: z.object({
    note: z.string().max(120),
    links: z.array(linkSchema).max(ARRAY_LIMITS['footer.links']),
  }),
  sections: z.object({
    products: z.object({ kicker: z.string().min(1).max(60) }),
    work: z.object({ kicker: z.string().min(1).max(60) }),
  }),
})

export type Content = z.infer<typeof contentSchema>
