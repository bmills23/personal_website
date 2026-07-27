import { describe, it, expect } from 'vitest'
import { Icon } from '@/components/Icon'
import { ICONS } from '@/scripts/icon-list.mjs'

/** Icon returns a React element (server component); call it directly and
 *  inspect the returned element's props rather than pulling in a renderer. */
function renderedHtml(name: string, size?: number): string {
  const element = Icon(size === undefined ? { name } : { name, size }) as unknown as {
    props: { dangerouslySetInnerHTML: { __html: string } }
  }
  return element.props.dangerouslySetInnerHTML.__html
}

describe('Icon component', () => {
  it('applies a custom size prop to the rendered width and height', () => {
    const html = renderedHtml(ICONS[0], 48)
    expect(html).toContain('width="48"')
    expect(html).toContain('height="48"')
  })

  it('defaults to size 20 when no size prop is given', () => {
    const html = renderedHtml(ICONS[0])
    expect(html).toContain('width="20"')
    expect(html).toContain('height="20"')
  })

  it('throws on an unknown icon name rather than reading an arbitrary path', () => {
    // dangerouslySetInnerHTML inlines whatever readFileSync returns, so name
    // must be validated against the known icon list instead of trusted by
    // convention: a future caller passing a computed value must not be able
    // to turn this into an arbitrary local file read. Assert on the specific
    // validation message so this test fails if the throw regresses to an
    // incidental fs ENOENT (which would only hold by convention again).
    expect(() => Icon({ name: 'not-a-real-icon' })).toThrow(/unknown icon name/i)
    expect(() => Icon({ name: '../../../etc/passwd' })).toThrow(/unknown icon name/i)
  })
})
