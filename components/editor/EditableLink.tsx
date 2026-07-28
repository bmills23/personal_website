'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import { commitField, EditableField } from './Editable'
import { useEditor } from './EditProvider'

/**
 * An anchor whose label and URL are each independently editable. View mode
 * renders exactly the current `<a target="_blank" rel="noopener
 * noreferrer">` markup; edit mode swaps the anchor for a `<span>` holding an
 * editable label plus a small URL input, since an admin editing a link's
 * destination should not be able to accidentally follow it.
 *
 * `classNameFirst` exists solely because React's server renderer emits
 * attributes in JSX declaration order, and the two existing call sites
 * disagree: Products' link writes `href, target, rel, className`, Footer's
 * writes `href, className, target, rel`. Verified against the real
 * server-rendered output (Step 3's before/after diff) that this is the only
 * way for one shared component to stay byte-identical to both call sites'
 * pre-existing markup at once; the attribute *set* and every value are
 * identical either way, only the declaration order changes.
 */
export function EditableLink({
  labelPath,
  urlPath,
  label,
  url,
  className,
  children,
  classNameFirst = false,
}: {
  labelPath: string
  urlPath: string
  label: string
  url: string
  className?: string
  children?: React.ReactNode
  classNameFirst?: boolean
}) {
  const { session, editing, updatedAt, setUpdatedAt, reportStatus } = useEditor()
  const router = useRouter()
  const isEditing = session === 'admin' && editing
  const lastSavedUrlRef = useRef(url)

  if (!isEditing) {
    return classNameFirst ? (
      <a href={url} className={className} target="_blank" rel="noopener noreferrer">
        {label}
        {children}
      </a>
    ) : (
      <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
        {children}
      </a>
    )
  }

  function handleUrlBlur(event: React.FocusEvent<HTMLInputElement>) {
    const input = event.currentTarget
    void commitField({
      path: urlPath,
      value: input.value,
      lastSavedRef: lastSavedUrlRef,
      restore: (previous) => {
        input.value = previous
      },
      updatedAt,
      setUpdatedAt,
      reportStatus,
      router,
    })
  }

  return (
    <span className={className} onClick={(event) => event.preventDefault()}>
      <EditableField path={labelPath} text={label} as="span" />
      {children}
      <input
        type="url"
        className="editable-url-input"
        defaultValue={url}
        aria-label={`Edit ${urlPath}`}
        onBlur={handleUrlBlur}
      />
    </span>
  )
}
