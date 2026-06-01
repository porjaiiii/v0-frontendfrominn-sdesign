import { NextRequest, NextResponse } from 'next/server'

// Mock database - In production, this would query your actual backend
// For now, we'll use demo data structure based on your Google Sheets
const mockUserDatabase: Record<string, any> = {
  'U1234567890abcdefghijklmnopqrst': {
    name: 'สมหวัง คนดี222',
    lineUsername: 'somwang',
    gender: 'หญิง',
    age: '21-40 ปี',
    type: 'ชาวบางกระเจ้า',
    subdistrict: 'บางกอบัว',
    occupation: 'เกษตรกร',
    avatar: '/placeholder-user.jpg',
    co2Reduced: 100,
    treesPlanted: 6,
    totalRecycled: 49.50,
    recycleData: [
      { name: 'พลาสติก', value: 30.5, color: '#6fc061' },
      { name: 'แก้ว', value: 10, color: '#c06161' },
      { name: 'กระดาษ', value: 5, color: '#d7ce56' },
      { name: 'อลูมิเนียม', value: 8, color: '#606dc0' },
      { name: 'น้ำมันเก่า', value: 0, color: '#60c098' },
    ],
    co2Data: [
      { name: 'พลาสติก', value: 67.42, color: '#6fc061' },
      { name: 'แก้ว', value: 22.15, color: '#c06161' },
      { name: 'กระดาษ', value: 6.26, color: '#d7ce56' },
      { name: 'อลูมิเนียม', value: 4.2, color: '#606dc0' },
      { name: 'น้ำมันเก่า', value: 0, color: '#60c098' },
    ]
  },
}

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

    // Check mock database first
    const mockUser = mockUserDatabase[lineId]
    if (mockUser) {
      console.log('[v0] Found user in mock database')
      return NextResponse.json(mockUser)
    }

    // In production, you would:
    // 1. Query your backend/database with the lineId
    // 2. Fetch data from the Google Sheets API
    // 3. Call a backend service that has the volunteer data
    //
    // Example:
    // const response = await fetch(`https://your-backend.com/api/user/${lineId}`)
    // const userData = await response.json()
    // return NextResponse.json(userData)

    // For demo purposes, generate a demo user
    const demoUser = {
      name: 'ผู้ใช้ทดสอบ',
      lineUsername: 'demo-user',
      gender: 'ไม่ระบุ',
      age: '21-40 ปี',
      type: 'ผู้อื่น',
      subdistrict: 'ไม่ระบุ',
      occupation: 'ไม่ระบุ',
      avatar: '/placeholder-user.jpg',
      co2Reduced: Math.floor(Math.random() * 200),
      treesPlanted: Math.floor(Math.random() * 10),
      totalRecycled: Math.floor(Math.random() * 100 * 100) / 100,
      recycleData: [
        { name: 'พลาสติก', value: Math.random() * 50, color: '#6fc061' },
        { name: 'แก้ว', value: Math.random() * 30, color: '#c06161' },
        { name: 'กระดาษ', value: Math.random() * 20, color: '#d7ce56' },
        { name: 'อลูมิเนียม', value: Math.random() * 15, color: '#606dc0' },
        { name: 'น้ำมันเก่า', value: 0, color: '#60c098' },
      ],
      co2Data: [
        { name: 'พลาสติก', value: Math.random() * 100, color: '#6fc061' },
        { name: 'แก้ว', value: Math.random() * 50, color: '#c06161' },
        { name: 'กระดาษ', value: Math.random() * 30, color: '#d7ce56' },
        { name: 'อลูมิเนียม', value: Math.random() * 10, color: '#606dc0' },
        { name: 'น้ำมันเก่า', value: 0, color: '#60c098' },
      ]
    }

    return NextResponse.json(demoUser)
  } catch (error) {
    console.error('[v0] API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}
