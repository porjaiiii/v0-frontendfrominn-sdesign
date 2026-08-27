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
