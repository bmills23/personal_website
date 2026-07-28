'use client'

import { WrittenHeading } from '@/components/shell/WrittenHeading'
import { EditableField } from './Editable'
import { useEditor } from './EditProvider'

/**
 * A section heading backed by editable content. View mode renders
 * `WrittenHeading` exactly as every section does today (same write-in
 * animation, same underline). Edit mode swaps in a plain editable `h2`: no
 * write animation while the admin is actively typing into it.
 */
export function HeadingEditable({
  path,
  text,
  className,
}: {
  path: string
  text: string
  className?: string
}) {
  const { session, editing } = useEditor()
  const isEditing = session === 'admin' && editing

  if (!isEditing) {
    return (
      <WrittenHeading as="h2" className={className}>
        {text}
      </WrittenHeading>
    )
  }

  // key={text}: forces a fresh EditableField instance (fresh frozen
  // snapshot) whenever the underlying document value actually changes - see
  // the matching comment in Editable.tsx's `Editable`, which this mirrors.
  return <EditableField key={text} path={path} text={text} as="h2" className={className} />
}
