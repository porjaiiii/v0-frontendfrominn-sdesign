import { NextRequest, NextResponse } from 'next/server'

import { getLineIdentity } from '@/lib/auth/verify-line-token'
import { backendFor } from '@/lib/backend-flags'
import { notifyRegistrationComplete } from '@/lib/notify-registration'
import { parseJsonBody } from '@/lib/schemas/common'
import { registerUserSchema } from '@/lib/schemas/register'
import { registerUser, updateUser } from '@/lib/supabase/writes'

const GOOGLE_APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_GAS_URL1 ?? ''

/**
 * Supabase path for both verbs — identity comes from the verified LINE ID
 * token (or the local dev bypass), never the request body. The GAS path below
 * is untouched: it still trusts body.lineUserId, exactly as it does in
 * production today.
 */
async function respondFromSupabase(
  request: NextRequest,
  write: typeof registerUser,
  { greet }: { greet: boolean } = { greet: false },
) {
  const identity = await getLineIdentity(request)
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await parseJsonBody(request, registerUserSchema)
  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: parsed.status })
  }

  try {
    const profile = await write(identity.lineUserId, parsed.data)

    // Only on first-time registration — editing a profile must not re-trigger
    // the "thanks for registering" LINE OA message. Built from the stored row
    // rather than the request, so the greeting can never disagree with what was
    // actually saved.
    if (greet) {
      await notifyRegistrationComplete({
        lineUserId: profile.lineUserId,
        userId: profile.userId,
        pdpaConsent: profile.pdpaConsent,
        fullName: profile.fullName,
        nickname: profile.nickname,
        phoneNumber: profile.phoneNumber,
        address: profile.address,
        gender: profile.gender,
        ageRange: profile.ageRange,
        userType: profile.userType,
        subdistrict: profile.subdistrict,
        occupation: profile.occupation,
        registrationDate: profile.registrationDate,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        lineUserId: profile.lineUserId,
        fullName: profile.fullName,
        registrationDate: profile.registrationDate,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to submit registration',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  if (backendFor('register') === 'supabase') {
    return respondFromSupabase(request, updateUser)
  }

  try {
    const body = await request.json()
    const {
      lineUserId,
      userId,
      pdpaConsent,
      fullName,
      nickname,
      phoneNumber,
      address,
      gender,
      ageRange,
      userType,
      subdistrict,
      occupation,
    } = body

    if (!lineUserId || !fullName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const payload = {
      action: 'updateUser',
      lineUserId,
      userId: userId || '',
      pdpaConsent,
      fullName,
      nickname: nickname || '',
      phoneNumber,
      address: address || '',
      gender,
      ageRange,
      userType: userType || '',
      subdistrict: subdistrict || '',
      occupation: occupation || '',
      timestamp: new Date().toISOString(),
    }

    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()

    // 1. ดักจับ Error ระดับ Network / HTTP status จาก Google
    if (!response.ok) {
      return NextResponse.json(
        { error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลโปรดลองใหม่อีกครั้ง', details: responseText.substring(0, 200) },
        { status: 500 }
      )
    }

    // 2. แปลง Response เป็น JSON
    let result
    try {
      result = JSON.parse(responseText)
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid response format from Google Sheet', details: responseText.substring(0, 100) },
        { status: 500 }
      )
    }

    // 🔴 3. ตรวจสอบ Error ที่ส่งมาจาก Google Apps Script (เช่น Lock Timeout หรือ ไม่พบ User)
    if (result.status === 'error') {
      const isLockTimeout = result.message?.toLowerCase().includes('lock timeout') || result.message?.includes('busy')
      return NextResponse.json(
        { 
          error: isLockTimeout ? 'เซิร์ฟเวอร์หนาแน่น กรุณาลองใหม่อีกครั้ง' : (result.message || 'Failed to update user'),
          details: result.message 
        },
        { status: isLockTimeout ? 429 : 400 }
      )
    }

    return NextResponse.json({ success: true, data: { lineUserId, fullName } })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update user', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (backendFor('register') === 'supabase') {
    return respondFromSupabase(request, registerUser, { greet: true })
  }

  try {
    const body = await request.json()
    const {
      lineUserId,
      userId,
      pdpaConsent,
      fullName,
      nickname,
      phoneNumber,
      address,
      gender,
      ageRange,
      userType,
      subdistrict,
      occupation,
      registrationDate,
    } = body

    // Validate required fields (address is only required for community residents, not tourists)
    const isTourist = userType === 'นักท่องเที่ยว'
    if (!lineUserId || !fullName || (!isTourist && !address) || !phoneNumber || !gender || !ageRange || !pdpaConsent) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // ส่งข้อมูลไปยัง Google Apps Script Webhook
    const payload = {
      action: 'registerUser',
      type: 'insert',
      status: 'done',
      lineUserId,
      userId: userId || '',
      pdpaConsent,
      fullName,
      nickname: nickname || '',
      phoneNumber,
      address,
      gender,
      ageRange,
      userType: userType || '',
      subdistrict: subdistrict || '',
      occupation: occupation || '',
      registrationDate: registrationDate || new Date().toLocaleDateString('th-TH'),
      timestamp: new Date().toISOString(),
    }

    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()

    // 1. ดักจับ Error ระดับ Network / HTTP status จาก Google
    if (!response.ok) {
      return NextResponse.json(
        { 
          error: 'Failed to save registration to Google Sheet',
          details: responseText.substring(0, 200),
          status: response.status,
        },
        { status: 500 }
      )
    }

    // 2. แปลง Response เป็น JSON
    let result
    try {
      result = JSON.parse(responseText)
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid response format from Google Sheet', details: responseText.substring(0, 100) },
        { status: 500 }
      )
    }

    // 🔴 3. ตรวจสอบ Error ที่ส่งมาจาก Google Apps Script (เช่น Lock Timeout หรือ ลงทะเบียนซ้ำ)
    if (result.status === 'error') {
      const isLockTimeout = result.message?.toLowerCase().includes('lock timeout') || result.message?.includes('busy')
      return NextResponse.json(
        { 
          error: isLockTimeout ? 'เซิร์ฟเวอร์หนาแน่น กรุณาลองใหม่อีกครั้ง' : (result.message || 'เซิร์ฟเวอร์หนาแน่น กรุณาลองใหม่อีกครั้ง'),
          details: result.message 
        },
        { status: isLockTimeout ? 429 : 400 }
      )
    }

    // Also greeted from here, not only from the Supabase branch: the browser no
    // longer makes this call, so leaving it out would mean flipping
    // BACKEND_REGISTER back to `gas` silently stops the welcome message.
    await notifyRegistrationComplete({
      lineUserId,
      userId: payload.userId,
      pdpaConsent,
      fullName,
      nickname: payload.nickname,
      phoneNumber,
      address: payload.address,
      gender,
      ageRange,
      userType: payload.userType,
      subdistrict: payload.subdistrict,
      occupation: payload.occupation,
      registrationDate: payload.registrationDate,
    })

    return NextResponse.json({
      success: true,
      data: {
        lineUserId,
        fullName,
        registrationDate: payload.registrationDate,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to submit registration',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
