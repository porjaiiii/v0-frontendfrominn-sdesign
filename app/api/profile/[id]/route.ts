import { NextRequest, NextResponse } from 'next/server'

// Allow up to 60 s so fetchWithRetry (25 s × 2 + 1 s back-off) can complete
export const maxDuration = 60

// Never cache profile lookups. A stale 404 (e.g. fetched right after a row was
// deleted during testing) would otherwise keep a re-registered user flagged as
// "not registered" until their browser cache cleared.
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' } as const

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxXbPMRk1PXSbw5vLEvbCQPfFkPZithJXStciUM2oZ__y9ct1OPVUlM-YfvF7ZpDVKG/exec'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lineId } = await context.params

    if (!lineId) {
      return NextResponse.json(
        { error: 'LINE ID is required' },
        { status: 400 }
      )
    }

    console.log('[v0] API: Fetching profile for LINE ID:', lineId)

    // ส่ง request ไปหา Google Apps Script เพื่อดึงข้อมูลจาก Registration sheet
    const payload = {
      action: 'getUser',
      lineUserId: lineId,
    }

    console.log('[v0] Sending request to Google Apps Script:', GOOGLE_APPS_SCRIPT_URL)

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
          console.log(`[v0] GAS attempt ${attempt} status:`, res.status)
          return res
        } catch (err: unknown) {
          clearTimeout(timer)
          const isAbort = err instanceof DOMException && err.name === 'AbortError'
          console.warn(`[v0] GAS attempt ${attempt} failed (${isAbort ? 'timeout' : err}). Retries left: ${retries - attempt}`)
          if (attempt === retries) throw err
          // Short back-off before retry
          await new Promise((r) => setTimeout(r, 1_000))
        }
      }
      throw new Error('unreachable')
    }

    const response = await fetchWithRetry(2)

    if (!response.ok) {
      console.error('[v0] Failed to fetch from Google Apps Script:', response.statusText)
      return NextResponse.json(
        { error: 'Failed to fetch from Google Apps Script' },
        { status: 500 }
      )
    }

    const responseText = await response.text()
    console.log('[v0] Response body:', responseText.substring(0, 500))

    let result
    try {
      result = JSON.parse(responseText)
    } catch (e) {
      console.error('[v0] Failed to parse JSON response:', responseText)
      return NextResponse.json(
        { error: 'Invalid response format' },
        { status: 500 }
      )
    }

    if (result.status === 'success' && result.data) {
      console.log('[v0] Found user:', result.data.fullName)
      return NextResponse.json(result.data, { headers: NO_STORE })
    } else if (result.status === 'error') {
      // GAS returns 'error' both for "user not found" and for transient failures.
      // To avoid redirecting registered users to /register due to a cold-start
      // glitch, we check whether the message explicitly says "not found".
      // Only then do we return 404. Everything else is treated as a 503 so the
      // guard fails open instead of redirecting.
      const msg: string = (result.message || '').toLowerCase()
      const isNotFound =
        msg.includes('not found') ||
        msg.includes('ไม่พบ') ||
        msg.includes('no user') ||
        msg.includes('user not found')

      if (isNotFound) {
        console.log('[v0] User definitively not found:', result.message)
        return NextResponse.json(
          { error: result.message || 'User not found' },
          { status: 404, headers: NO_STORE }
        )
      }

      // Ambiguous error — fail open
      console.warn('[v0] GAS returned error (ambiguous), failing open:', result.message)
      return NextResponse.json(
        { error: result.message || 'GAS error' },
        { status: 503 }
      )
    } else {
      return NextResponse.json(
        { error: 'Unexpected response format' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[v0] API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}
