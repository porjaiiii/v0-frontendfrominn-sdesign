import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Regression cover for the LINE OA greeting — the one call still leaving this
// app for Apps Script (GAS #3), and the one that quietly stopped happening in
// production after the migration.
//
// Before the migration the shared secret was HARDCODED in the client bundle,
// so it could never be "missing". Moving the call server-side turned it into
// GAS_REGISTRATION_SECRET, which was never set in Vercel — so every
// registration took the `!url || !secret` early return: no welcome message, no
// rich-menu switch, no error, and a warning that only ever printed once per
// lambda. Nothing in the suite noticed, because nothing covered this file.
//
// These tests stub fetch. They must never reach the real endpoint: a live POST
// pushes a real LINE message to a real user.

const PAYLOAD = {
  lineUserId: 'Utest_greeting_0001',
  userId: 'DW0000000001',
  pdpaConsent: 'ยอมรับ',
  fullName: 'ทดสอบ ทักทาย',
  nickname: 'เทส',
  phoneNumber: '0812345678',
  address: '99/1 ม.5',
  gender: 'ชาย',
  ageRange: '26-45',
  userType: 'คนในชุมชนคุ้งบางกะเจ้า',
  subdistrict: 'บางกะเจ้า',
  occupation: 'เกษตรกร',
  registrationDate: '1/1/2569',
}

const URL3 = 'https://script.google.com/macros/s/AKfycb_test/exec'

/**
 * Fresh module per test. `warned` is module-scoped state, so without this the
 * once-per-process assertion would depend on test order.
 */
async function loadNotify() {
  vi.resetModules()
  return (await import('@/lib/notify-registration')).notifyRegistrationComplete
}

function stubFetch(impl: (...args: unknown[]) => unknown) {
  const spy = vi.fn(impl)
  vi.stubGlobal('fetch', spy)
  return spy
}

// What GAS #3 actually returns on success. Its ContentService can only ever
// emit HTTP 200, so the body is the only real signal.
const ok = () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })

beforeEach(() => {
  // Explicit, so an exported shell variable cannot change the outcome.
  for (const key of ['GAS_URL3', 'NEXT_PUBLIC_GAS_URL3', 'GAS_REGISTRATION_SECRET']) {
    vi.stubEnv(key, undefined)
  }
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the guard that silently disabled the greeting in production', () => {
  it('makes no request and returns false when the secret is missing', async () => {
    vi.stubEnv('GAS_URL3', URL3)
    const fetchSpy = stubFetch(ok)

    const notify = await loadNotify()
    await expect(notify(PAYLOAD)).resolves.toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('makes no request and returns false when the endpoint URL is missing', async () => {
    vi.stubEnv('GAS_REGISTRATION_SECRET', 's3cret')
    const fetchSpy = stubFetch(ok)

    const notify = await loadNotify()
    await expect(notify(PAYLOAD)).resolves.toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('treats a whitespace-only value as missing rather than sending it', async () => {
    vi.stubEnv('GAS_URL3', URL3)
    vi.stubEnv('GAS_REGISTRATION_SECRET', '   ')
    const fetchSpy = stubFetch(ok)

    const notify = await loadNotify()
    await expect(notify(PAYLOAD)).resolves.toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('warns once per process, not once per registration', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubFetch(ok)

    const notify = await loadNotify()
    await notify(PAYLOAD)
    await notify(PAYLOAD)
    await notify(PAYLOAD)

    // This is why the outage was invisible: three skipped greetings, one line
    // of log, and only in whichever lambda happened to be cold.
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('LINE greeting skipped')
  })
})

describe('when both variables are set', () => {
  beforeEach(() => {
    vi.stubEnv('GAS_URL3', URL3)
    vi.stubEnv('GAS_REGISTRATION_SECRET', 's3cret')
  })

  it('POSTs to the ?route=register endpoint and reports success', async () => {
    const fetchSpy = stubFetch(ok)

    const notify = await loadNotify()
    await expect(notify(PAYLOAD)).resolves.toBe(true)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe(`${URL3}?route=register`)
  })

  it('sends the secret merged into the payload, as text/plain', async () => {
    const fetchSpy = stubFetch(ok)

    const notify = await loadNotify()
    await notify(PAYLOAD)

    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    // Byte-identical to what GAS #3 has always received. Its source was never
    // exported, so its doPost may well branch on the content type.
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'text/plain;charset=utf-8',
    )
    expect(JSON.parse(init.body as string)).toEqual({ secret: 's3cret', ...PAYLOAD })
  })

  it('never leaks the secret into the URL', async () => {
    const fetchSpy = stubFetch(ok)

    const notify = await loadNotify()
    await notify(PAYLOAD)

    expect(fetchSpy.mock.calls[0][0]).not.toContain('s3cret')
  })
})

describe('endpoint resolution', () => {
  beforeEach(() => vi.stubEnv('GAS_REGISTRATION_SECRET', 's3cret'))

  it('falls back to NEXT_PUBLIC_GAS_URL3 so a half-migrated Vercel still works', async () => {
    vi.stubEnv('NEXT_PUBLIC_GAS_URL3', URL3)
    const fetchSpy = stubFetch(ok)

    const notify = await loadNotify()
    await expect(notify(PAYLOAD)).resolves.toBe(true)
    expect(fetchSpy.mock.calls[0][0]).toBe(`${URL3}?route=register`)
  })

  it('prefers GAS_URL3, so removing the NEXT_PUBLIC_ copy is safe', async () => {
    vi.stubEnv('GAS_URL3', URL3)
    vi.stubEnv('NEXT_PUBLIC_GAS_URL3', 'https://script.google.com/macros/s/stale/exec')
    const fetchSpy = stubFetch(ok)

    const notify = await loadNotify()
    await notify(PAYLOAD)
    expect(fetchSpy.mock.calls[0][0]).toBe(`${URL3}?route=register`)
  })
})

describe('a failed greeting must not fail a registration already written', () => {
  beforeEach(() => {
    vi.stubEnv('GAS_URL3', URL3)
    vi.stubEnv('GAS_REGISTRATION_SECRET', 's3cret')
  })

  it('returns false on a non-2xx response instead of throwing', async () => {
    stubFetch(() => new Response('nope', { status: 500 }))

    const notify = await loadNotify()
    await expect(notify(PAYLOAD)).resolves.toBe(false)
  })

  it('does not mistake a 200 rejection for a delivered greeting', async () => {
    // The exact response a rotated secret produces. GAS #3 answers HTTP 200
    // with the failure in the body, which is why this outage left no trace.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch(
      () =>
        new Response(
          JSON.stringify({ status: 'error', message: 'Unauthorized: invalid secret key' }),
          { status: 200 },
        ),
    )

    const notify = await loadNotify()
    await expect(notify(PAYLOAD)).resolves.toBe(false)
    expect(error.mock.calls[0][1]).toContain('invalid secret key')
  })

  it('returns false when the body is not JSON at all', async () => {
    // An Apps Script error page, or the Google sign-in redirect served once the
    // deployment stops being "anyone, even anonymous".
    stubFetch(() => new Response('<!DOCTYPE html><title>Sign in</title>', { status: 200 }))

    const notify = await loadNotify()
    await expect(notify(PAYLOAD)).resolves.toBe(false)
  })

  it('does not report failure for an unrecognised JSON success shape', async () => {
    // Guards against coupling to one revision of the script: only an explicit
    // error is a failure, so a changed success body cannot manufacture noise.
    stubFetch(() => new Response(JSON.stringify({ ok: true }), { status: 200 }))

    const notify = await loadNotify()
    await expect(notify(PAYLOAD)).resolves.toBe(true)
  })

  it('returns false when the request rejects, and says so in the log', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch(() => Promise.reject(new Error('network down')))

    const notify = await loadNotify()
    await expect(notify(PAYLOAD)).resolves.toBe(false)
    expect(error.mock.calls[0][0]).toContain('LINE greeting failed')
  })

  it('returns false when the 5s timeout aborts the request', async () => {
    stubFetch(() => Promise.reject(new DOMException('timed out', 'TimeoutError')))

    const notify = await loadNotify()
    await expect(notify(PAYLOAD)).resolves.toBe(false)
  })
})
