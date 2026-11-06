// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { signToken, verifyToken } from './signed-token'

const SECRET = 'test-secret-that-is-at-least-32-characters-long'
const OTHER_SECRET = 'another-secret-that-is-at-least-32-characters'

describe('signed tokens', () => {
  it('round-trips the claims', async () => {
    const token = await signToken(SECRET, { sub: 'U1', exp: 123 })
    expect(token.startsWith('v1.')).toBe(true)
    expect(await verifyToken(SECRET, token)).toEqual({ sub: 'U1', exp: 123 })
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await signToken(OTHER_SECRET, { sub: 'U1' })
    expect(await verifyToken(SECRET, token)).toBeNull()
  })

  it('rejects edited claims', async () => {
    const [version, , signature] = (await signToken(SECRET, { sub: 'U1' })).split('.')
    const forged = Buffer.from(JSON.stringify({ sub: 'U2' })).toString('base64url')
    expect(await verifyToken(SECRET, `${version}.${forged}.${signature}`)).toBeNull()
  })

  it('rejects another version, missing parts and nothing at all', async () => {
    const [, payload, signature] = (await signToken(SECRET, { sub: 'U1' })).split('.')
    expect(await verifyToken(SECRET, `v2.${payload}.${signature}`)).toBeNull()
    expect(await verifyToken(SECRET, `v1.${payload}`)).toBeNull()
    expect(await verifyToken(SECRET, '')).toBeNull()
    expect(await verifyToken(SECRET, undefined)).toBeNull()
  })

  it('rejects a signed payload that is not a JSON object', async () => {
    const token = await signToken(SECRET, ['not', 'an', 'object'])
    expect(await verifyToken(SECRET, token)).toBeNull()
  })
})
