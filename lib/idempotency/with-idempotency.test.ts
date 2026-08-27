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
