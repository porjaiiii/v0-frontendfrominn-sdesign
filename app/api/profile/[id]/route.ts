import { NextRequest, NextResponse } from 'next/server'

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

    const apiKey = process.env.GOOGLE_SHEETS_API_KEY
    const sheetId = process.env.GOOGLE_SHEETS_ID

    if (!apiKey || !sheetId) {
      console.error('[v0] Google Sheets config missing')
      return NextResponse.json(
        { error: 'Server configuration missing' },
        { status: 500 }
      )
    }

    console.log('[v0] API: Fetching profile for LINE ID:', lineId)

    // Fetch data from Google Sheets
    const sheetName = 'Sheet1'
    const range = `${sheetName}!A:Z`
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`

    const response = await fetch(url)
    if (!response.ok) {
      console.error('[v0] Google Sheets API error:', response.statusText)
      return NextResponse.json(
        { error: 'Failed to fetch from Google Sheets' },
        { status: 500 }
      )
    }

    const data = await response.json()
    const rows = data.values || []

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No data in Google Sheets' },
        { status: 404 }
      )
    }

    // Parse header row
    const headers = rows[0]
    const lineUserIdIndex = findColumnIndex(headers, ['line', 'lineuserid', 'line id'])

    if (lineUserIdIndex === -1) {
      console.error('[v0] LINE User ID column not found. Headers:', headers)
      return NextResponse.json(
        { error: 'LINE User ID column not found in sheet' },
        { status: 400 }
      )
    }

    // Find user by LINE User ID
    const userRow = rows.find(
      (row: string[]) => row[lineUserIdIndex]?.trim() === lineId
    )

    if (!userRow) {
      console.log('[v0] User not found for LINE ID:', lineId)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Map row data to profile object
    const profile = mapRowToProfile(headers, userRow)
    console.log('[v0] Found user:', profile.name)

    return NextResponse.json(profile)
  } catch (error) {
    console.error('[v0] API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

// Helper to find column index by multiple possible names
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  return headers.findIndex((h: string) =>
    possibleNames.some(name => h?.toLowerCase().includes(name))
  )
}

// Helper to map spreadsheet row to profile object
function mapRowToProfile(headers: string[], row: string[]) {
  const profile: Record<string, any> = {
    recycleData: [],
    co2Data: []
  }

  headers.forEach((header: string, index: number) => {
    const value = row[index]?.trim() || ''
    const normalizedHeader = header?.toLowerCase().trim()

    // Map Thai column names
    if (normalizedHeader.includes('ชื่อ') || normalizedHeader.includes('name')) {
      profile.name = value
    } else if (normalizedHeader.includes('line')) {
      profile.lineUserId = value
    } else if (normalizedHeader.includes('username')) {
      profile.lineUsername = value
    } else if (normalizedHeader.includes('เพศ') || normalizedHeader.includes('gender')) {
      profile.gender = value
    } else if (normalizedHeader.includes('อายุ') || normalizedHeader.includes('age')) {
      profile.age = value
    } else if (normalizedHeader.includes('ประเภท') || normalizedHeader.includes('type')) {
      profile.type = value
    } else if (normalizedHeader.includes('ตำบล') || normalizedHeader.includes('subdistrict')) {
      profile.subdistrict = value
    } else if (normalizedHeader.includes('อาชีพ') || normalizedHeader.includes('occupation')) {
      profile.occupation = value
    } else if (normalizedHeader.includes('ภาพ') || normalizedHeader.includes('picture')) {
      profile.avatar = value || '/placeholder-user.jpg'
    } else if (normalizedHeader.includes('co2') || normalizedHeader.includes('carbon')) {
      profile.co2Reduced = parseInt(value) || 0
    } else if (normalizedHeader.includes('ต้นไม้') || normalizedHeader.includes('tree')) {
      profile.treesPlanted = parseInt(value) || 0
    } else if (normalizedHeader.includes('รวม') || normalizedHeader.includes('total')) {
      profile.totalRecycled = parseFloat(value) || 0
    }
  })

  // Generate default recycleData and co2Data if not provided
  if (profile.recycleData.length === 0) {
    profile.recycleData = generateRecycleData(profile.totalRecycled)
  }
  if (profile.co2Data.length === 0) {
    profile.co2Data = generateCO2Data(profile.co2Reduced)
  }

  return profile
}

// Generate recycleData breakdown
function generateRecycleData(total: number) {
  const materials = [
    { name: 'พลาสติก', color: '#6fc061', percentage: 0.6 },
    { name: 'แก้ว', color: '#c06161', percentage: 0.2 },
    { name: 'กระดาษ', color: '#d7ce56', percentage: 0.1 },
    { name: 'อลูมิเนียม', color: '#606dc0', percentage: 0.08 },
    { name: 'น้ำมันเก่า', color: '#60c098', percentage: 0.02 },
  ]

  return materials.map(material => ({
    name: material.name,
    value: Math.round(total * material.percentage * 100) / 100,
    color: material.color
  }))
}

// Generate CO2 data breakdown
function generateCO2Data(total: number) {
  const materials = [
    { name: 'พลาสติก', color: '#6fc061', percentage: 0.67 },
    { name: 'แก้ว', color: '#c06161', percentage: 0.22 },
    { name: 'กระดาษ', color: '#d7ce56', percentage: 0.06 },
    { name: 'อลูมิเนียม', color: '#606dc0', percentage: 0.04 },
    { name: 'น้ำมันเก่า', color: '#60c098', percentage: 0.01 },
  ]

  return materials.map(material => ({
    name: material.name,
    value: Math.round(total * material.percentage * 100) / 100,
    color: material.color
  }))
}
