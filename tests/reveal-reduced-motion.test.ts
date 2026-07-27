// @vitest-environment jsdom
//
// Reveal is the one component covered by the global "all motion disabled
// under prefers-reduced-motion" rule, and the rule requires children to
// render unwrapped, not merely animate for 0ms. This test renders into a
// real DOM (jsdom) with window.matchMedia mocked to report a reduced-motion
// preference, then checks the actual DOM shape: no wrapper element at all,
// which is only true of the `<>{children}</>` branch, not the motion.div one.
//
// This lives in its own file (see the companion
// reveal-no-motion-preference.test.ts for the opposite branch) because
// framer-motion's reduced-motion detector initialises itself once per
// process from window.matchMedia and then never re-reads it. Vitest gives
// each test file its own isolated module registry, so splitting the two
// preferences across files is what actually keeps them from leaking into
// each other; resetting modules within a single file does not reach into
// the already-loaded node_modules copy of the motion library.
import { describe, it, expect, beforeAll } from 'vitest'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { Reveal } from '@/components/shell/Reveal'

beforeAll(() => {
  // Silences a benign act() warning under Vitest's jsdom environment; it does
  // not affect the assertions below.
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})

describe('Reveal when the device prefers reduced motion', () => {
  it('renders children unwrapped, with no motion.div wrapper', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    React.act(() => {
      root.render(
        React.createElement(Reveal, null, React.createElement('p', { 'data-testid': 'child' }, 'hello')),
      )
    })

    // No wrapping element at all: the child is the container's only content.
    expect(container.innerHTML).toBe('<p data-testid="child">hello</p>')

    React.act(() => root.unmount())
    container.remove()
  })
})
