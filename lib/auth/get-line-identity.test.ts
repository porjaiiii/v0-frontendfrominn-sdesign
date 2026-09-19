// @vitest-environment node
import { SignJWT } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

import {
  ABSOLUTE_TTL_SECONDS,
  RENEW_AFTER_SECONDS,
  USER_SESSION_COOKIE,
  decodeSession,
  encodeSession,
  startSession,
  type UserSession,
} from './user-session'
import { getLineIdentity } from './verify-line-token'

// verifyLineIdToken() accepts HS256 tokens signed with LINE_CHANNEL_SECRET (the
// server-side exchange path), which lets these tests mint real, verifiable ID
// tokens without LINE's private key.
const CHANNEL_ID = '1234567890'
const CHANNEL_SECRET = 'line-channel-secret-for-tests'
const SESSION_SECRET = 'user-session-test-secret-at-least-32-chars'
const ORIGIN = 'http://localhost:3000'
const ALICE = 'U_alice'
const BOB = 'U_bob'

const nowSeconds = () => Math.floor(Date.now() / 1000)

function idToken(sub: string, iat = nowSeconds(), exp = iat + 3600): Promise<string> {
  return new SignJWT({ name: sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('https://access.line.me')
    .setAudience(CHANNEL_ID)
    .setSubject(sub)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(CHANNEL_SECRET))
}

const expiredIdToken = (sub: string) => idToken(sub, nowSeconds() - 7200, nowSeconds() - 3600)

function request(
  opts: { method?: string; token?: string; origin?: string; site?: string } = {},
): Request {
  const headers: Record<string, string> = {}
  if (opts.token) headers.authorization = `Bearer ${opts.token}`
  if (opts.origin) headers.origin = opts.origin
  if (opts.site) headers['sec-fetch-site'] = opts.site
  return new Request(`${ORIGIN}/api/anything`, { method: opts.method ?? 'GET', headers })
}

async function setCookie(session: UserSession): Promise<void> {
  jar.set(USER_SESSION_COOKIE, { value: (await encodeSession(session))! })
}

const cookieSession = () => decodeSession(jar.get(USER_SESSION_COOKIE)?.value)

beforeEach(() => {
  jar.clear()
  vi.stubEnv('LINE_CHANNEL_ID', CHANNEL_ID)
  vi.stubEnv('LINE_CHANNEL_SECRET', CHANNEL_SECRET)
  vi.stubEnv('USER_SESSION_SECRET', SESSION_SECRET)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('with a fresh ID token', () => {
  it('identifies the user and starts a session', async () => {
    const identity = await getLineIdentity(request({ token: await idToken(ALICE) }))
    const session = await cookieSession()
    expect(identity?.lineUserId).toBe(ALICE)
    expect(session?.sub).toBe(ALICE)
    expect(identity?.session).toEqual({ sid: session!.sid, expiresAt: session!.exp })
  })

  it('leaves a recent session for the same user alone', async () => {
    await setCookie(startSession(ALICE))
    const before = jar.get(USER_SESSION_COOKIE)!.value
    await getLineIdentity(request({ token: await idToken(ALICE) }))
    expect(jar.get(USER_SESSION_COOKIE)!.value).toBe(before)
  })

  it('restarts a session LINE vouched for 6+ hours ago, keeping its sid', async () => {
    const old = startSession(ALICE, 'sid-alice', nowSeconds() - RENEW_AFTER_SECONDS)
    await setCookie(old)
    await getLineIdentity(request({ token: await idToken(ALICE) }))
    const session = await cookieSession()
    expect(session?.sid).toBe('sid-alice')
    expect(session!.auth).toBeGreaterThan(old.auth)
  })

  it('replaces a session that belongs to another LINE account', async () => {
    await setCookie(startSession(BOB, 'sid-bob'))
    const identity = await getLineIdentity(request({ token: await idToken(ALICE) }))
    const session = await cookieSession()
    expect(identity?.lineUserId).toBe(ALICE)
    expect(session?.sub).toBe(ALICE)
    expect(session?.sid).not.toBe('sid-bob')
  })

  it('needs no origin check — a Bearer token cannot be forged cross-site', async () => {
    const identity = await getLineIdentity(
      request({ method: 'POST', token: await idToken(ALICE), origin: 'https://evil.example' }),
    )
    expect(identity?.lineUserId).toBe(ALICE)
  })
})

describe('with only the session cookie', () => {
  it('identifies the user from the cookie', async () => {
    await setCookie(startSession(ALICE))
    expect((await getLineIdentity(request()))?.lineUserId).toBe(ALICE)
  })

  it('falls back to the cookie when the ID token has expired', async () => {
    await setCookie(startSession(ALICE))
    const identity = await getLineIdentity(request({ token: await expiredIdToken(ALICE) }))
    expect(identity?.lineUserId).toBe(ALICE)
  })

  it('slides a half-used session forward, keeping sid and auth', async () => {
    const old = startSession(ALICE, 'sid-alice', nowSeconds() - RENEW_AFTER_SECONDS)
    await setCookie(old)
    await getLineIdentity(request())
    const session = await cookieSession()
    expect(session).toMatchObject({ sid: 'sid-alice', auth: old.auth })
    expect(session!.iat).toBeGreaterThan(old.iat)
  })

  it('refuses a session past the 7-day limit', async () => {
    const now = nowSeconds()
    const capped = {
      ...startSession(ALICE, 'sid-alice', now - ABSOLUTE_TTL_SECONDS),
      iat: now - 3600,
      exp: now + 3600,
    }
    await setCookie(capped)
    expect(await getLineIdentity(request())).toBeNull()
  })

  it('refuses a forged cookie', async () => {
    jar.set(USER_SESSION_COOKIE, { value: 'v1.eyJzdWIiOiJVX2FsaWNlIn0.forged' })
    expect(await getLineIdentity(request())).toBeNull()
  })

  it('refuses a cross-site write', async () => {
    await setCookie(startSession(ALICE))
    expect(
      await getLineIdentity(request({ method: 'POST', origin: 'https://evil.example' })),
    ).toBeNull()
    expect(await getLineIdentity(request({ method: 'POST', site: 'cross-site' }))).toBeNull()
  })

  it('accepts a same-origin write', async () => {
    await setCookie(startSession(ALICE))
    const identity = await getLineIdentity(request({ method: 'POST', origin: ORIGIN }))
    expect(identity?.lineUserId).toBe(ALICE)
  })

  it('ignores the cookie when a fresh token is required', async () => {
    await setCookie(startSession(ALICE))
    expect(await getLineIdentity(request(), { requireBearer: true })).toBeNull()
  })
})

describe('without USER_SESSION_SECRET', () => {
  it('works from the ID token alone, as before sessions existed', async () => {
    vi.stubEnv('USER_SESSION_SECRET', '')
    const identity = await getLineIdentity(request({ token: await idToken(ALICE) }))
    expect(identity).toMatchObject({ lineUserId: ALICE })
    expect(identity?.session).toBeUndefined()
    expect(jar.has(USER_SESSION_COOKIE)).toBe(false)
  })

  it('ignores any cookie', async () => {
    await setCookie(startSession(ALICE))
    vi.stubEnv('USER_SESSION_SECRET', '')
    expect(await getLineIdentity(request())).toBeNull()
  })
})

describe('with nothing', () => {
  it('is null', async () => {
    expect(await getLineIdentity(request())).toBeNull()
  })
})
