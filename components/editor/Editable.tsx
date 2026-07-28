'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import { saveField, type SaveResult } from '@/app/actions/content'
import { Stamp } from '@/components/shell/Stamp'
import { saveErrorMessage, useEditor, type SaveStatus } from './EditProvider'

export type EditableTag = 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'li'

/** Control characters (C0 + DEL) a paste must never carry into the document. */
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/g

/** Minimal shape `commitField` needs from `next/navigation`'s router, kept
 * narrow so callers can pass a plain `{ refresh() {} }` mock in tests
 * without importing next/navigation at all. */
type Router = { refresh: () => void }

/**
 * Strips paste content down to a single plain-text line: every C0 control
 * character and DEL is removed outright (not replaced), which is also how a
 * literal newline disappears, since \n and \r are themselves in that range.
 * Exported so the paste contract (Step 1, test 5) can be exercised directly
 * without going through clipboard/Range plumbing.
 */
export function sanitizePastedText(raw: string): string {
  return raw.replace(CONTROL_CHARS_RE, '')
}

/**
 * Inserts `text` as a single text node at the current selection inside
 * `element`, via Range manipulation only (deleteContents + insertNode) so no
 * markup can ever ride along, per the brief: no document.execCommand. Falls
 * back to inserting at the end of `element`'s content when there is no
 * live selection inside it (e.g. a paste fired without the browser ever
 * having placed a caret there, as in a synthetic test event).
 */
export function insertPlainText(element: HTMLElement, text: string) {
  const selection = window.getSelection()
  let range: Range | null = null
  if (selection && selection.rangeCount > 0) {
    const candidate = selection.getRangeAt(0)
    if (element.contains(candidate.commonAncestorContainer)) range = candidate
  }
  if (!range) {
    range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false)
  }
  range.deleteContents()
  const node = document.createTextNode(text)
  range.insertNode(node)
  range.setStartAfter(node)
  range.setEndAfter(node)
  if (selection) {
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

/**
 * Persists one field's value, shared by every editable surface (the plain
 * Editable field, the inline stamp/role/period fields, EditableLink's label
 * and URL input, EditableMarginNote's note) so a save failure, a stale
 * token, and an unset token all read and restore identically everywhere.
 * Not a hook: it takes its editor-context values as plain arguments so any
 * event handler can call it directly.
 *
 * Routes the actual write through `enqueueSave` (from `useEditor()`)
 * instead of calling `saveField` with a token read here: `enqueueSave`
 * serializes every write across the whole page and supplies the token at
 * the moment its turn executes, not at the moment this function was
 * called, which is what keeps two near-simultaneous commits on different
 * fields from racing each other's token stale (see EditProvider.tsx).
 */
export async function commitField({
  path,
  value,
  lastSavedRef,
  restore,
  enqueueSave,
  reportStatus,
  router,
}: {
  path: string
  value: string
  lastSavedRef: React.MutableRefObject<string>
  restore: (previous: string) => void
  enqueueSave: (fn: (token: string) => Promise<SaveResult>) => Promise<SaveResult>
  reportStatus: (status: SaveStatus) => void
  router: Router
}): Promise<void> {
  const trimmed = value.trim()
  if (trimmed === lastSavedRef.current) return

  reportStatus({ state: 'saving' })
  const result = await enqueueSave((token) => saveField({ path, value: trimmed, updatedAt: token }))
  if (result.ok) {
    lastSavedRef.current = trimmed
    reportStatus({ state: 'saved' })
    router.refresh()
  } else {
    restore(lastSavedRef.current)
    reportStatus({ state: 'error', message: saveErrorMessage(result.error) })
  }
}

/**
 * The contentEditable primitive itself: no view-mode branch of its own,
 * mounted only while a field is actually being edited. Every editable
 * surface in this file (and EditableLink/HeadingEditable/EditableMarginNote)
 * renders this for its edit-mode output, so paste/drop/keyboard/blur behave
 * identically everywhere.
 *
 * A fresh instance of this component mounts both when a field first enters
 * edit mode (its callers only render it inside the `isEditing` branch) AND
 * whenever the underlying document value actually changes thereafter: every
 * caller passes `key={text}` (or the equivalent for its own value) on this
 * element, so a `text` prop that differs from the previous render forces
 * React to unmount the old instance and mount a new one rather than
 * updating the existing one in place (see each caller's own comment: the
 * `Editable`/`EditableInline`/`EditableStamp` functions below,
 * HeadingEditable.tsx, EditableMarginNote.tsx, EditableLink.tsx). That is
 * what lets `text` only ever be captured once per mount: both refs below
 * intentionally ignore `text` on every render after the first (`useRef`'s
 * initializer argument is a one-time value), which is what makes the
 * element "uncontrolled after that" per the brief, while still re-syncing
 * to a value that changed out from under it (a router.refresh() landing
 * after some OTHER field's commit, e.g. because a sibling array item was
 * removed/reordered) instead of silently going stale. Safe against
 * clobbering an in-progress keystroke: typing is uncontrolled and never
 * touches this `text` prop, and this exact field cannot be mid-edit AND
 * have a differing incoming `text` prop at the same time, since the only
 * way its own document value changes is through ITS OWN commit path
 * (Enter/blur/Escape), every one of which removes focus before the
 * resulting refresh can land.
 */
export function EditableField({
  path,
  text,
  as = 'span',
  className,
  placeholder,
  style,
}: {
  path: string
  text: string
  as?: EditableTag
  className?: string
  placeholder?: string
  style?: React.CSSProperties
}) {
  const { enqueueSave, reportStatus } = useEditor()
  const router = useRouter()
  const mountedTextRef = useRef(text)
  // Trimmed, not raw: the commit path always compares against
  // value.trim(), so a stored value with stray leading/trailing whitespace
  // must not read as "changed" on an untouched blur. Escape's restore
  // reads this same ref, so it inherits the trimmed baseline too.
  const lastSavedRef = useRef(text.trim())
  const Tag = as

  function handlePaste(event: React.ClipboardEvent<HTMLElement>) {
    event.preventDefault()
    const clean = sanitizePastedText(event.clipboardData.getData('text/plain'))
    insertPlainText(event.currentTarget, clean)
  }

  function handleDrop(event: React.DragEvent<HTMLElement>) {
    // Dragged content can carry HTML past the paste handler entirely.
    event.preventDefault()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    const key = event.key.toLowerCase()
    if ((event.metaKey || event.ctrlKey) && (key === 'b' || key === 'i' || key === 'u')) {
      // Browsers apply bold/italic/underline markup inside contentEditable
      // on these shortcuts; the commit path only ever reads textContent, so
      // swallowing them here is about not leaving stray inline elements in
      // the live DOM more than it is about what gets saved.
      event.preventDefault()
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
      return
    }
    if (event.key === 'Escape') {
      event.currentTarget.textContent = lastSavedRef.current
      event.currentTarget.blur()
    }
  }

  function handleBlur(event: React.FocusEvent<HTMLElement>) {
    const element = event.currentTarget
    const value = element.textContent ?? ''
    void commitField({
      path,
      value,
      lastSavedRef,
      restore: (previous) => {
        element.textContent = previous
      },
      enqueueSave,
      reportStatus,
      router,
    })
  }

  return (
    <Tag
      className={className ? `${className} editable` : 'editable'}
      style={style}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-label={`Edit ${path}`}
      data-editable={path}
      data-placeholder={placeholder}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      {mountedTextRef.current}
    </Tag>
  )
}

/**
 * The general-purpose editable field. View mode renders exactly what the
 * section renders today for a field that already owns its own tag (a `p`,
 * `h1`, `h3`, `li`, ...): same tag, same className, nothing extra, and
 * `null` when there is no text to show, so a visitor's HTML is byte-for-byte
 * unchanged. Edit mode swaps in `EditableField`.
 */
export function Editable({
  path,
  text,
  as = 'span',
  className,
  children,
  placeholder,
}: {
  path: string
  text: string
  as?: EditableTag
  className?: string
  children?: React.ReactNode
  placeholder?: string
}) {
  const { session, editing } = useEditor()
  const isEditing = session === 'admin' && editing

  if (!isEditing) {
    if (!text) return null
    const Tag = as
    return <Tag className={className}>{children ?? text}</Tag>
  }

  // `key={text}`: EditableField freezes `text` into a ref at mount and never
  // re-syncs it (see EditableField's own doc comment), so a document value
  // that changes out from under an already-mounted instance (a
  // router.refresh() delivering fresh server data, e.g. after a sibling
  // array item was removed/reordered) would otherwise leave the DOM showing
  // a stale, possibly-deleted value while `path` now points at whatever
  // shifted into this slot - a silent wrong-slot write with no error. Keying
  // on the incoming text forces React to remount (fresh mountedTextRef
  // snapshot) exactly when the underlying value actually changes. Safe to
  // remount even mid-page-interaction because it can never fire on a
  // FOCUSED field: typing is uncontrolled (never touches this `text` prop),
  // and every commit path (Enter, blur, Escape, toolbar clicks) removes
  // focus before its own router.refresh() lands, so by the time any refresh
  // re-renders this tree, whichever field it affects has already lost focus.
  return (
    <EditableField
      key={text}
      path={path}
      text={text}
      as={as}
      className={className}
      placeholder={placeholder}
    />
  )
}

/**
 * For the two spots in the content map where the *existing* markup has no
 * per-field tag at all: a Stamp's text is a bare child of Stamp's own span,
 * and a track entry's role/period are two bare text runs sharing one `<p>`
 * with a ` · ` separator. `Editable` always wraps in `<As>` in view mode
 * (the byte-identity contract for every other field, which already has a
 * wrapping tag to take over), so nesting it here would add a `<span>`
 * neither of those two spots has today. `EditableInline` renders the bare
 * string in view mode instead, matching what's there now exactly, and only
 * switches to a wrapped `EditableField` once editing actually starts.
 */
export function EditableInline({
  path,
  text,
  as = 'span',
  className,
}: {
  path: string
  text: string
  as?: EditableTag
  className?: string
}) {
  const { session, editing } = useEditor()
  const isEditing = session === 'admin' && editing

  if (!isEditing) {
    return text ? text : null
  }

  // See the matching comment on `Editable` above: keying on `text` is what
  // makes an already-mounted instance re-sync to a changed document value.
  return <EditableField key={text} path={path} text={text} as={as} className={className} />
}

/**
 * hero.stamp specifically: Stamp itself is the wrapper (Hero.tsx does not
 * render its own `<Stamp>` around this), so it can own the aria-hidden
 * toggle. View mode is exactly `<Stamp>{text}</Stamp>`, byte-identical to
 * Hero.tsx before this ever existed. Edit mode drops aria-hidden (WCAG
 * aria-hidden-focus: see Stamp.tsx) so the contentEditable control inside
 * it is reachable to assistive tech.
 */
export function EditableStamp({ path, text }: { path: string; text: string }) {
  const { session, editing } = useEditor()
  const isEditing = session === 'admin' && editing

  if (!isEditing) {
    return <Stamp>{text}</Stamp>
  }

  return (
    <Stamp ariaHidden={false}>
      {/* See the matching comment on `Editable` above. */}
      <EditableField key={text} path={path} text={text} as="span" />
    </Stamp>
  )
}
