import { z } from 'zod'

export const contactInputSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  body: z.string().min(1).max(5000),
  // Honeypot: a real person never fills this, it is hidden from view.
  website: z.string().max(0),
})

export type ContactInput = z.infer<typeof contactInputSchema>
