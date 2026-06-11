import { NextRequest, NextResponse } from 'next/server'
import { POINTS_SCRIPT_URL } from '@/lib/points-config'

// GET /api/points?action=get_balance&user_id=xxx
// GET /api/points?action=get_transactions&user_id=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action  = searchParams.get('action')
    const user_id = searchParams.get('user_id')

    if (!action)  return NextResponse.json({ error: 'Missing action'  }, { status: 400 })
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    const url = `${POINTS_SCRIPT_URL}?action=${encodeURIComponent(action)}&user_id=${encodeURIComponent(user_id)}`
    const response = await fetch(url)

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error: 'Points script error', details: error.substring(0, 200) }, { status: 500 })
    }

    const result = await response.json()
    return NextResponse.json(result)

  } catch (error) {
    console.error('[points] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch points data' }, { status: 500 })
  }
}

// POST /api/points
// body: { action, user_id, ...extra params }
//
// Supported actions:
//   get_or_create_account  — { user_id }
//   earn_points            — { user_id, points, co2?, weight?, waste_type? }
//   spend_points           — { user_id, points }
//   resync_balance         — { user_id }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, user_id } = body

    if (!action)  return NextResponse.json({ error: 'Missing action'  }, { status: 400 })
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    console.log('[points] action:', action, '| user_id:', user_id)

    const response = await fetch(POINTS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    console.log('[points] script response status:', response.status)

    if (!response.ok) {
      const error = await response.text()
      console.error('[points] script error:', error.substring(0, 500))
      return NextResponse.json(
        { error: 'Points script error', details: error.substring(0, 200) },
        { status: 500 }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)

  } catch (error) {
    console.error('[points] POST error:', error)
    return NextResponse.json({ error: 'Failed to process points action' }, { status: 500 })
  }
}
