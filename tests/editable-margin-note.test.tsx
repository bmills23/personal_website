// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// EditProvider pulls in app/actions/content (and, transitively, next-auth),
// which next-auth's own package resolution breaks under vitest/jsdom (see
// tests/editable.test.tsx for the same mocks, needed for the same reason).
// None of these mocks are ever called here: every test below stays in view
// mode (session 'unknown', editing false), so EditProvider never invokes them.
vi.mock('@/app/actions/content', () => ({
  getEditorState: vi.fn(),
  saveField: vi.fn(),
  revertLastSave: vi.fn(),
}))
vi.mock('@/app/actions/auth', () => ({
  signOutAction: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { EditProvider } from '@/components/editor/EditProvider'
import { EditableMarginNote } from '@/components/editor/EditableMarginNote'

// No admin sign-in anywhere in this file: EditProvider starts with
// session === 'unknown' and editing === false, so isEditing
// (session === 'admin' && editing) is already false without touching
// localStorage or mocking getEditorState, which is all these view-mode
// assertions need. (See tests/editable.test.tsx's renderEditing helper for
// the edit-mode path, not used here.)

describe('EditableMarginNote view mode: empty text', () => {
  it('renders neither the note nor the arrow when text is empty, even with a decoration prop', () => {
    const { container } = render(
      <EditProvider>
        <EditableMarginNote path="hero.marginNote" text="" wrapper="div" decoration="↗" />
      </EditProvider>,
    )
    expect(container.innerHTML).toBe('')
  })
})

describe('EditableMarginNote view mode: text with decoration (Hero usage)', () => {
  it('renders the note and the arrow, with the arrow in an aria-hidden span before the text', () => {
    const { container } = render(
      <EditProvider>
        <EditableMarginNote path="hero.marginNote" text="two careers, one set of tools" wrapper="div" decoration="↗" />
      </EditProvider>,
    )
    expect(container.innerHTML).toBe(
      '<div class="md:pt-2"><p class="font-hand text-lg text-pencil" style="transform: rotate(-2deg);">' +
        '<span aria-hidden="true">↗ </span>two careers, one set of tools</p></div>',
    )

    const arrow = container.querySelector('span[aria-hidden="true"]')
    expect(arrow).not.toBeNull()
    expect(arrow!.textContent).toBe('↗ ')
    // Screen-reader-accessible text (what aria-hidden strips out) is only
    // the actual words, never the glyph: the owner should never have to
    // type or preserve the arrow to edit the note.
    expect((container.querySelector('p') as HTMLElement).textContent).toBe(
      '↗ two careers, one set of tools',
    )
  })
})

describe('EditableMarginNote view mode: About usage is unchanged', () => {
  it('innerHTML matches the current markup exactly when no decoration prop is passed (decoration prop cannot regress it)', () => {
    const { container } = render(
      <EditProvider>
        <EditableMarginNote
          path="about.marginNote"
          text="air data taught me to distrust a single monitor"
          wrapper="aside"
        />
      </EditProvider>,
    )
    expect(container.innerHTML).toBe(
      '<aside class="md:pt-2"><p class="font-hand text-lg text-pencil" style="transform: rotate(-2deg);">' +
        'air data taught me to distrust a single monitor</p></aside>',
    )
    // No stray decoration span at all when the prop is omitted, not even an
    // empty one.
    expect(container.querySelector('span[aria-hidden="true"]')).toBeNull()
  })

  it('still renders nothing for an empty About note (pre-existing behavior, untouched)', () => {
    const { container } = render(
      <EditProvider>
        <EditableMarginNote path="about.marginNote" text="" wrapper="aside" />
      </EditProvider>,
    )
    expect(container.innerHTML).toBe('')
  })
})
