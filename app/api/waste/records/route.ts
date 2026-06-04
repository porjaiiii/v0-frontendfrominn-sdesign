import { getWasteRecords, calculateUserStats } from '@/lib/google-sheets'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const action = searchParams.get('action')

    // ถ้า action เป็น 'stats' ให้คำนวณสถิติ
    if (action === 'stats' && user_id) {
      const stats = await calculateUserStats(user_id)
      return NextResponse.json({
        success: true,
        data: stats,
      })
    }

    // ถ้าไม่มี action ให้ดึงบันทึกขยะ
    const records = await getWasteRecords(user_id || undefined)

    return NextResponse.json({
      success: true,
      count: records.length,
      data: records,
    })
  } catch (error) {
    console.error('[v0] API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch waste records' },
      { status: 500 }
    )
  }
}
