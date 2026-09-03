import { beforeEach, describe, expect, it } from 'vitest'
import { getCachedRegisteredLineId, setCachedRegisteredLineId } from '@/lib/registration-cookie'

function clearCookies() {
  for (const entry of document.cookie.split(';')) {
    const name = entry.split('=')[0]?.trim()
    if (name) document.cookie = `${name}=; path=/; max-age=0`
  }
}

describe('registration cookie cache', () => {
  beforeEach(clearCookies)

  it('returns null when no cookie is set', () => {
    expect(getCachedRegisteredLineId()).toBeNull()
  })

  it('round-trips a stored LINE user id', () => {
    setCachedRegisteredLineId('U1234567890abcdef')
    expect(getCachedRegisteredLineId()).toBe('U1234567890abcdef')
  })

  it('decodes values containing characters that require URL encoding', () => {
    setCachedRegisteredLineId('U abc;def')
    expect(getCachedRegisteredLineId()).toBe('U abc;def')
  })

  it('does not match a different LINE user id', () => {
    setCachedRegisteredLineId('Uaaa')
    expect(getCachedRegisteredLineId() === 'Ubbb').toBe(false)
  })

  it('overwrites the previous value rather than appending a second cookie', () => {
    setCachedRegisteredLineId('Uold')
    setCachedRegisteredLineId('Unew')
    expect(getCachedRegisteredLineId()).toBe('Unew')
  })

  it('is not confused by other cookies sharing a name suffix', () => {
    document.cookie = 'not_registered_line_id=decoy; path=/'
    setCachedRegisteredLineId('Ureal')
    expect(getCachedRegisteredLineId()).toBe('Ureal')
  })
})
