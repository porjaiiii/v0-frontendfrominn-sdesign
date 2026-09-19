// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { checkSameOrigin } from './same-origin'

const URL_ = 'https://app.example.com/api/waste/submit'

const req = (method: string, headers: Record<string, string> = {}) =>
  new Request(URL_, { method, headers })

describe('checkSameOrigin', () => {
  it('lets reads through whatever their origin', () => {
    expect(checkSameOrigin(req('GET', { origin: 'https://evil.example' })).ok).toBe(true)
  })

  it('accepts a write from our own origin', () => {
    expect(checkSameOrigin(req('POST', { origin: 'https://app.example.com' })).ok).toBe(true)
  })

  it('refuses a write from another origin', () => {
    expect(checkSameOrigin(req('POST', { origin: 'https://evil.example' })).ok).toBe(false)
  })

  it('refuses an opaque "null" origin', () => {
    expect(checkSameOrigin(req('DELETE', { origin: 'null' })).ok).toBe(false)
  })

  it('compares against the forwarded host when a proxy rewrote the URL', () => {
    const proxied = new Request('http://internal:3000/api/waste/submit', {
      method: 'POST',
      headers: { origin: 'https://app.example.com', 'x-forwarded-host': 'app.example.com' },
    })
    expect(checkSameOrigin(proxied).ok).toBe(true)
  })

  it('falls back to Sec-Fetch-Site when Origin is absent', () => {
    expect(checkSameOrigin(req('PUT', { 'sec-fetch-site': 'same-origin' })).ok).toBe(true)
    expect(checkSameOrigin(req('PUT', { 'sec-fetch-site': 'cross-site' })).ok).toBe(false)
  })

  it('lets a write with neither header through — SameSite=Lax still applies', () => {
    expect(checkSameOrigin(req('PATCH')).ok).toBe(true)
  })
})
