// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { useState } from 'react'
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
import { Editable, EditableStamp } from '@/components/editor/Editable'
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

  // Adjacent minor: lastSavedRef (and therefore Escape's restore baseline)
  // must be seeded with text.trim(), not the raw stored value, so a stored
  // value with stray whitespace does not read as "changed" on an untouched
  // blur.
  it('a stored value with stray whitespace does not fire a save on an untouched blur', async () => {
    await renderEditing(<Editable path="hero.kicker" text="  Padded value  " as="p" />)
    const field = screen.getByRole('textbox', { name: 'Edit hero.kicker' })
    field.focus()
    fireEvent.blur(field)

    await Promise.resolve()
    expect(saveField).not.toHaveBeenCalled()
  })
})

// Finding 1 (edit-loss race, review fix): every commit routes through
// EditProvider's enqueueSave, which serializes writes across the whole page
// and reads the token at execution time, not at enqueue time.
describe('EditProvider.enqueueSave (edit-loss race fix)', () => {
  it('serializes two rapid commits on different fields, so the second uses the token the first just produced (mutation-tested)', async () => {
    let resolveFirst: (value: { ok: true; updatedAt: string }) => void = () => {}
    saveField.mockImplementation(({ path }: { path: string }) => {
      if (path === 'hero.kicker') {
        return new Promise((resolve) => {
          resolveFirst = resolve
        })
      }
      return Promise.resolve({ ok: true, updatedAt: 'T3' })
    })

    await renderEditing(
      <>
        <Editable path="hero.kicker" text="A-original" as="p" />
        <Editable path="hero.name" text="B-original" as="h1" />
      </>,
    )
    const fieldA = screen.getByRole('textbox', { name: 'Edit hero.kicker' })
    const fieldB = screen.getByRole('textbox', { name: 'Edit hero.name' })

    // A blurs first: its save goes out immediately, carrying T1, and stays
    // in flight (the mock above never resolves it yet). Real .focus()/.blur()
    // throughout (not fireEvent.blur), so document.activeElement actually
    // updates: otherwise fieldA is still jsdom's active element when
    // fieldB.focus() runs below, which fires a second genuine blur on
    // fieldA and double-commits it before B ever gets a turn.
    fieldA.focus()
    fieldA.textContent = 'A-changed'
    fieldA.blur()
    await waitFor(() => expect(saveField).toHaveBeenCalledTimes(1))
    expect(saveField).toHaveBeenNthCalledWith(1, {
      path: 'hero.kicker',
      value: 'A-changed',
      updatedAt: 'T1',
    })

    // B blurs before A resolves. Without enqueueSave, B's call would also
    // read the context's `updatedAt` state, which is still T1 (A hasn't
    // resolved), and race A for that same token.
    fieldB.focus()
    fieldB.textContent = 'B-changed'
    fieldB.blur()

    // B's call must not go out yet: it is queued behind A, which is still
    // pending.
    await Promise.resolve()
    expect(saveField).toHaveBeenCalledTimes(1)

    // Now let A resolve with a fresh token.
    resolveFirst({ ok: true, updatedAt: 'T2' })

    await waitFor(() => expect(saveField).toHaveBeenCalledTimes(2))
    expect(saveField).toHaveBeenNthCalledWith(2, {
      path: 'hero.name',
      value: 'B-changed',
      updatedAt: 'T2',
    })
    // Neither commit was lost/restored: both fields keep their edited text.
    expect(fieldA.textContent).toBe('A-changed')
    expect(fieldB.textContent).toBe('B-changed')
  })
})

// Finding 2 (aria-hidden-focus, review fix): Stamp's span is aria-hidden
// for a visitor (decorative badge chrome, unchanged), but a focusable
// contentEditable control inside an aria-hidden ancestor is unreachable to
// assistive tech, so edit mode must drop the attribute for this one field.
describe('EditableStamp (hero.stamp, aria-hidden-focus fix)', () => {
  it('view mode renders aria-hidden="true", byte-identical to Stamp default', () => {
    const { container } = render(
      <EditProvider>
        <EditableStamp path="hero.stamp" text="Entry 001" />
      </EditProvider>,
    )
    expect(container.innerHTML).toBe(
      '<span aria-hidden="true" class="inline-block rounded-sm border-2 border-stamp px-2.5 py-1.5 font-body text-[10px] tracking-[0.16em] text-stamp opacity-80" style="transform: rotate(6deg);">Entry 001</span>',
    )
  })

  it('edit mode drops aria-hidden so the textbox is reachable to assistive tech', async () => {
    await renderEditing(<EditableStamp path="hero.stamp" text="Entry 001" />)
    const field = screen.getByRole('textbox', { name: 'Edit hero.stamp' })
    const stampSpan = field.parentElement
    expect(stampSpan?.hasAttribute('aria-hidden')).toBe(false)
  })
})

// Finding 3 (invisible input border, review fix): --color-card-border is
// documented in globals.css itself as ~1.02:1 against --color-paper, far
// under the WCAG 1.4.11 floor for a form control boundary;
// --color-control-border exists for exactly this.
describe('.editable-url-input border color (globals.css)', () => {
  it('uses --color-control-border, not the invisible --color-card-border', () => {
    const css = readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf8')
    const match = /\.editable-url-input\s*\{([^}]*)\}/.exec(css)
    expect(match, '.editable-url-input rule not found in globals.css').not.toBeNull()
    // Strip /* ... */ comments first: the rule's own explanatory comment
    // legitimately names --color-card-border (to say why it's NOT used
    // here), which would otherwise false-positive a plain substring check.
    const declarationsOnly = match![1].replace(/\/\*[\s\S]*?\*\//g, '')
    const borderLine = /border:\s*([^;]+);/.exec(declarationsOnly)
    expect(borderLine, 'no border: declaration found').not.toBeNull()
    expect(borderLine![1]).toContain('--color-control-border')
    expect(borderLine![1]).not.toContain('--color-card-border')
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

  // Adjacent minor: the URL input's "unchanged" baseline must be captured
  // at edit-mode entry (UrlField's own mount), not at EditableLink's first
  // ever (view-mode) mount, so a url prop that changes before editing ever
  // starts (e.g. a router.refresh from another field's save) cannot make
  // the untouched input read as "changed" and fire a spurious save.
  it('captures the URL baseline at edit-mode entry, not first view-mode mount', async () => {
    function LinkHarness() {
      const [url, setUrl] = useState('https://example.com/original')
      return (
        <div>
          <button type="button" onClick={() => setUrl('https://example.com/updated')}>
            simulate refresh
          </button>
          <EditableLink
            labelPath="footer.links.0.label"
            urlPath="footer.links.0.url"
            label="GitHub"
            url={url}
          />
        </div>
      )
    }

    window.localStorage.setItem(HINT_KEY, '1')
    getEditorState.mockResolvedValue({ ok: true, updatedAt: 'T1' })
    render(
      <EditProvider>
        <LinkHarness />
      </EditProvider>,
    )

    // The url prop changes while still in view mode, before UrlField (or
    // even EditableLink's edit-mode branch) has ever existed.
    fireEvent.click(screen.getByRole('button', { name: 'simulate refresh' }))

    const toggle = await screen.findByRole('button', { name: /edit page/i })
    fireEvent.click(toggle)

    const urlInput = screen.getByRole('textbox', {
      name: 'Edit footer.links.0.url',
    }) as HTMLInputElement
    expect(urlInput.value).toBe('https://example.com/updated')

    urlInput.focus()
    fireEvent.blur(urlInput) // untouched

    await Promise.resolve()
    expect(saveField).not.toHaveBeenCalled()
  })
})
