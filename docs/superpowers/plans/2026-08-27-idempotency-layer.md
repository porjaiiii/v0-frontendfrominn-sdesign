# Idempotency Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop duplicate executions of the four mutating API routes (points spend, waste submit, waste update, register) by adding a flag-gated idempotency layer in front of them.

**Architecture:** A three-module library under `lib/idempotency/`. A swappable `IdempotencyStore` interface with an in-memory `Map` implementation holds the ledger; a key module prefers the client's `Idempotency-Key` header and falls back to a server-derived SHA-256 hash; a `withIdempotency` wrapper claims the key, runs the handler, and either replays a stored response or returns 409. Routes are wrapped, not rewritten — their Apps Script call bodies stay untouched.

**Tech Stack:** Next.js 16 App Router, TypeScript 5.7 (strict), Node 26, pnpm, vitest (new).

**Spec:** `docs/superpowers/specs/2026-08-27-idempotency-layer-design.md`

## Global Constraints

- Package manager is **pnpm** (`node_modules/.pnpm` is the active store). Never run `npm install`.
- **Do not use `pnpm exec` or `pnpm run`.** Both run a pre-flight dependency check that fails in this environment (`ERR_PNPM_IGNORED_BUILDS: esbuild@0.28.2, sharp@0.34.5`), so the wrapped command never executes. This is pre-existing and affects `pnpm dev`, `pnpm build`, and `pnpm lint` equally — it is not caused by this work. Invoke binaries directly instead: `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/next build`. The permanent fix is for a maintainer to run `pnpm approve-builds` (it executes third-party postinstall scripts, so it is their call, not this plan's).
- **`tsc --noEmit` is not clean on this repo.** `main` has 15 pre-existing errors: 6 in `hooks/use-liff.ts`, 2 in `loadtest/write-load.ts`, 7 stale ones in `.next/types/validator.ts` pointing at routes that do not exist. Do not try to fix them — they are out of scope. Every typecheck step below filters to the paths this work touches.
- **The Next build does not catch type errors.** `next.config.mjs:3` sets `typescript.ignoreBuildErrors: true`. Build success proves the bundle compiles, not that types are sound. Typechecking is the filtered `tsc` command, not the build.
- TypeScript runs with `"strict": true`. No `any` in new code; use `unknown` and narrow.
- Path alias `@/*` maps to the repo root (`tsconfig.json:24`).
- Flag env var is exactly `IDEMPOTENCY_ENABLED`; enabled only when the value is `'1'` or `'true'`. **Default off.**
- Read the flag inside the request handler, never at module top level, so it can be flipped in Vercel without a redeploy.
- `IN_FLIGHT_TTL_MS = 60_000`, `DONE_TTL_MS = 300_000` (5 minutes), `MAX_ENTRIES = 5_000`. Exact values, no substitutions.
- Never change the Apps Script request/response shapes. This layer is transparent to GAS.
- Existing comments in the routes are in Thai. Leave them exactly as they are.
- Work on branch `feat/idempotency-layer`. Do not merge to `main`.

---

### Task 1: Test harness and the ledger store

**Files:**
- Create: `vitest.config.ts`
- Create: `lib/idempotency/store.ts`
- Test: `lib/idempotency/store.test.ts`
- Modify: `package.json` (add `test` script + vitest devDependency)

**Interfaces:**
- Consumes: nothing.
- Produces: `IdempotencyStore` (interface with `claim`/`complete`/`release`), `MemoryStore` (class, constructor takes an optional `now: () => number`), `Entry`, `ClaimResult`, `getStore()`, `setStore(store)`, and the constants `IN_FLIGHT_TTL_MS`, `DONE_TTL_MS`, `MAX_ENTRIES`.

- [ ] **Step 1: Install vitest and add the test script**

```bash
pnpm add -D vitest@^3
```

Then add to the `"scripts"` block of `package.json`, after the `"lint"` line:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 2: Create the vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': root },
  },
})
```

- [ ] **Step 3: Write the failing tests**

Create `lib/idempotency/store.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  MemoryStore,
  IN_FLIGHT_TTL_MS,
  DONE_TTL_MS,
  MAX_ENTRIES,
} from './store'

// A controllable clock so TTL tests need no fake timers.
function clock(start = 1_000_000) {
  let t = start
  return { now: () => t, advance: (ms: number) => { t += ms } }
}

describe('MemoryStore', () => {
  it('claims an unseen key', () => {
    const store = new MemoryStore()
    expect(store.claim('a')).toBe('claimed')
  })

  it('returns the in_flight entry on a second claim', () => {
    const store = new MemoryStore()
    store.claim('a')
    const result = store.claim('a')
    expect(result).not.toBe('claimed')
    expect(result).toMatchObject({ state: 'in_flight' })
  })

  it('returns the done entry with the stored body after complete', () => {
    const store = new MemoryStore()
    store.claim('a')
    store.complete('a', 201, { ok: true, id: 7 })
    const result = store.claim('a')
    expect(result).toMatchObject({
      state: 'done',
      httpStatus: 201,
      body: { ok: true, id: 7 },
    })
  })

  it('allows a fresh claim after release', () => {
    const store = new MemoryStore()
    store.claim('a')
    store.release('a')
    expect(store.claim('a')).toBe('claimed')
  })

  it('treats an expired in_flight entry as absent', () => {
    const c = clock()
    const store = new MemoryStore(c.now)
    store.claim('a')
    c.advance(IN_FLIGHT_TTL_MS)
    expect(store.claim('a')).toBe('claimed')
  })

  it('treats an expired done entry as absent', () => {
    const c = clock()
    const store = new MemoryStore(c.now)
    store.claim('a')
    store.complete('a', 200, { ok: true })
    c.advance(DONE_TTL_MS)
    expect(store.claim('a')).toBe('claimed')
  })

  it('evicts oldest-first and stays at the cap', () => {
    const store = new MemoryStore()
    for (let i = 0; i < MAX_ENTRIES + 10; i++) store.claim(`key-${i}`)
    expect(store.size()).toBeLessThanOrEqual(MAX_ENTRIES)
    // The very first keys are gone; the most recent survive.
    expect(store.claim('key-0')).toBe('claimed')
    expect(store.claim(`key-${MAX_ENTRIES + 9}`)).not.toBe('claimed')
  })
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `./node_modules/.bin/vitest run`
Expected: FAIL — `Failed to resolve import "./store"`.

- [ ] **Step 5: Implement the store**

Create `lib/idempotency/store.ts`:

```ts
/**
 * Ledger of in-flight and recently completed idempotent requests.
 *
 * The default implementation is an in-memory Map, scoped to a single lambda
 * instance. It catches duplicates that land on the same warm instance —
 * double-taps, client retries, StrictMode double-fires — and by design does
 * not catch duplicates split across instances, regions, or a cold start.
 *
 * Swapping in a shared store (Postgres, Redis) means implementing
 * IdempotencyStore and calling setStore() once at startup. No route changes.
 */

export type InFlightEntry = { state: 'in_flight'; startedAt: number }

export type DoneEntry = {
  state: 'done'
  httpStatus: number
  body: unknown
  completedAt: number
}

export type Entry = InFlightEntry | DoneEntry

export type ClaimResult = 'claimed' | Entry

export interface IdempotencyStore {
  /** Atomically reserve `key`, or report what already holds it. */
  claim(key: string): ClaimResult
  /** Record the final response so later duplicates can replay it. */
  complete(key: string, httpStatus: number, body: unknown): void
  /** Give the key back so a failed attempt stays retryable. */
  release(key: string): void
}

export const IN_FLIGHT_TTL_MS = 60_000
export const DONE_TTL_MS = 300_000
export const MAX_ENTRIES = 5_000

function isExpired(entry: Entry, now: number): boolean {
  return entry.state === 'in_flight'
    ? now - entry.startedAt >= IN_FLIGHT_TTL_MS
    : now - entry.completedAt >= DONE_TTL_MS
}

export class MemoryStore implements IdempotencyStore {
  private entries = new Map<string, Entry>()
  private now: () => number

  constructor(now: () => number = Date.now) {
    this.now = now
  }

  /**
   * Read-then-write in one synchronous block. JavaScript runs an event-loop
   * turn to completion, so no other request on this instance can interleave
   * between the get and the set — the claim is atomic instance-wide.
   */
  claim(key: string): ClaimResult {
    const now = this.now()
    const existing = this.entries.get(key)
    if (existing && !isExpired(existing, now)) return existing

    // Delete before re-setting so the key moves to the tail of the Map's
    // insertion order, which is what eviction reads as "newest".
    this.entries.delete(key)
    this.evictIfFull(now)
    this.entries.set(key, { state: 'in_flight', startedAt: now })
    return 'claimed'
  }

  complete(key: string, httpStatus: number, body: unknown): void {
    this.entries.set(key, {
      state: 'done',
      httpStatus,
      body,
      completedAt: this.now(),
    })
  }

  release(key: string): void {
    this.entries.delete(key)
  }

  /** Test seam. */
  size(): number {
    return this.entries.size
  }

  private evictIfFull(now: number): void {
    if (this.entries.size < MAX_ENTRIES) return

    for (const [k, entry] of this.entries) {
      if (isExpired(entry, now)) this.entries.delete(k)
    }

    // Map iterates in insertion order, so the front is the oldest claim.
    while (this.entries.size >= MAX_ENTRIES) {
      const oldest = this.entries.keys().next()
      if (oldest.done) break
      this.entries.delete(oldest.value)
    }
  }
}

let activeStore: IdempotencyStore = new MemoryStore()

export function getStore(): IdempotencyStore {
  return activeStore
}

/** Swap point for a shared store, and for test isolation. */
export function setStore(store: IdempotencyStore): void {
  activeStore = store
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `./node_modules/.bin/vitest run`
Expected: PASS — 7 passing in `store.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts lib/idempotency/store.ts lib/idempotency/store.test.ts package.json pnpm-lock.yaml
git commit -m "feat(idempotency): add ledger store with vitest harness"
```

---

### Task 2: Key derivation

**Files:**
- Create: `lib/idempotency/key.ts`
- Test: `lib/idempotency/key.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `canonicalJSON(value: unknown): string`, `extractUserId(body: unknown): string`, `deriveKey(args: { scope: string; headerKey: string | null; userId: string; body: unknown; now?: number }): string`, and the constants `KEY_HEADER` (`'idempotency-key'`) and `TIME_BUCKET_MS` (`60_000`).

- [ ] **Step 1: Write the failing tests**

Create `lib/idempotency/key.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./node_modules/.bin/vitest run key`
Expected: FAIL — `Failed to resolve import "./key"`.

- [ ] **Step 3: Implement key derivation**

Create `lib/idempotency/key.ts`:

```ts
import { createHash } from 'node:crypto'

/** Header name, lowercase — Headers.get() is case-insensitive. */
export const KEY_HEADER = 'idempotency-key'

/**
 * Width of the hash fallback's time bucket. Two identical payloads from one
 * user inside the same bucket are treated as the same action.
 */
export const TIME_BUCKET_MS = 60_000

/** Fields the covered routes use to identify the acting user. */
const USER_ID_FIELDS = ['user_id', 'lineUserId', 'userId'] as const

/**
 * JSON with object keys sorted recursively, so key stability does not depend
 * on the order the client happened to serialize its properties in.
 */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null'
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJSON).join(',')}]`
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJSON(v)}`)
    .join(',')}}`
}

export function extractUserId(body: unknown): string {
  if (!body || typeof body !== 'object') return 'anonymous'
  const record = body as Record<string, unknown>
  for (const field of USER_ID_FIELDS) {
    const value = record[field]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return 'anonymous'
}

/**
 * Prefer the client's Idempotency-Key. Fall back to a hash of the payload so
 * LIFF clients on an older bundle still get protection during rollout.
 */
export function deriveKey(args: {
  scope: string
  headerKey: string | null
  userId: string
  body: unknown
  now?: number
}): string {
  const { scope, headerKey, userId, body } = args

  const trimmed = headerKey?.trim()
  if (trimmed) return `${scope}:${trimmed}`

  const bucket = Math.floor((args.now ?? Date.now()) / TIME_BUCKET_MS)
  const hash = createHash('sha256')
    .update([scope, userId, canonicalJSON(body), bucket].join(' '))
    .digest('hex')
  return `${scope}:${hash}`
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `./node_modules/.bin/vitest run`
Expected: PASS — 7 in `store.test.ts`, 11 in `key.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/idempotency/key.ts lib/idempotency/key.test.ts
git commit -m "feat(idempotency): derive keys from client header with hash fallback"
```

---

### Task 3: The route wrapper

**Files:**
- Create: `lib/idempotency/with-idempotency.ts`
- Test: `lib/idempotency/with-idempotency.test.ts`

**Interfaces:**
- Consumes: `getStore`, `setStore`, `MemoryStore` from `./store`; `deriveKey`, `extractUserId`, `KEY_HEADER` from `./key`.
- Produces: `withIdempotency(scope: string, handler: IdempotentHandler, options?: IdempotencyOptions)` returning `(request: NextRequest) => Promise<Response>`; the types `IdempotentHandler = (request: NextRequest, ctx: { body: unknown }) => Promise<Response>` and `IdempotencyOptions = { shouldApply?: (body: unknown) => boolean }`; and `isEnabled(): boolean`.

- [ ] **Step 1: Write the failing tests**

Create `lib/idempotency/with-idempotency.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { withIdempotency } from './with-idempotency'
import { MemoryStore, setStore } from './store'

function req(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  setStore(new MemoryStore())
  process.env.IDEMPOTENCY_ENABLED = '1'
})

afterEach(() => {
  delete process.env.IDEMPOTENCY_ENABLED
})

describe('withIdempotency', () => {
  it('passes through untouched when the flag is off', async () => {
    delete process.env.IDEMPOTENCY_ENABLED
    const handler = vi.fn(async () => Response.json({ n: 1 }))
    const wrapped = withIdempotency('test', handler)

    await wrapped(req({ user_id: 'U1' }, { 'Idempotency-Key': 'k' }))
    await wrapped(req({ user_id: 'U1' }, { 'Idempotency-Key': 'k' }))

    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('hands the parsed body to the handler', async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }))
    const wrapped = withIdempotency('test', handler)

    await wrapped(req({ user_id: 'U1', points: 5 }))

    expect(handler.mock.calls[0][1]).toEqual({ body: { user_id: 'U1', points: 5 } })
  })

  it('replays the stored response and does not re-run the handler', async () => {
    const handler = vi.fn(async () => Response.json({ n: 1 }, { status: 201 }))
    const wrapped = withIdempotency('test', handler)

    const first = await wrapped(req({ user_id: 'U1' }, { 'Idempotency-Key': 'k' }))
    const second = await wrapped(req({ user_id: 'U1' }, { 'Idempotency-Key': 'k' }))

    expect(handler).toHaveBeenCalledTimes(1)
    expect(second.status).toBe(201)
    expect(second.headers.get('Idempotent-Replay')).toBe('true')
    expect(await second.json()).toEqual({ n: 1 })
    expect(await first.json()).toEqual({ n: 1 })
  })

  it('returns 409 while the first request is still in flight', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => { release = resolve })
    const handler = vi.fn(async () => { await gate; return Response.json({ ok: true }) })
    const wrapped = withIdempotency('test', handler)

    const first = wrapped(req({ user_id: 'U1' }, { 'Idempotency-Key': 'k' }))
    const second = await wrapped(req({ user_id: 'U1' }, { 'Idempotency-Key': 'k' }))

    expect(second.status).toBe(409)
    expect(second.headers.get('Retry-After')).toBe('1')

    release()
    await first
  })

  it('releases the key when the handler returns non-2xx, so a retry runs', async () => {
    const handler = vi.fn(async () => Response.json({ error: 'gas down' }, { status: 500 }))
    const wrapped = withIdempotency('test', handler)

    await wrapped(req({ user_id: 'U1' }, { 'Idempotency-Key': 'k' }))
    await wrapped(req({ user_id: 'U1' }, { 'Idempotency-Key': 'k' }))

    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('releases the key when the handler throws', async () => {
    const handler = vi.fn(async () => { throw new Error('boom') })
    const wrapped = withIdempotency('test', handler)

    await expect(wrapped(req({ user_id: 'U1' }, { 'Idempotency-Key': 'k' }))).rejects.toThrow('boom')
    await expect(wrapped(req({ user_id: 'U1' }, { 'Idempotency-Key': 'k' }))).rejects.toThrow('boom')

    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('skips the layer when shouldApply returns false', async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }))
    const wrapped = withIdempotency('points:spend', handler, {
      shouldApply: (body) => (body as { action?: string }).action === 'spend_points',
    })

    const body = { user_id: 'U1', action: 'resync_balance' }
    await wrapped(req(body, { 'Idempotency-Key': 'k' }))
    await wrapped(req(body, { 'Idempotency-Key': 'k' }))

    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('rejects a malformed JSON body with 400', async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }))
    const wrapped = withIdempotency('test', handler)

    const bad = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not json',
    })

    const res = await wrapped(bad)
    expect(res.status).toBe(400)
    expect(handler).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./node_modules/.bin/vitest run with-idempotency`
Expected: FAIL — `Failed to resolve import "./with-idempotency"`.

- [ ] **Step 3: Implement the wrapper**

Create `lib/idempotency/with-idempotency.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getStore } from './store'
import { deriveKey, extractUserId, KEY_HEADER } from './key'

export type IdempotentHandler = (
  request: NextRequest,
  ctx: { body: unknown }
) => Promise<Response>

export type IdempotencyOptions = {
  /** Narrow the layer to a subset of payloads, e.g. one `action` value. */
  shouldApply?: (body: unknown) => boolean
}

/**
 * Read per-request, never captured at module load, so the flag can be flipped
 * in the Vercel dashboard without a redeploy.
 */
export function isEnabled(): boolean {
  const value = process.env.IDEMPOTENCY_ENABLED
  return value === '1' || value === 'true'
}

export function withIdempotency(
  scope: string,
  handler: IdempotentHandler,
  options: IdempotencyOptions = {}
) {
  return async function idempotentRoute(request: NextRequest): Promise<Response> {
    // The body stream can only be consumed once, so read it here and hand the
    // parsed value to the handler rather than letting it call request.json().
    let body: unknown
    try {
      const text = await request.text()
      body = text ? JSON.parse(text) : {}
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!isEnabled() || options.shouldApply?.(body) === false) {
      return handler(request, { body })
    }

    const store = getStore()
    const key = deriveKey({
      scope,
      headerKey: request.headers.get(KEY_HEADER),
      userId: extractUserId(body),
      body,
    })

    const claim = store.claim(key)

    if (claim !== 'claimed') {
      if (claim.state === 'in_flight') {
        return NextResponse.json(
          { error: 'Request already in progress', code: 'idempotency_in_flight' },
          { status: 409, headers: { 'Retry-After': '1' } }
        )
      }
      return NextResponse.json(claim.body, {
        status: claim.httpStatus,
        headers: { 'Idempotent-Replay': 'true' },
      })
    }

    try {
      const response = await handler(request, { body })

      if (response.status >= 200 && response.status < 300) {
        // Clone before reading — the original body must stay unconsumed for
        // the caller.
        const payload = await response.clone().json().catch(() => null)
        store.complete(key, response.status, payload)
      } else {
        // A transient GAS failure must stay retryable rather than being
        // cached as a permanent answer.
        store.release(key)
      }

      return response
    } catch (error) {
      store.release(key)
      throw error
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `./node_modules/.bin/vitest run`
Expected: PASS — 7 store, 11 key, 8 wrapper.

- [ ] **Step 5: Commit**

```bash
git add lib/idempotency/with-idempotency.ts lib/idempotency/with-idempotency.test.ts
git commit -m "feat(idempotency): add route wrapper with replay and in-flight 409"
```

---

### Task 4: Wire the four routes

**Files:**
- Modify: `app/api/points/route.ts` (the `POST` export, currently line 125)
- Modify: `app/api/waste/submit/route.ts` (the `POST` export, currently line 21)
- Modify: `app/api/waste/update/route.ts` (the `PUT` and `POST` exports, currently lines 21 and end-of-file)
- Modify: `app/api/register/route.ts` (the `PATCH` and `POST` exports, currently line 5 and mid-file)
- Create: `.env.example`

**Interfaces:**
- Consumes: `withIdempotency` from `@/lib/idempotency/with-idempotency`.
- Produces: no new exports. Route handler signatures become `(request: NextRequest, ctx: { body: unknown })`.

The mechanical change in every route is the same three edits:
1. Add the import.
2. Rename `export async function METHOD(request: NextRequest)` to a local `async function methodHandler(request: NextRequest, { body }: { body: unknown })`.
3. Delete the `const body = await request.json()` line — `body` now arrives as a parameter.
4. Export the wrapped handler.

Destructuring like `const { user_id, waste_type } = body` needs `body` narrowed first, because `body` is `unknown` under strict mode. Each route below shows the exact cast to use.

- [ ] **Step 1: Wire `app/api/waste/submit/route.ts`**

Add after the existing imports at line 1:

```ts
import { withIdempotency } from '@/lib/idempotency/with-idempotency'
```

Change line 21 from:

```ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
```

to:

```ts
async function submitHandler(request: NextRequest, ctx: { body: unknown }) {
  try {
    const body = ctx.body as Record<string, any>
```

Then at the very end of the file, after the closing brace of `submitHandler`, add:

```ts
export const POST = withIdempotency('waste:submit', submitHandler)
```

- [ ] **Step 2: Wire `app/api/waste/update/route.ts`**

`POST` currently just delegates to `PUT`, so both methods share one scope.

Add after the existing imports at line 1:

```ts
import { withIdempotency } from '@/lib/idempotency/with-idempotency'
```

Change line 21 from:

```ts
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
```

to:

```ts
async function updateHandler(request: NextRequest, ctx: { body: unknown }) {
  try {
    const body = ctx.body as Record<string, any>
```

Then replace the existing trailing block:

```ts
export async function POST(request: NextRequest) {
  // Redirect POST to PUT
  return PUT(request)
}
```

with:

```ts
const handler = withIdempotency('waste:update', updateHandler)

export const PUT = handler
// POST is an alias for PUT — same operation, same idempotency scope.
export const POST = handler
```

- [ ] **Step 3: Wire `app/api/register/route.ts`**

Create and update are different operations, so they get different scopes — otherwise a client reusing one key across both would have its PATCH replay the POST's response.

Add after the existing import at line 1:

```ts
import { withIdempotency } from '@/lib/idempotency/with-idempotency'
```

Change line 5 from:

```ts
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
```

to:

```ts
async function updateHandler(request: NextRequest, ctx: { body: unknown }) {
  try {
    const body = ctx.body as Record<string, any>
```

Change the `POST` declaration from:

```ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
```

to:

```ts
async function createHandler(request: NextRequest, ctx: { body: unknown }) {
  try {
    const body = ctx.body as Record<string, any>
```

Then at the very end of the file add:

```ts
export const PATCH = withIdempotency('register:update', updateHandler)
export const POST = withIdempotency('register:create', createHandler)
```

- [ ] **Step 4: Wire `app/api/points/route.ts`**

Only `spend_points` is covered; `earn_points`, `resync_balance`, and `get_or_create_account` pass straight through. The `GET` export is untouched.

Add after the existing imports at line 1:

```ts
import { withIdempotency } from '@/lib/idempotency/with-idempotency'
```

Change line 125 from:

```ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
```

to:

```ts
async function pointsHandler(request: NextRequest, ctx: { body: unknown }) {
  try {
    const body = ctx.body as Record<string, any>
```

Then at the very end of the file add:

```ts
export const POST = withIdempotency('points:spend', pointsHandler, {
  // Only the spending path is idempotent-guarded; reads and resyncs are safe
  // to repeat and must not be deduplicated.
  shouldApply: (body) =>
    (body as { action?: string } | null)?.action === 'spend_points',
})
```

- [ ] **Step 5: Create `.env.example`**

Create `.env.example` with every variable the app reads, values blank:

```bash
# Supabase (migration in progress — not used by the GAS write paths)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
BACKEND_DEFAULT=

# LINE / LIFF
LINE_CHANNEL_ID=
NEXT_PUBLIC_LIFF_ID=

# Google Sheets + Apps Script
NEXT_PUBLIC_GAS_URL1=
POINTS_SPREADSHEET_ID=
REGISTRATION_SHEETS_ID=
GOOGLE_SHEETS_API_KEY=

# Vercel Blob
BLOB_READ_WRITE_TOKEN=

# Admin
ADMIN_SESSION_SECRET=

# Environment
NEXT_PUBLIC_ENV=

# Idempotency layer — set to 1 to enable. Default off.
IDEMPOTENCY_ENABLED=
```

- [ ] **Step 6: Verify the touched paths typecheck**

Stale `.next` type output references routes that no longer exist and pollutes
the report, so clear it first:

```bash
rm -rf .next
./node_modules/.bin/tsc --noEmit 2>&1 | grep -E '^(lib/idempotency|app/api)' || echo 'CLEAN'
```

Expected: `CLEAN`. If a route reports `'body' is of type 'unknown'`, the cast in
that route's handler was missed.

- [ ] **Step 7: Verify the tests still pass**

Run: `./node_modules/.bin/vitest run`
Expected: PASS — 26 tests, unchanged from Task 3.

- [ ] **Step 8: Verify the flag-off path by hand**

Start the dev server (`pnpm dev`), then with `IDEMPOTENCY_ENABLED` unset:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/waste/submit \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: manual-test-1' \
  -d '{"user_id":"TEST","waste_type":"plastic","waste_subtype":"bottle","weight_kg":1}'
```

Run it twice. Expected: both calls behave identically to before this change — the layer is inert.

Then restart with `IDEMPOTENCY_ENABLED=1 pnpm dev` and run the same command twice.
Expected: the second response carries `Idempotent-Replay: true`. Confirm with `-D -` in place of `-o /dev/null` to print headers.

- [ ] **Step 9: Commit**

```bash
git add app/api/points/route.ts app/api/waste/submit/route.ts \
  app/api/waste/update/route.ts app/api/register/route.ts .env.example
git commit -m "feat(idempotency): wire layer into points, waste, and register routes"
```

---

### Task 5: Client-minted keys

**Files:**
- Create: `lib/idempotency/client.ts`
- Modify: `lib/points-context.tsx:172-199` (`spendPoints`)
- Modify: `app/home/page.tsx:107-131` (`handleDoSave`)
- Modify: `components/waste-detail-modal.tsx:196-220`
- Modify: `components/waste-cart.tsx:148-170` (`handleSaveRecord`)
- Modify: `app/register/page.tsx:518-535`

**Interfaces:**
- Consumes: nothing from earlier tasks (this module is browser-side and standalone).
- Produces: `newIdempotencyKey(): string`.

The pattern at every call site: mint a key when the user taps, hold it in a
ref, **reuse it if the user retries after a failure**, and clear it on success.
Reuse is the whole point — a fresh key on retry would be a new operation.

- [ ] **Step 1: Create the key generator**

Create `lib/idempotency/client.ts`:

```ts
/**
 * Browser-side idempotency key. crypto.randomUUID needs a secure context and
 * is missing from some older in-app webviews, so fall back to a random string
 * rather than throwing inside the LINE browser.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}
```

- [ ] **Step 2: Wire `lib/points-context.tsx`**

Add to the existing `react` import at line 3 — it already imports `useCallback`, so add `useRef` to that list. Then add after the other imports:

```ts
import { newIdempotencyKey } from '@/lib/idempotency/client'
```

Inside `PointsProvider`, next to the other hooks, add:

```ts
// Held across retries so re-tapping Confirm after a failure is the same
// operation, not a second spend.
const spendKeyRef = useRef<string | null>(null)
```

In `spendPoints`, after the two guard clauses and before the `try`:

```ts
if (!spendKeyRef.current) spendKeyRef.current = newIdempotencyKey()
```

Change the `fetch` at line 177 to send the header:

```ts
        const res = await fetch('/api/points', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': spendKeyRef.current,
          },
```

And in the success branch, clear the ref before returning:

```ts
        if (data?.success) {
          spendKeyRef.current = null // next spend is a new operation
          await loadAccount(userId) // resync balance after spending
          return { success: true, tx_id: data.tx_id }
        }
```

- [ ] **Step 3: Wire `app/home/page.tsx`**

Add to the imports:

```ts
import { newIdempotencyKey } from '@/lib/idempotency/client'
```

Add a ref alongside the other `useState` declarations in the component:

```ts
const submitKeyRef = useRef<string | null>(null)
```

Make sure `useRef` is in the `react` import.

In `handleDoSave`, after `setIsSubmitting(true)`:

```ts
    if (!submitKeyRef.current) submitKeyRef.current = newIdempotencyKey()
```

Change the fetch at line 115:

```ts
      const response = await fetch('/api/waste/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': submitKeyRef.current,
        },
```

And clear it on success, replacing the existing success line:

```ts
      // Show the existing carbon result modal first
      submitKeyRef.current = null
      setShowResult(true)
```

- [ ] **Step 4: Wire `components/waste-detail-modal.tsx`**

Add the import and a ref (add `useRef` to the `react` import if absent):

```ts
import { newIdempotencyKey } from '@/lib/idempotency/client'
```

```ts
const saveKeyRef = useRef<string | null>(null)
```

After `setIsSavingApi(true)`:

```ts
    if (!saveKeyRef.current) saveKeyRef.current = newIdempotencyKey()
```

Change the fetch at line 209:

```ts
      const response = await fetch('/api/waste/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': saveKeyRef.current,
        },
        body: JSON.stringify(payload), // 👈 ส่ง payload ตัวที่ปรับชื่อ key แล้ว
      })
```

Clear the key just before `onConfirm`:

```ts
    saveKeyRef.current = null
    // อาจจะต้องปรับ type ของ onConfirm ถ้ารับค่าต่างกัน
    await onConfirm(editedRecord)
```

- [ ] **Step 5: Wire `components/waste-cart.tsx` and fix a double-read bug**

This function calls `response.json()` twice — once into `resData`, then again
inside the `!response.ok` branch. The second call throws `body stream already
read`, so a save failure surfaces as an unrelated crash instead of the intended
alert. Fix it while wiring the key by reusing `resData`.

Add the import and a ref (add `useRef` to the `react` import if absent):

```ts
import { newIdempotencyKey } from '@/lib/idempotency/client'
```

```ts
const saveKeyRef = useRef<string | null>(null)
```

Replace the body of `handleSaveRecord` from `setSavingRecordId(recordId)`
through the `if (!response.ok)` block with:

```ts
      setSavingRecordId(recordId)

      if (!saveKeyRef.current) saveKeyRef.current = newIdempotencyKey()

      const response = await fetch('/api/waste/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': saveKeyRef.current,
        },
        body: JSON.stringify(record),
      })
      const resData = await response.json()
      console.log('ผลลัพธ์จาก API:', resData)

      if (!response.ok) {
        // reuse resData — the body stream is already consumed above
        alert('เกิดข้อผิดพลาดในการบันทึก: ' + (resData?.error || 'Unknown error'))
        return
      }

      saveKeyRef.current = null
```

- [ ] **Step 6: Wire `app/register/page.tsx`**

Add the import and a ref (add `useRef` to the `react` import if absent):

```ts
import { newIdempotencyKey } from '@/lib/idempotency/client'
```

```ts
const registerKeyRef = useRef<string | null>(null)
```

Before the fetch at line 527:

```ts
      if (!registerKeyRef.current) registerKeyRef.current = newIdempotencyKey()

      const response = await fetch('/api/register', {
        method: isEditMode ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': registerKeyRef.current,
        },
        body: JSON.stringify(requestBody),
      })
```

Clear it after the `!response.ok` guard passes, on the line before the
`if (!isEditMode && formData.lineUserId)` block:

```ts
      registerKeyRef.current = null
```

- [ ] **Step 7: Verify typecheck and tests**

```bash
./node_modules/.bin/tsc --noEmit 2>&1 \
  | grep -E '^(lib/idempotency|lib/points-context|app/home|app/register|components/waste)' \
  || echo 'CLEAN'
./node_modules/.bin/vitest run
```

Expected: `CLEAN`, then 26 tests passing.

- [ ] **Step 8: Verify the production build**

Run: `./node_modules/.bin/next build`
Expected: build completes. This validates that Next accepts the changed route
exports (`export const POST = ...` in place of `export async function POST`) and
that the client bundles compile. It does **not** validate types — Step 7 is what
does that.

- [ ] **Step 9: Commit**

```bash
git add lib/idempotency/client.ts lib/points-context.tsx app/home/page.tsx \
  components/waste-detail-modal.tsx components/waste-cart.tsx app/register/page.tsx
git commit -m "feat(idempotency): mint and reuse client keys across the five call sites"
```

---

## Verification

After Task 5, confirm end to end:

1. `./node_modules/.bin/vitest run` — 26 passing.
2. `./node_modules/.bin/tsc --noEmit` — no errors in any touched path (the 15 pre-existing errors in `hooks/use-liff.ts` and `loadtest/` remain, untouched).
3. `./node_modules/.bin/next build` — completes.
4. With the flag unset, every route behaves exactly as it did before. This is the state that ships when the branch merges.
5. With `IDEMPOTENCY_ENABLED=1`, a repeated request carrying the same `Idempotency-Key` returns `Idempotent-Replay: true` and does not reach Apps Script — check the dev server log for the absence of a second `[v0] Sending to Google Apps Script...` line.
