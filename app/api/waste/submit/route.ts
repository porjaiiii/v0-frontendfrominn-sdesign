import { submitWasteRecord } from '@/lib/google-sheets'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // ตรวจสอบฟิลด์ที่จำเป็น
    const { user_id, waste_type, waste_subtype, weight_kg, carbon_reduction, points_earned, image_url, notes } = body

    if (!user_id || !waste_type || !waste_subtype || !weight_kg) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // บันทึกข้อมูลไปยัง Google Sheet
    const result = await submitWasteRecord({
      timestamp: new Date().toISOString(),
      user_id,
      waste_type,
      waste_subtype,
      weight_kg: parseFloat(weight_kg),
      image_url,
      carbon_reduction: parseFloat(carbon_reduction),
      points_earned: parseFloat(points_earned),
      status: 'verified',
      notes,
    })

    return NextResponse.json({
      success: true,
      message: 'Waste record submitted successfully',
      data: result,
    })
  } catch (error) {
    console.error('[v0] API error:', error)
    return NextResponse.json(
      { error: 'Failed to submit waste record' },
      { status: 500 }
    )
  }
}
