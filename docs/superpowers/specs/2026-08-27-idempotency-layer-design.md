# Idempotency Layer for Production Write Paths

**Date:** 2026-08-27
**Branch:** `feat/idempotency-layer`
**Status:** Approved for implementation

## Problem

Every write path on `main` is a thin Next.js proxy in front of Google Apps
Script and Google Sheets. The routes hold no state and perform no
read-before-write, so nothing stops the same user action from executing twice:

- A double-tap on Confirm sends two requests.
- A client auto-retry after a slow Apps Script response re-sends the request
  that already succeeded.
- React StrictMode fires an effect twice in development.

The consequences are real. A duplicate `spend_points` silently burns a user's
points. A duplicate `waste/submit` grants points twice for one bag of waste,
inflating the points economy. A duplicate `register` writes a second row for
the same LINE user.

## Scope

This spec delivers **idempotency only**. It does not deliver atomicity.

The checkout flow spends points through one Apps Script and issues a coupon
through a different script backed by a different spreadsheet. A crash between
those two calls still burns points without issuing a coupon. Fixing that
requires a transactional datastore and is explicitly out of scope here.

**Covered routes:**

| Route | Methods | Scope |
| --- | --- | --- |
| `app/api/points/route.ts` | POST, `action === 'spend_points'` only | `points:spend` |
| `app/api/waste/submit/route.ts` | POST | `waste:submit` |
| `app/api/waste/update/route.ts` | PUT, POST | `waste:update` |
| `app/api/register/route.ts` | POST, PATCH | `register` |

**Not covered:** `/api/coupons/*`, `/api/upload-image`, and all GET routes.

## Known limitation: single-instance ledger

The ledger is an in-memory `Map` local to one lambda instance. It catches
duplicates that land on the same warm instance — double-taps, client retries,
StrictMode double-fires — which is the large majority of real duplicates.

It does **not** catch duplicates split across instances, regions, or a cold
start. This is an accepted stopgap, chosen deliberately with the tradeoff
understood.

The design contains that limitation to a single file. `MemoryStore` sits behind
an `IdempotencyStore` interface, so replacing it with a Postgres or Redis
implementation later means adding one file and changing one line of wiring. No
route code changes on that swap.

## Architecture

### `lib/idempotency/store.ts`

```ts
export type Entry =
  | { state: 'in_flight'; startedAt: number }
  | { state: 'done'; httpStatus: number; body: unknown; completedAt: number }

export interface IdempotencyStore {
  claim(key: string): 'claimed' | Entry
  complete(key: string, httpStatus: number, body: unknown): void
  release(key: string): void
}
```

`MemoryStore implements IdempotencyStore` over a module-level `Map`.

`claim` is synchronous: it reads the map and writes an `in_flight` entry within
a single uninterrupted block. Because JavaScript runs one event-loop turn to
completion, no other request on the instance can interleave between the read and
the write. The claim is therefore atomic with respect to instance-local
concurrency, which is exactly the concurrency this store is scoped to cover.

**Expiry.** Two windows, both checked lazily on access:

- `in_flight`: **60 seconds.** A request that crashed without calling
  `complete` or `release` must not wedge its key permanently. An expired
  `in_flight` entry is treated as absent and re-claimed.
- `done`: **5 minutes.** Covers immediate double-taps and automatic client
  retries.

**Memory bound.** A hard cap of 5,000 entries. On insert past the cap, evict
oldest-first by timestamp. Combined with the short TTLs, a long-lived instance
cannot grow without bound.

### `lib/idempotency/key.ts`

Two sources, in priority order:

1. **Client header.** The `Idempotency-Key` request header, when present.
2. **Server-derived hash.** `sha256(scope + user_id + canonicalJSON(body) +
   timeBucket)` using `node:crypto`, where `timeBucket = floor(Date.now() /
   60_000)`.

`canonicalJSON` serializes with recursively sorted object keys, so `{a:1,b:2}`
and `{b:2,a:1}` produce the same hash. Without it, key stability would depend on
client property order.

Every key is namespaced as `${scope}:${raw}` so the same UUID sent to two
different routes cannot collide.

The hash fallback exists so LIFF clients running an older bundle still get
protection during rollout, before every client sends the header.

### `lib/idempotency/with-idempotency.ts`

```ts
withIdempotency(scope, handler, { shouldApply? })
```

When `IDEMPOTENCY_ENABLED` is not set, the wrapper calls the handler directly
and adds no behavior.

When enabled:

1. Read the request body **once** as text and parse it. `request.json()` can
   only be consumed once, so the wrapper parses and passes the result to the
   handler as a second argument. Covered route handlers change signature from
   `(request)` to `(request, { body })`.
2. If `shouldApply(body)` is provided and returns false, call the handler
   directly. This is how `/api/points` is scoped to `spend_points` alone,
   leaving `earn_points` and `resync_balance` untouched.
3. Derive the key and `claim` it:
   - `'claimed'` → run the handler. On a 2xx response call `complete()`. On a
     non-2xx response call `release()`, so a genuine failure remains
     retryable rather than being cached as a permanent result.
   - `in_flight` → return **409** with `Retry-After: 1`.
   - `done` → replay the stored status and body, with header
     `Idempotent-Replay: true`.
4. If the handler throws, call `release()` and rethrow. A crash must never
   leave a key claimed.

Returning 409 while in-flight rather than blocking keeps the lambda from
holding two concurrent invocations open on one user action.

### Client key minting

Each call site mints `crypto.randomUUID()` when the user taps, holds it in
component or context state, and **reuses the same value if the user retries
after a failure**. That reuse is what makes a re-tap idempotent instead of a
new operation. The key is cleared on success so the next genuine action gets a
fresh one.

Call sites:

- `lib/points-context.tsx:177` — `spendPoints`, driven by
  `app/checkout/page.tsx:41`
- `app/home/page.tsx:115` — waste submit
- `components/waste-detail-modal.tsx:209` — waste update
- `components/waste-cart.tsx:154` — waste update
- `app/register/page.tsx:527` — register POST and PATCH

## Configuration

`IDEMPOTENCY_ENABLED` — env var, **default off**. Read per-request rather than
captured at module load, so it can be flipped in the Vercel dashboard without a
redeploy.

`.env.example` does not currently exist on disk. It will be created listing
every variable the app reads, with blank values.

## Rollout

Build on `feat/idempotency-layer`, off `main`. Merge with the flag off, so
merging changes nothing for users. Flip the flag when ready; flip it back to
disable instantly without a deploy.

## Testing

The project has no test runner. Add **vitest** as a devDependency with a `test`
script.

The store, key derivation, and wrapper are pure and synchronous, so they test
directly with no network or Apps Script involvement.

**Store:**
1. First `claim` on an unseen key returns `'claimed'`.
2. Second `claim` while in-flight returns the `in_flight` entry.
3. `claim` after `complete` returns the `done` entry with the stored body.
4. `claim` after `release` returns `'claimed'` again.
5. An `in_flight` entry older than 60s is treated as absent and re-claimed.
6. A `done` entry older than 5 minutes is treated as absent.
7. Inserting past the 5,000 cap evicts oldest-first and keeps size at the cap.

**Key derivation:**
8. The `Idempotency-Key` header wins over the derived hash.
9. Absent the header, the same body yields the same key inside one time bucket.
10. Property order in the body does not change the key.
11. The same key under two different scopes does not collide.

**Wrapper:**
12. Flag off → handler runs, no store interaction.
13. Duplicate after success → replays stored status and body, sets
    `Idempotent-Replay`, and does not invoke the handler a second time.
14. Duplicate while in-flight → 409.
15. Handler returning non-2xx → key released, so an immediate retry executes.
16. Handler throwing → key released, error propagates.
17. `shouldApply` returning false → handler runs, no key claimed.

## Files

**New:**
- `lib/idempotency/store.ts`
- `lib/idempotency/key.ts`
- `lib/idempotency/with-idempotency.ts`
- `lib/idempotency/*.test.ts`
- `vitest.config.ts`
- `.env.example`

**Modified:**
- `app/api/points/route.ts`
- `app/api/waste/submit/route.ts`
- `app/api/waste/update/route.ts`
- `app/api/register/route.ts`
- `lib/points-context.tsx`
- `app/home/page.tsx`
- `components/waste-detail-modal.tsx`
- `components/waste-cart.tsx`
- `app/register/page.tsx`
- `package.json`
