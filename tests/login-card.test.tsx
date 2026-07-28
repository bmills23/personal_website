// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoginCard } from '@/components/editor/LoginCard'

describe('LoginCard', () => {
  it('signedOut state shows the sign-in framing and renders its child form', () => {
    render(
      <LoginCard state="signedOut">
        <button>Sign in with GitHub</button>
      </LoginCard>,
    )
    expect(screen.getByRole('button', { name: /sign in with github/i })).toBeTruthy()
  })
  it('denied state is a plain refusal with no hint it nearly worked', () => {
    render(<LoginCard state="denied" />)
    expect(screen.getByText(/not authorized/i)).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/github|admin|login|account/i)
  })
  it('unconfigured state explains the editor is not set up', () => {
    render(<LoginCard state="unconfigured" />)
    expect(screen.getByText(/not configured/i)).toBeTruthy()
  })
  it('signedIn state offers the way home and renders its child form', () => {
    render(
      <LoginCard state="signedIn">
        <button>Sign out</button>
      </LoginCard>,
    )
    expect(screen.getByRole('link', { name: /back to the page/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy()
  })
})
