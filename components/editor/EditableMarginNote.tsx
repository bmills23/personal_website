'use client'

import { MarginNote } from '@/components/shell/MarginNote'
import { EditableField } from './Editable'
import { useEditor } from './EditProvider'

// Mirrors MarginNote.tsx's own className/style exactly, since MarginNote
// itself takes no props to customize either and view mode must keep calling
// MarginNote unchanged (byte-identical), while edit mode needs the same look
// on a contentEditable element MarginNote can't produce.
const NOTE_CLASS = 'font-hand text-lg text-pencil'
const NOTE_STYLE: React.CSSProperties = { transform: 'rotate(-2deg)' }

/**
 * An optional margin note. View mode reproduces the current conditional
 * exactly: no text renders nothing, otherwise the wrapper plus `MarginNote`
 * (About's usage today). Edit mode always renders the wrapper and an
 * editable slot, even when empty, so a note that was cleared stays
 * reachable to type back into.
 */
export function EditableMarginNote({
  path,
  text,
  wrapper,
}: {
  path: string
  text: string
  wrapper: 'aside' | 'div'
}) {
  const { session, editing } = useEditor()
  const isEditing = session === 'admin' && editing
  const Wrapper = wrapper

  if (!isEditing) {
    if (!text) return null
    return (
      <Wrapper className="md:pt-2">
        <MarginNote>{text}</MarginNote>
      </Wrapper>
    )
  }

  return (
    <Wrapper className="md:pt-2">
      <EditableField
        path={path}
        text={text}
        as="p"
        className={NOTE_CLASS}
        style={NOTE_STYLE}
        placeholder="margin note"
      />
    </Wrapper>
  )
}
