import { describe, it, expect } from 'vitest'
import { canonicalJSON, deriveKey, extractUserId } from './key'

describe('canonicalJSON', () => {
  it('is stable across property order', () => {
    expect(canonicalJSON({ a: 1, b: 2 })).toBe(canonicalJSON({ b: 2, a: 1 }))
  })

  it('sorts nested objects too', () => {
    expect(canonicalJSON({ o: { x: 1, y: 2 } })).toBe(
      canonicalJSON({ o: { y: 2, x: 1 } })
    )
  })

  it('preserves array order', () => {
    expect(canonicalJSON([1, 2])).not.toBe(canonicalJSON([2, 1]))
  })
})

describe('extractUserId', () => {
  it('reads user_id', () => {
    expect(extractUserId({ user_id: 'U1' })).toBe('U1')
  })

  it('falls back to lineUserId for the register payload', () => {
    expect(extractUserId({ lineUserId: 'U2' })).toBe('U2')
  })

  it('returns anonymous when nothing matches', () => {
    expect(extractUserId({ foo: 'bar' })).toBe('anonymous')
  })
})

describe('deriveKey', () => {
  const base = { scope: 'points:spend', userId: 'U1', body: { points: 10 } }

  it('prefers the client header over the derived hash', () => {
    const key = deriveKey({ ...base, headerKey: 'abc-123' })
    expect(key).toBe('points:spend:abc-123')
  })

  it('ignores a blank header and derives a hash instead', () => {
    const key = deriveKey({ ...base, headerKey: '   ' })
    expect(key).not.toBe('points:spend:   ')
    expect(key.startsWith('points:spend:')).toBe(true)
  })

  it('is stable for the same body inside one time bucket', () => {
    const a = deriveKey({ ...base, headerKey: null, now: 1_000_000 })
    const b = deriveKey({ ...base, headerKey: null, now: 1_000_500 })
    expect(a).toBe(b)
  })

  it('changes once the time bucket rolls over', () => {
    const a = deriveKey({ ...base, headerKey: null, now: 1_000_000 })
    const b = deriveKey({ ...base, headerKey: null, now: 1_000_000 + 60_000 })
    expect(a).not.toBe(b)
  })

  it('ignores property order in the body', () => {
    const a = deriveKey({ ...base, body: { p: 1, q: 2 }, headerKey: null, now: 1 })
    const b = deriveKey({ ...base, body: { q: 2, p: 1 }, headerKey: null, now: 1 })
    expect(a).toBe(b)
  })

  it('does not collide across scopes for the same client key', () => {
    const a = deriveKey({ ...base, scope: 'waste:submit', headerKey: 'k' })
    const b = deriveKey({ ...base, scope: 'register:create', headerKey: 'k' })
    expect(a).not.toBe(b)
  })
})
