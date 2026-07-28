import { describe, expect, it } from 'vitest'
import { isAdminLogin } from '@/lib/auth/admin'

describe('isAdminLogin', () => {
  it('accepts the exact admin login', () => {
    expect(isAdminLogin('bmills23', 'bmills23')).toBe(true)
  })
  it('is case-insensitive, matching GitHub login semantics', () => {
    expect(isAdminLogin('BMills23', 'bmills23')).toBe(true)
    expect(isAdminLogin('bmills23', 'BMILLS23')).toBe(true)
  })
  it('rejects any other login', () => {
    expect(isAdminLogin('bmills24', 'bmills23')).toBe(false)
    expect(isAdminLogin('admin', 'bmills23')).toBe(false)
  })
  it('fails closed when the admin login env is missing or empty', () => {
    expect(isAdminLogin('bmills23', undefined)).toBe(false)
    expect(isAdminLogin('bmills23', '')).toBe(false)
  })
  it('fails closed on non-string or empty candidate logins', () => {
    expect(isAdminLogin(undefined, 'bmills23')).toBe(false)
    expect(isAdminLogin(null, 'bmills23')).toBe(false)
    expect(isAdminLogin(42, 'bmills23')).toBe(false)
    expect(isAdminLogin('', 'bmills23')).toBe(false)
    expect(isAdminLogin({ toString: () => 'bmills23' }, 'bmills23')).toBe(false)
  })
})
