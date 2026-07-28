// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const getEditorState = vi.fn()
const saveField = vi.fn()
const revertLastSave = vi.fn()
vi.mock('@/app/actions/content', () => ({
  getEditorState: (...args: unknown[]) => getEditorState(...args),
  saveField: (...args: unknown[]) => saveField(...args),
  revertLastSave: (...args: unknown[]) => revertLastSave(...args),
}))

const signOutAction = vi.fn()
vi.mock('@/app/actions/auth', () => ({
  signOutAction: (...args: unknown[]) => signOutAction(...args),
}))

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

import { EditProvider } from '@/components/editor/EditProvider'
import { Editable } from '@/components/editor/Editable'
import { EditableLink } from '@/components/editor/EditableLink'

const HINT_KEY = 'bgm-editor'

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
})

/**
 * Signs in as admin and flips editing on, the only public way to reach
 * `isEditing` (session === 'admin' && editing) without EditProvider
 * exporting its context for tests, per the brief's second suggested option.
 */
async function renderEditing(children: React.ReactNode, updatedAt = 'T1') {
  window.localStorage.setItem(HINT_KEY, '1')
  getEditorState.mockResolvedValue({ ok: true, updatedAt })
  const utils = render(<EditProvider>{children}</EditProvider>)
  const toggle = await screen.findByRole('button', { name: /edit page/i })
  fireEvent.click(toggle)
  return utils
}

describe('Editable view mode', () => {
  it('renders exactly <p class="x">text</p>, with NO extra attributes', () => {
    const { container } = render(
      <EditProvider>
        <Editable path="hero.kicker" text="hello" as="p" className="x" />
      </EditProvider>,
    )
    expect(container.innerHTML).toBe('<p class="x">hello</p>')
  })

  it('renders the provided children instead of the raw text', () => {
    const { container } = render(
      <EditProvider>
        <Editable path="hero.lede" text="raw text" as="p" className="x">
          <span>rich</span>
        </Editable>
      </EditProvider>,
    )
    expect(container.innerHTML).toBe('<p class="x"><span>rich</span></p>')
    expect(container.innerHTML).not.toContain('raw text')
  })

  it('renders nothing when text is empty', () => {
    const { container } = render(
      <EditProvider>
        <Editable path="contact.blurb" text="" as="p" className="x" />
      </EditProvider>,
    )
    expect(container.innerHTML).toBe('')
  })
})

describe('Editable edit mode', () => {
  it('renders contentEditable, role=textbox, and data-editable', async () => {
    await renderEditing(
      <Editable path="hero.kicker" text="hello" as="p" className="x" />,
    )
    const field = screen.getByRole('textbox', { name: 'Edit hero.kicker' })
    expect(field.getAttribute('data-editable')).toBe('hero.kicker')
    // contentEditable="plaintext-only" is the mandated attribute (see
    // Editable.tsx); jsdom reflects it verbatim rather than collapsing it to
    // "true", and Chrome/Safari/Firefox 136+ do the same.
    expect(field.getAttribute('contenteditable')).toBe('plaintext-only')
  })

  it('paste inserts plain text only, stripping control characters, never HTML (mutation-tested)', async () => {
    await renderEditing(<Editable path="hero.kicker" text="" as="p" />)
    const field = screen.getByRole('textbox', { name: 'Edit hero.kicker' })
    // Built with fromCharCode rather than an embedded literal/escape so the
    // source file itself never carries a raw control byte; the runtime
    // string is exactly "one\ntwo<NUL>three", matching the brief's paste
    // fixture.
    const withControlChars = 'one\ntwo' + String.fromCharCode(0) + 'three'
    fireEvent.paste(field, {
      clipboardData: { getData: () => withControlChars },
    })
    expect(field.textContent).toBe('onetwothree')
    // Never HTML: no child elements at all, only the inserted text node.
    expect(field.querySelectorAll('*').length).toBe(0)
  })

  it('Enter commits via blur with exactly one saveField call carrying {path, value, updatedAt}', async () => {
    saveField.mockResolvedValue({ ok: true, updatedAt: 'T2' })
    await renderEditing(<Editable path="hero.kicker" text="Original" as="p" />)
    const field = screen.getByRole('textbox', { name: 'Edit hero.kicker' })
    field.focus()
    field.textContent = 'Changed'
    fireEvent.keyDown(field, { key: 'Enter' })

    await waitFor(() => expect(saveField).toHaveBeenCalledTimes(1))
    expect(saveField).toHaveBeenCalledWith({
      path: 'hero.kicker',
      value: 'Changed',
      updatedAt: 'T1',
    })
  })

  it('unchanged blur calls saveField zero times', async () => {
    await renderEditing(<Editable path="hero.kicker" text="Same" as="p" />)
    const field = screen.getByRole('textbox', { name: 'Edit hero.kicker' })
    field.focus()
    fireEvent.blur(field)

    await Promise.resolve()
    expect(saveField).not.toHaveBeenCalled()
  })

  it('a failed save restores the previous text and reports the mapped error (mutation-tested)', async () => {
    saveField.mockResolvedValue({ ok: false, error: 'stale' })
    await renderEditing(<Editable path="hero.kicker" text="Before" as="p" />)
    const field = screen.getByRole('textbox', { name: 'Edit hero.kicker' })
    field.focus()
    field.textContent = 'After'
    fireEvent.blur(field)

    await waitFor(() => expect(field.textContent).toBe('Before'))
    expect(
      screen.getByText('This page changed elsewhere. Reload before editing.'),
    ).toBeTruthy()
  })

  it('Escape restores the pre-edit text and saves nothing', async () => {
    await renderEditing(<Editable path="hero.kicker" text="Kept" as="p" />)
    const field = screen.getByRole('textbox', { name: 'Edit hero.kicker' })
    field.focus()
    field.textContent = 'Junk'
    fireEvent.keyDown(field, { key: 'Escape' })

    expect(field.textContent).toBe('Kept')
    await Promise.resolve()
    expect(saveField).not.toHaveBeenCalled()
  })
})

describe('EditableLink', () => {
  it('view mode innerHTML matches the current anchor markup exactly', () => {
    const { container } = render(
      <EditProvider>
        <EditableLink
          labelPath="footer.links.0.label"
          urlPath="footer.links.0.url"
          label="GitHub"
          url="https://github.com/example"
          className="inline-flex min-h-11 items-center hover:text-ink"
        />
      </EditProvider>,
    )
    expect(container.innerHTML).toBe(
      '<a href="https://github.com/example" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-11 items-center hover:text-ink">GitHub</a>',
    )
  })

  it('classNameFirst reorders attributes to match Footer.tsx\'s pre-existing markup exactly', () => {
    const { container } = render(
      <EditProvider>
        <EditableLink
          labelPath="footer.links.0.label"
          urlPath="footer.links.0.url"
          label="GitHub"
          url="https://github.com/example"
          className="inline-flex min-h-11 items-center hover:text-ink"
          classNameFirst
        />
      </EditProvider>,
    )
    expect(container.innerHTML).toBe(
      '<a href="https://github.com/example" class="inline-flex min-h-11 items-center hover:text-ink" target="_blank" rel="noopener noreferrer">GitHub</a>',
    )
  })

  it('edit mode click does not navigate (preventDefault fires)', async () => {
    const { container } = await renderEditing(
      <EditableLink
        labelPath="footer.links.0.label"
        urlPath="footer.links.0.url"
        label="GitHub"
        url="https://github.com/example"
        className="link-class"
      />,
    )
    const wrapper = container.querySelector('span.link-class')
    expect(wrapper).not.toBeNull()
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true })
    wrapper!.dispatchEvent(clickEvent)
    expect(clickEvent.defaultPrevented).toBe(true)
  })
})
