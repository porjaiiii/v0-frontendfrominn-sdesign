import { NextRequest, NextResponse } from 'next/server'

const SHEET_ID = '1SK_Nat8jb3iQWt-Gs_YUimycxMTcubV5ViD_QtqkO78'
const SHEET_NAME = 'submissions'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    const apiKey = process.env.GCP_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google API key not configured' },
        { status: 500 }
      )
    }

    // ดึงข้อมูลทั้งหมดจาก Sheet
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.statusText}`)
    }

    const data = await response.json()
    const rows = data.values || []

    // ข้ามส่วนหัว (header row)
    if (rows.length === 0) {
      return NextResponse.json({ records: [], stats: null })
    }

    const [headers, ...records] = rows

    // แปลง rows เป็น objects
    const parsedRecords = records.map((row: any[]) => ({
      timestamp: row[0],
      user_id: row[1],
      waste_type: row[2],
      waste_subtype: row[3],
      weight_kg: parseFloat(row[4]) || 0,
      image_url: row[5],
      carbon_reduction: parseFloat(row[6]) || 0,
      points_earned: parseFloat(row[7]) || 0,
      status: row[8],
      notes: row[9],
    }))

    // กรองตาม user_id ถ้ามี
    let filteredRecords = parsedRecords
    if (userId) {
      filteredRecords = parsedRecords.filter((record: any) => record.user_id === userId)
    }

    // คำนวณสถิติ
    const stats = {
      total_records: filteredRecords.length,
      total_weight: filteredRecords.reduce((sum: number, r: any) => sum + r.weight_kg, 0),
      total_carbon: filteredRecords.reduce((sum: number, r: any) => sum + r.carbon_reduction, 0),
      total_points: filteredRecords.reduce((sum: number, r: any) => sum + r.points_earned, 0),
    }

    return NextResponse.json({
      records: filteredRecords,
      stats,
    })
  } catch (error) {
    console.error('[v0] Error fetching waste records:', error)
    return NextResponse.json(
      { error: 'Failed to fetch waste records' },
      { status: 500 }
    )
  }
}
