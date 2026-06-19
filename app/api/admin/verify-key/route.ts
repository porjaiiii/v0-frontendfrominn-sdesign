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
    url.searchParams.set('admin_key', adminKey)
    url.searchParams.set('user_id', userId ?? '')

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

    // แยก error reason เพื่อให้ frontend แสดงข้อความที่ถูกต้อง
    const reason = (result.reason ?? result.message ?? '').toLowerCase()

    if (reason.includes('bound') || reason.includes('taken') || reason.includes('other')) {
      // key ถูกผูกกับ user อื่นแล้ว
      return NextResponse.json({ error: 'KEY_TAKEN' }, { status: 403 })
    }

    if (reason.includes('not found') || reason.includes('invalid') || reason.includes('ไม่พบ')) {
      // key ไม่มีใน sheet
      return NextResponse.json({ error: 'KEY_INVALID' }, { status: 404 })
    }

    return NextResponse.json({ error: result.message ?? 'UNKNOWN_ERROR' }, { status: 400 })
  } catch (err) {
    console.error('[admin/verify-key] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
