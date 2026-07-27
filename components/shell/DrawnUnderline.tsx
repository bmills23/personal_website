/** A hand-drawn underline. Decorative, so aria-hidden. The path is fixed,
 *  which is what makes a real stroke-draw animation possible here. */
export function DrawnUnderline() {
  return (
    <svg
      aria-hidden="true"
      className="write-underline mt-1 block h-2 w-full max-w-[14rem]"
      viewBox="0 0 240 8"
      preserveAspectRatio="none"
      fill="none"
    >
      <path
        d="M2 5.5 C 40 2.5, 78 6.5, 118 4 S 200 2, 238 4.5"
        stroke="var(--color-stamp)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  )
}
