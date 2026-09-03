import { describe, expect, it } from 'vitest'
import { generateUserIdFromLineId, verifyUserIdHash } from '@/lib/user-id-generator'

describe('generateUserIdFromLineId', () => {
  it('returns an empty string for empty input', () => {
    expect(generateUserIdFromLineId('')).toBe('')
  })

  it('is deterministic for the same LINE user id', () => {
    const id = 'U1234567890abcdef1234567890abcdef'
    expect(generateUserIdFromLineId(id)).toBe(generateUserIdFromLineId(id))
  })

  it('produces a DW prefix followed by 10 digits', () => {
    expect(generateUserIdFromLineId('U1234567890abcdef')).toMatch(/^DW\d{10}$/)
  })

  it('produces different ids for different inputs', () => {
    const a = generateUserIdFromLineId('Uaaaaaaaaaaaaaaaa')
    const b = generateUserIdFromLineId('Ubbbbbbbbbbbbbbbb')
    expect(a).not.toBe(b)
  })

  it('pads short hashes out to the full 10 digits', () => {
    // single-char input yields a small hash that must be right-padded
    expect(generateUserIdFromLineId('a')).toMatch(/^DW\d{10}$/)
  })
})

describe('verifyUserIdHash', () => {
  it('accepts a matching generated id', () => {
    const lineId = 'U1234567890abcdef'
    expect(verifyUserIdHash(lineId, generateUserIdFromLineId(lineId))).toBe(true)
  })

  it('rejects a non-matching id', () => {
    expect(verifyUserIdHash('U1234567890abcdef', 'DW0000000000')).toBe(false)
  })
})
