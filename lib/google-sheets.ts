'use server'

import { google } from 'googleapis'
import { JWT } from 'google-auth-library'

const SHEET_ID = '1SK_Nat8jb3iQWt-Gs_YUimycxMTcubV5ViD_QtqkO78'
const SHEET_NAME = 'submissions'

// สำหรับ Development: ใช้ API key (อ่านได้อย่างเดียว)
// สำหรับ Production: ใช้ Service Account (เขียนได้)

async function getSheetClient() {
  // ในการใช้งานจริง ต้องตั้ง GOOGLE_SERVICE_ACCOUNT_JSON ใน environment variables
  // สำหรับตอนนี้ เราจะใช้วิธี API key อ่านข้อมูลเท่านั้น
  
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  return google.sheets({ version: 'v4', auth })
}

interface WasteSubmission {
  timestamp: string
  user_id: string
  waste_type: string
  waste_subtype: string
  weight_kg: number
  image_url?: string
  carbon_reduction: number
  points_earned: number
  status: string
  notes?: string
}

export async function submitWasteRecord(data: WasteSubmission) {
  try {
    // ตรวจสอบ environment variables
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      throw new Error('Missing Google Service Account credentials')
    }

    // สร้าง JWT auth สำหรับ Service Account
    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // เตรียมข้อมูลแถวใหม่
    const row = [
      data.timestamp,
      data.user_id,
      data.waste_type,
      data.waste_subtype,
      data.weight_kg,
      data.image_url || '',
      data.carbon_reduction,
      data.points_earned,
      data.status,
      data.notes || '',
    ]

    // เขียนข้อมูลไปยัง Google Sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:J`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    })

    console.log('[v0] Waste record submitted successfully:', response.data)
    return { success: true, data: response.data }
  } catch (error) {
    console.error('[v0] Error submitting waste record:', error)
    throw error
  }
}

export async function getWasteRecords(user_id?: string) {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      throw new Error('Missing Google Service Account credentials')
    }

    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // อ่านข้อมูลทั้งหมดจาก Sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:J`,
    })

    const rows = response.data.values || []
    const headers = rows[0] || []

    // แปลงแต่ละแถวเป็น object
    const records = rows.slice(1).map(row => {
      const record: any = {}
      headers.forEach((header, index) => {
        record[header] = row[index] || ''
      })
      return record
    })

    // ถ้าระบุ user_id ให้กรองเฉพาะของผู้ใช้นั้น
    if (user_id) {
      return records.filter(r => r.user_id === user_id)
    }

    return records
  } catch (error) {
    console.error('[v0] Error fetching waste records:', error)
    throw error
  }
}

export async function calculateUserStats(user_id: string) {
  try {
    const records = await getWasteRecords(user_id)

    const stats = {
      total_weight: 0,
      total_carbon: 0,
      total_points: 0,
      submission_count: 0,
      waste_breakdown: {} as Record<string, number>,
    }

    records.forEach(record => {
      if (record.user_id === user_id) {
        stats.total_weight += parseFloat(record.weight_kg || 0)
        stats.total_carbon += parseFloat(record.carbon_reduction || 0)
        stats.total_points += parseFloat(record.points_earned || 0)
        stats.submission_count += 1

        // นับประเภทขยะ
        const waste_type = record.waste_type
        stats.waste_breakdown[waste_type] = (stats.waste_breakdown[waste_type] || 0) + 1
      }
    })

    return stats
  } catch (error) {
    console.error('[v0] Error calculating user stats:', error)
    throw error
  }
}
