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
