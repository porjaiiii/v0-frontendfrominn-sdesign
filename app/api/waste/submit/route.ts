import { NextRequest, NextResponse } from 'next/server'

import { getLineIdentity } from '@/lib/auth/verify-line-token'
import { backendFor, isMaintenance, MAINTENANCE_MESSAGE } from '@/lib/backend-flags'
import { parseJsonBody, readIdempotencyKey } from '@/lib/schemas/common'
import { submitWasteSchema } from '@/lib/schemas/waste'
import { submitWaste, WriteError } from '@/lib/supabase/writes'
import { carbonFactorFor, pointsPerKgFor } from '@/lib/rates'

const GOOGLE_APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_GAS_URL1 ?? ''

// GAS branch only, via lib/rates.ts — the Supabase branch prices from
// app.waste_types, which is the single LIVE copy of the same numbers.

/**
 * Supabase path. Three things differ from the GAS path below, all deliberate:
 *
 *   1. Identity comes from the verified LINE ID token, never `body.user_id`.
 *   2. Points and carbon are priced from app.waste_types, so a client cannot
 *      submit its own numbers.
 *   3. An `Idempotency-Key` header makes a retried submit return the ORIGINAL
 *      record with a 200 — never a second row. This is the duplicate-submit
 *      bug that prompted the migration.
 */
async function respondFromSupabase(request: NextRequest) {
  if (isMaintenance()) {
    return NextResponse.json({ error: MAINTENANCE_MESSAGE }, { status: 503 })
  }

  const identity = await getLineIdentity(request)
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await parseJsonBody(request, submitWasteSchema)
  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: parsed.status })
  }

  try {
    const { record, duplicate } = await submitWaste(
      identity.lineUserId,
      parsed.data,
      readIdempotencyKey(request),
    )

    return NextResponse.json({
      success: true,
      duplicate,
      data: {
        id: record.id,
        timestamp: record.timestamp,
        user_id: record.user_id,
        waste_type: record.waste_type,
        weight_kg: record.weight_kg,
        carbon_reduction: record.carbon_reduction,
        points_earned: record.points_earned,
        status: record.status,
      },
    })
  } catch (error) {
    if (error instanceof WriteError) {
      return NextResponse.json(
        { error: 'เกิดข้อผิดพลาดในการบันทึกขยะกรุณาลองใหม่', details: error.message },
        { status: error.status },
      )
    }
    console.error('[waste/submit] supabase write failed:', error)
    return NextResponse.json(
      {
        error: 'เซิร์ฟเวอร์หนาแน่น กรุณาลองใหม่อีกครั้ง',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  if (backendFor('wasteSubmit') === 'supabase') {
    return respondFromSupabase(request)
  }

  try {
    const body = await request.json()
    const {
      user_id,
      waste_type,
      waste_subtype,
      weight_kg,
      image_url,
      notes,
    } = body

    console.log('[v0] Received waste submission:', { user_id, waste_type, waste_subtype, weight_kg })

    if (!user_id || !waste_type || !waste_subtype || !weight_kg) {
      console.log('[v0] Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // คำนวณ carbon reduction และแต้มแยกกัน
    const carbonFactor = carbonFactorFor(waste_type)
    const carbonReduction = weight_kg * carbonFactor
    const pointsRate = pointsPerKgFor(waste_type)
    const pointsEarned = Math.round(weight_kg * pointsRate)

    // บันทึก timestamp
    const timestamp = new Date().toISOString()

    // ส่งข้อมูลไปยัง Google Apps Script Webhook
    const payload = {
      action: 'submitWaste',
      type: 'insert',
      status: 'done',
      timestamp,
      user_id,
      waste_type,
      waste_subtype,
      weight_kg,
      image_url: image_url || '',
      carbon_reduction: carbonReduction,
      points_earned: pointsEarned,
      notes: notes || ''
    }

    console.log('[v0] Sending to Google Apps Script...')
    
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    console.log('[v0] Google Apps Script response status:', response.status)

    const responseText = await response.text()

    // 1. ดักจับ Error ระดับ Network/Server ของ Google
    if (!response.ok) {
      console.error('[v0] Google Apps Script HTTP error:', {
        status: response.status,
        statusText: response.statusText,
        error: responseText.substring(0, 500)
      })
      return NextResponse.json(
        { 
          error: 'เกิดข้อผิดพลาดในการบันทึกขยะกรุณาลองใหม่',
          details: responseText.substring(0, 200),
          status: response.status,
        },
        { status: 500 }
      )
    }

    // 2. แปลง Response Text เป็น JSON
    let result
    try {
      result = JSON.parse(responseText)
    } catch (e) {
      console.error('[v0] Failed to parse JSON from Google Apps Script:', responseText)
      return NextResponse.json(
        { error: 'เกิดปัญหาที่ไม่ทราบสาเหตุกรุณาลองใหม่ภายหลัง', details: responseText.substring(0, 100) },
        { status: 500 }
      )
    }

    // 🔴 3. เพิ่มจุดนี้: ตรวจสอบ Error จากเนื้อหาภายในของ Google Apps Script (เช่น Lock Timeout หรือ Sheet พัง)
    if (result.status === 'error') {
      console.error('[v0] Google Apps Script logic error:', result.message)
      const isLockTimeout = result.message?.toLowerCase().includes('lock timeout') || result.message?.includes('busy')
      
      return NextResponse.json(
        { 
          error: isLockTimeout ? 'เซิร์ฟเวอร์หนาแน่น กรุณาลองใหม่อีกครั้ง' : (result.message || 'เซิร์ฟเวอร์หนาแน่น กรุณาลองใหม่อีกครั้ง'),
          details: result.message 
        },
        { status: isLockTimeout ? 429 : 400 }
      )
    }

    console.log('[v0] Data submitted successfully:', result)

    return NextResponse.json({
      success: true,
      data: {
        timestamp,
        user_id,
        waste_type,
        weight_kg,
        carbon_reduction: carbonReduction,
        points_earned: pointsEarned,
      },
    })
  } catch (error) {
    console.error('[v0] Error submitting waste record:', error)
    return NextResponse.json(
      { 
        error: 'เซิร์ฟเวอร์หนาแน่น กรุณาลองใหม่อีกครั้ง',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
