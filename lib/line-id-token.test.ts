import { describe, expect, it } from 'vitest'

import { isIdTokenExpired } from './line-id-token'

// A LINE ID token lives one hour; the LIFF session that mints it lives twelve.
// For eleven of those hours liff.isLoggedIn() is true while getIDToken() hands
// back a token every route rejects — the reason an authenticated user sees
// "Unauthorized" on an upload they just triggered. These cover the check that
// keeps a dead token out of the Authorization header.

/** A token shaped like LINE's — header.payload.signature — with a given exp. */
function tokenExpiringAt(exp: number): string {
  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'ES256', typ: 'JWT' })}.${encode({ sub: 'U_test', exp })}.signature`
}

const nowSeconds = () => Math.floor(Date.now() / 1000)

describe('isIdTokenExpired', () => {
  it('accepts a token with ten minutes left', () => {
    expect(isIdTokenExpired(tokenExpiringAt(nowSeconds() + 600))).toBe(false)
  })

  it('rejects the ten-hour-old token from the reported 401', () => {
    // The real capture: iat 01:39:50Z, exp 02:39:50Z, sent well after 12:00Z.
    expect(isIdTokenExpired(tokenExpiringAt(nowSeconds() - 36_000))).toBe(true)
  })

  it('rejects a token that dies while the request is in flight', () => {
    expect(isIdTokenExpired(tokenExpiringAt(nowSeconds() + 20))).toBe(true)
  })

  it('rejects a token with no exp claim', () => {
    const encode = (obj: object) =>
      btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(isIdTokenExpired(`${encode({ alg: 'ES256' })}.${encode({ sub: 'U' })}.sig`)).toBe(true)
  })

  it('rejects a malformed token rather than trusting it', () => {
    expect(isIdTokenExpired('not-a-jwt')).toBe(true)
    expect(isIdTokenExpired('')).toBe(true)
  })
})
