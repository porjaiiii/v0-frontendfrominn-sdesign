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
