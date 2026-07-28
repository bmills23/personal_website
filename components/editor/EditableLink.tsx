'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import { commitField, EditableField } from './Editable'
import { useEditor } from './EditProvider'

/**
 * The URL input, extracted so it mounts fresh each time editing actually
 * starts (this is only ever rendered from EditableLink's edit-mode branch,
 * which itself only exists while isEditing is true) rather than once at
 * EditableLink's own first mount. `EditableLink` stays mounted continuously
 * across edit-mode toggles (its own `useRef` would freeze on whatever `url`
 * happened to be in view mode, long before an admin ever started editing);
 * this component's baseline is captured at its own mount, mirroring
 * EditableField's edit-mount capture of `text`. Without this, a
 * router.refresh triggered by another field's save could deliver a new
 * `url` prop here while untouched, and that untouched input would then
 * read as "changed" against the stale first-mount baseline and fire a
 * spurious save.
 */
function UrlField({ urlPath, url }: { urlPath: string; url: string }) {
  const { enqueueSave, reportStatus } = useEditor()
  const router = useRouter()
  const lastSavedRef = useRef(url.trim())

  function handleBlur(event: React.FocusEvent<HTMLInputElement>) {
    const input = event.currentTarget
    void commitField({
      path: urlPath,
      value: input.value,
      lastSavedRef,
      restore: (previous) => {
        input.value = previous
      },
      enqueueSave,
      reportStatus,
      router,
    })
  }

  return (
    <input
      type="url"
      className="editable-url-input"
      defaultValue={url}
      aria-label={`Edit ${urlPath}`}
      onBlur={handleBlur}
    />
  )
}

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
  const { session, editing } = useEditor()
  const isEditing = session === 'admin' && editing

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

  return (
    <span className={className} onClick={(event) => event.preventDefault()}>
      <EditableField path={labelPath} text={label} as="span" />
      {children}
      <UrlField urlPath={urlPath} url={url} />
    </span>
  )
}
