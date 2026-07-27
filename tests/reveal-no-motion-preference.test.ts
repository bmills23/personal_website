// @vitest-environment jsdom
//
// Companion to reveal-reduced-motion.test.ts: same component, opposite
// window.matchMedia preference. Split into its own file for the same reason
// documented there, framer-motion's reduced-motion detector only reads
// matchMedia once per process, so each preference needs its own isolated
// module registry rather than sharing a file.
import { describe, it, expect, beforeAll } from 'vitest'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { Reveal } from '@/components/shell/Reveal'

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

  // jsdom does not implement IntersectionObserver, which framer-motion's
  // whileInView (used by Reveal) needs to mount its viewport feature. A
  // no-op stub is enough: this test only asserts on the DOM shape Reveal
  // itself produces, not on when the animation actually triggers.
  class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    IntersectionObserverStub

  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})

describe('Reveal when the device has no reduced-motion preference', () => {
  it('wraps children in a motion div', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    React.act(() => {
      root.render(
        React.createElement(Reveal, null, React.createElement('p', { 'data-testid': 'child' }, 'hello')),
      )
    })

    const wrapper = container.firstElementChild
    expect(wrapper?.tagName).toBe('DIV')
    expect(wrapper?.querySelector('[data-testid="child"]')).not.toBeNull()

    React.act(() => root.unmount())
    container.remove()
  })
})
