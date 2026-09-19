// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A stand-in for Next's per-request cookie store.
const jar = vi.hoisted(
  () => new Map<string, { value: string; options?: Record<string, unknown> }>(),
)

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      jar.set(name, { value, options })
    },
    delete: (name: string) => {
      jar.delete(name)
    },
  }),
}))

import { verifyAdminToken } from './admin-session'
import { signToken } from './signed-token'
import {
  ABSOLUTE_TTL_SECONDS,
  IDLE_TTL_SECONDS,
  RENEW_AFTER_SECONDS,
  USER_SESSION_COOKIE,
  clearSession,
  decodeSession,
  encodeSession,
  isDueForReauth,
  isDueForRenewal,
  readSession,
  renewSession,
  startSession,
  userSessionsEnabled,
  writeSession,
} from './user-session'

const SECRET = 'user-session-test-secret-at-least-32-chars'
const T0 = 1_800_000_000

beforeEach(() => {
  jar.clear()
  vi.stubEnv('USER_SESSION_SECRET', SECRET)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('session lifetimes', () => {
  it('starts with iat = auth = now and a 12-hour expiry', () => {
    expect(startSession('U1', 'sid-1', T0)).toEqual({
      sid: 'sid-1',
      sub: 'U1',
      iat: T0,
      exp: T0 + IDLE_TTL_SECONDS,
      auth: T0,
    })
  })

  it('gives each new login its own sid', () => {
    expect(startSession('U1').sid).not.toBe(startSession('U1').sid)
  })

  it('renewal slides iat and exp but keeps sid, sub and auth', () => {
    const session = startSession('U1', 'sid-1', T0)
    const later = T0 + RENEW_AFTER_SECONDS
    expect(renewSession(session, later)).toEqual({
      ...session,
      iat: later,
      exp: later + IDLE_TTL_SECONDS,
    })
  })

  it('renewal never passes 7 days after LINE vouched', () => {
    const session = startSession('U1', 'sid-1', T0)
    expect(renewSession(session, T0 + ABSOLUTE_TTL_SECONDS - 60).exp).toBe(
      T0 + ABSOLUTE_TTL_SECONDS,
    )
  })

  it('is due for renewal at half its idle lifetime', () => {
    const session = startSession('U1', 'sid-1', T0)
    expect(isDueForRenewal(session, T0 + RENEW_AFTER_SECONDS - 1)).toBe(false)
    expect(isDueForRenewal(session, T0 + RENEW_AFTER_SECONDS)).toBe(true)
  })

  it('is due for re-auth 6 hours after LINE vouched, however recently it was renewed', () => {
    const renewed = renewSession(startSession('U1', 'sid-1', T0), T0 + RENEW_AFTER_SECONDS)
    expect(isDueForRenewal(renewed, T0 + RENEW_AFTER_SECONDS)).toBe(false)
    expect(isDueForReauth(renewed, T0 + RENEW_AFTER_SECONDS)).toBe(true)
  })
})

describe('encoding', () => {
  it('round-trips a live session', async () => {
    const session = startSession('U1', 'sid-1', T0)
    expect(await decodeSession((await encodeSession(session))!, T0 + 60)).toEqual(session)
  })

  it('rejects an expired session', async () => {
    const session = startSession('U1', 'sid-1', T0)
    expect(await decodeSession((await encodeSession(session))!, session.exp)).toBeNull()
  })

  it('rejects a session past the 7-day limit even if its exp says otherwise', async () => {
    const tooLong = { ...startSession('U1', 'sid-1', T0), exp: T0 + 2 * ABSOLUTE_TTL_SECONDS }
    const token = (await encodeSession(tooLong))!
    expect(await decodeSession(token, T0 + ABSOLUTE_TTL_SECONDS)).toBeNull()
  })

  it('rejects a session signed under another secret', async () => {
    const token = (await encodeSession(startSession('U1', 'sid-1', T0)))!
    vi.stubEnv('USER_SESSION_SECRET', 'a-different-secret-that-is-32-chars-long')
    expect(await decodeSession(token, T0 + 60)).toBeNull()
  })

  it('rejects a correctly signed token of the wrong shape', async () => {
    // Signed with the labelled key (`dwa_session:${SECRET}`), matching what
    // encodeSession actually signs with — otherwise this would pass because
    // the key does not match, not because the shape check runs.
    const adminShaped = await signToken(`dwa_session:${SECRET}`, { sub: 'U1', exp: T0 + 60 })
    expect(await decodeSession(adminShaped, T0)).toBeNull()
  })

  it('a session token never verifies as an admin token, even under the same secret', async () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', SECRET)
    const token = await encodeSession(startSession('U1', 'sid-1', T0))
    expect(await verifyAdminToken(token ?? undefined)).toBeNull()
  })
})

describe('without a usable secret', () => {
  it('is switched off when the secret is missing or short', () => {
    vi.stubEnv('USER_SESSION_SECRET', '')
    expect(userSessionsEnabled()).toBe(false)
    vi.stubEnv('USER_SESSION_SECRET', 'too-short')
    expect(userSessionsEnabled()).toBe(false)
  })

  it('neither issues nor accepts sessions', async () => {
    const token = (await encodeSession(startSession('U1', 'sid-1', T0)))!
    vi.stubEnv('USER_SESSION_SECRET', '')
    expect(await encodeSession(startSession('U1'))).toBeNull()
    expect(await decodeSession(token, T0 + 60)).toBeNull()
    await writeSession(startSession('U1'))
    expect(jar.has(USER_SESSION_COOKIE)).toBe(false)
  })
})

describe('the cookie', () => {
  it('is httpOnly, lax, root-path, and dropped by the browser at exp', async () => {
    const session = startSession('U1')
    await writeSession(session)
    const written = jar.get(USER_SESSION_COOKIE)!
    expect(written.options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' })
    expect(written.options!.maxAge).toBeGreaterThan(IDLE_TTL_SECONDS - 5)
    expect(written.options!.maxAge).toBeLessThanOrEqual(IDLE_TTL_SECONDS)
    expect(await readSession()).toEqual(session)
  })

  it('reads a forged cookie as no session', async () => {
    jar.set(USER_SESSION_COOKIE, { value: 'v1.e30.not-a-signature' })
    expect(await readSession()).toBeNull()
  })

  it('clears the cookie', async () => {
    await writeSession(startSession('U1'))
    await clearSession()
    expect(jar.has(USER_SESSION_COOKIE)).toBe(false)
  })
})
