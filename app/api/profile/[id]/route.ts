import { NextRequest, NextResponse } from 'next/server'

import { backendFor } from '@/lib/backend-flags'
import { getProfile } from '@/lib/supabase/reads'

// Allow up to 60 s so fetchWithRetry (25 s × 2 + 1 s back-off) can complete on
// the GAS path. The Supabase path answers in a single query.
export const maxDuration = 60

// Never cache profile lookups. A stale 404 (e.g. fetched right after a row was
// deleted during testing) would otherwise keep a re-registered user flagged as
// "not registered" until their browser cache cleared.
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' } as const

const GOOGLE_APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_GAS_URL1 ?? ''

const GENERIC_ERROR = 'เกิดข้อผิดพลาดในการสดงผลโปรดลองอีกครั้งภายหลัง'

/**
 * Supabase path.
 *
 * No fail-open-503 branch: "no row" and "the backend is unwell" are different
 * outcomes here, so a miss is an honest 404. The GAS path below still needs the
 * fail-open, because getUser returns status:'error' for both cases and a 404
 * would bounce a registered user back to /register on a cold start. That branch
 * dies with the GAS path in Phase 9, not before.
 */
async function respondFromSupabase(lineId: string) {
  const profile = await getProfile(lineId)

  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404, headers: NO_STORE })
  }

  return NextResponse.json(profile, { headers: NO_STORE })
}

async function respondFromGas(lineId: string) {
  const payload = { action: 'getUser', lineUserId: lineId }

  // Retry helper — GAS can return transient errors on cold start
  const fetchWithRetry = async (retries = 2): Promise<Response> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 25_000) // 25 s per attempt
      try {
        const res = await fetch(GOOGLE_APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
        clearTimeout(timer)
        return res
      } catch (err: unknown) {
        clearTimeout(timer)
        const isAbort = err instanceof DOMException && err.name === 'AbortError'
        console.warn(
          `[profile] GAS attempt ${attempt} failed (${isAbort ? 'timeout' : err}). Retries left: ${retries - attempt}`,
        )
        if (attempt === retries) throw err
        await new Promise((r) => setTimeout(r, 1_000))
      }
    }
    throw new Error('unreachable')
  }

  const response = await fetchWithRetry(2)

  if (!response.ok) {
    console.error('[profile] GAS HTTP error:', response.status, response.statusText)
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
  }

  const responseText = await response.text()

  let result: { status?: string; data?: unknown; message?: string }
  try {
    result = JSON.parse(responseText)
  } catch {
    console.error('[profile] non-JSON response:', responseText.slice(0, 500))
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
  }

  if (result.status === 'success' && result.data) {
    return NextResponse.json(result.data, { headers: NO_STORE })
  }

  if (result.status === 'error') {
    // GAS returns 'error' both for "user not found" and for transient failures,
    // so only an explicit not-found message becomes a 404.
    const msg = (result.message || '').toLowerCase()
    const isNotFound =
      msg.includes('not found') || msg.includes('ไม่พบ') || msg.includes('no user')

    if (isNotFound) {
      return NextResponse.json(
        { error: result.message || 'User not found' },
        { status: 404, headers: NO_STORE },
      )
    }

    // Ambiguous — fail open rather than redirect a registered user to /register.
    console.warn('[profile] GAS ambiguous error, failing open:', result.message)
    return NextResponse.json(
      { error: result.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 503 },
    )
  }

  return NextResponse.json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 500 })
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: lineId } = await context.params

    if (!lineId) {
      return NextResponse.json({ error: 'LINE ID is required' }, { status: 400 })
    }

    return backendFor('profile') === 'supabase'
      ? await respondFromSupabase(lineId)
      : await respondFromGas(lineId)
  } catch (error) {
    console.error('[profile] error:', error)
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
  }
}
