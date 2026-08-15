import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_GAS_URL2 ?? ''

const CARBON_FACTORS = {
  plastic: 1.0310,
  paper: 3.5460,
  glass: 0.2760,
  aluminum: 9.1270,
  oil: 3.0,
}

const POINTS_PER_KG = {
  plastic: 6,
  paper: 4,
  glass: 4,
  aluminum: 25,
  oil: 3,
}

export async function POST(request: NextRequest) {
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
    const carbonFactor = CARBON_FACTORS[waste_type as keyof typeof CARBON_FACTORS] || 1.0
    const carbonReduction = weight_kg * carbonFactor
    const pointsRate = POINTS_PER_KG[waste_type as keyof typeof POINTS_PER_KG] || 3
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
