'use client'

import { useState } from 'react'

type Status = 'idle' | 'sending' | 'sent' | 'error'

export function ContactForm() {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('sending')
    setError('')
    const data = Object.fromEntries(new FormData(event.currentTarget))
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload.error ?? 'Something went wrong.')
        setStatus('error')
        return
      }
      setStatus('sent')
    } catch {
      setError('Network error. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <p role="status" className="text-[16px] text-ink">
        Got it. I will get back to you.
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-lg gap-4">
      <label className="grid gap-1.5">
        <span className="text-[13px] text-pencil">Name</span>
        <input
          name="name"
          required
          maxLength={100}
          className="min-h-11 min-w-0 rounded-sm border border-card-border bg-card px-3 py-2 text-[15px] text-graphite"
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-[13px] text-pencil">Email</span>
        <input
          name="email"
          type="email"
          required
          maxLength={200}
          className="min-h-11 min-w-0 rounded-sm border border-card-border bg-card px-3 py-2 text-[15px] text-graphite"
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-[13px] text-pencil">Message</span>
        <textarea
          name="body"
          required
          rows={5}
          maxLength={5000}
          className="min-w-0 rounded-sm border border-card-border bg-card px-3 py-2 text-[15px] text-graphite"
        />
      </label>

      {/* Honeypot. Hidden from people, irresistible to bots. Not just
          visually hidden: aria-hidden keeps it out of the accessibility
          tree and tabIndex={-1} keeps it out of the tab order, so a real
          keyboard or screen-reader user never encounters it.

          Deliberately NOT hidden via an off-canvas negative offset
          (e.g. left: -9999px): that still contributes to the page's
          scrollable bounding box in some browsers and reads as horizontal
          overflow to any bounding-rect check, including
          scripts/check-mobile.mjs (see the identical note on .skip-link in
          app/globals.css). Clipping to a 1px box keeps the border box at
          its normal in-flow position instead. */}
      <div
        aria-hidden="true"
        className="absolute h-px w-px overflow-hidden whitespace-nowrap p-0 [clip:rect(0,0,0,0)]"
      >
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-[14px] text-stamp">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="min-h-11 justify-self-start rounded-sm border-2 border-ink px-5 text-[14px] text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-60"
      >
        {status === 'sending' ? 'Sending...' : 'Send'}
      </button>
    </form>
  )
}
