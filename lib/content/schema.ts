import { z } from 'zod'

const linkSchema = z.object({
  label: z.string().min(1).max(60),
  url: z.url(),
})

const productSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(60),
  tagline: z.string().min(1).max(120),
  body: z.string().min(1).max(600),
  tags: z.array(z.string().min(1).max(30)).max(8),
  links: z.array(linkSchema).max(4),
})

const trackEntrySchema = z.object({
  id: z.string().min(1).max(40),
  org: z.string().min(1).max(80),
  role: z.string().min(1).max(80),
  period: z.string().min(1).max(40),
  body: z.string().max(600),
})

const trackSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(60),
  entries: z.array(trackEntrySchema).max(10),
})

export const contentSchema = z.object({
  version: z.literal(1),
  hero: z.object({
    kicker: z.string().min(1).max(80),
    name: z.string().min(1).max(60),
    lede: z.string().min(1).max(400),
    stamp: z.string().min(1).max(20),
  }),
  about: z.object({
    heading: z.string().min(1).max(80),
    paragraphs: z.array(z.string().min(1).max(800)).min(1).max(5),
    marginNote: z.string().max(80),
  }),
  products: z.array(productSchema).max(6),
  tracks: z.array(trackSchema).max(3),
  contact: z.object({
    heading: z.string().min(1).max(80),
    blurb: z.string().max(400),
  }),
  footer: z.object({
    note: z.string().max(120),
    links: z.array(linkSchema).max(6),
  }),
})

export type Content = z.infer<typeof contentSchema>
