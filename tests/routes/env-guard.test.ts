import { describe, expect, it } from 'vitest'

// Guards the guard in tests/routes/setup.ts.
//
// The fixtures INSERT a user with waste records, point lots, transactions and
// coupons and then DELETE it. .env.local points at the HOSTED Supabase
// whenever anyone has been running the app or the migration scripts, so
// without the strip in setup.ts, `pnpm test:routes` writes that fixture data
// into live data.
//
// This asserts the invariant rather than the mechanism: by the time any test
// runs, SUPABASE_URL is either unset or local. It fails loudly if someone
// removes the strip.
describe('route tests never point at a hosted database', () => {
  it('leaves SUPABASE_URL either unset or local', () => {
    const url = process.env.SUPABASE_URL

    if (url === undefined) return

    expect(new URL(url).hostname).toMatch(/^(127\.0\.0\.1|localhost|::1)$/)
  })

  it('drops the service-role key along with a non-local url', () => {
    // The two travel together: a key without a url cannot reach anything, but
    // leaving a live service-role key in the environment of a test run is the
    // kind of thing that gets picked up by the next thing that looks for one.
    if (process.env.SUPABASE_URL === undefined) {
      expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined()
    }
  })
})
