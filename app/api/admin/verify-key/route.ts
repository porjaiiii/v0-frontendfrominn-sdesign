import { NextResponse } from 'next/server'
import { ADMIN_SCRIPT_URL } from '@/lib/admin-config'

export async function POST(request: Request) {
  try {
    const { adminKey, userId } = await request.json()

    if (!adminKey || typeof adminKey !== 'string') {
      return NextResponse.json({ error: 'adminKey is required' }, { status: 400 })
    }

    // เรียก GAS ด้วย GET + query string (pattern เดียวกับ route อื่นในโปรเจกต์)
    const url = new URL(ADMIN_SCRIPT_URL)
    url.searchParams.set('action', 'verifyAdminKey')
    url.searchParams.set('adminKey', adminKey)
    url.searchParams.set('userId', userId ?? '')

    const gasRes = await fetch(url.toString(), { method: 'GET', redirect: 'follow' })

    let result: { status?: string; message?: string; reason?: string }
    try {
      result = await gasRes.json()
    } catch {
      const text = await gasRes.text().catch(() => '')
      console.error('[admin/verify-key] GAS non-JSON:', text.substring(0, 200))
      return NextResponse.json({ error: 'Invalid response from GAS' }, { status: 500 })
    }

    if (result.status === 'success') {
      return NextResponse.json({ success: true })
    }

    // GAS ส่ง reason กลับมาตรงๆ เช่น 'KEY_TAKEN', 'KEY_INVALID', 'MISSING_PARAMS' ฯลฯ
    const reason = result.reason ?? ''

    if (reason === 'KEY_TAKEN') {
      return NextResponse.json({ error: 'KEY_TAKEN' }, { status: 403 })
    }

    if (reason === 'KEY_INVALID') {
      return NextResponse.json({ error: 'KEY_INVALID' }, { status: 404 })
    }

    if (reason === 'MISSING_PARAMS') {
      return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 })
    }

    if (reason === 'SHEET_NOT_FOUND') {
      return NextResponse.json({ error: 'SHEET_NOT_FOUND' }, { status: 500 })
    }

    return NextResponse.json({ error: reason || result.message || 'UNKNOWN_ERROR' }, { status: 400 })
  } catch (err) {
    console.error('[admin/verify-key] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
