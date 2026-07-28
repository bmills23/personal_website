/**
 * `ariaHidden` defaults to `true`, matching this component's markup exactly
 * as it has always rendered (decorative badge chrome, hidden from
 * assistive tech). Only `components/editor/Editable.tsx`'s `EditableStamp`
 * passes `ariaHidden={false}`, and only while the stamp's own text is
 * actually being edited: a focusable contentEditable control inside an
 * aria-hidden ancestor is unreachable to assistive tech (WCAG
 * aria-hidden-focus), so the attribute must be dropped, not just flipped
 * to "false", for exactly that one case.
 */
export function Stamp({
  children,
  ariaHidden = true,
}: {
  children: React.ReactNode
  ariaHidden?: boolean
}) {
  return (
    <span
      aria-hidden={ariaHidden ? 'true' : undefined}
      className="inline-block rounded-sm border-2 border-stamp px-2.5 py-1.5 font-body text-[10px] tracking-[0.16em] text-stamp opacity-80"
      style={{ transform: 'rotate(6deg)' }}
    >
      {children}
    </span>
  )
}
