// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WrittenHeading } from '@/components/shell/WrittenHeading'

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  )
})

describe('WrittenHeading', () => {
  it('renders its text even when the animation never runs', () => {
    render(<WrittenHeading>Two careers, one set of tools</WrittenHeading>)
    expect(screen.getByText('Two careers, one set of tools')).toBeTruthy()
  })

  it('renders the requested heading level', () => {
    render(<WrittenHeading as="h1">Bryan G. Mills</WrittenHeading>)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bryan G. Mills')
  })

  it('marks the underline decorative', () => {
    const { container } = render(<WrittenHeading>Work</WrittenHeading>)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })

  it('omits the underline when asked', () => {
    const { container } = render(<WrittenHeading underline={false}>Work</WrittenHeading>)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('starts unwritten so the animation has somewhere to go', () => {
    const { container } = render(<WrittenHeading>Work</WrittenHeading>)
    expect(container.querySelector('[data-write]')?.getAttribute('data-written')).toBeNull()
  })
})
