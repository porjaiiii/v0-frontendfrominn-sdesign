import { NextRequest, NextResponse } from 'next/server'

import { getLineIdentity } from '@/lib/auth/verify-line-token'
import { notifyRegistrationComplete } from '@/lib/notify-registration'
import { parseJsonBody } from '@/lib/schemas/common'
import { registerUserSchema } from '@/lib/schemas/register'
import { registerUser, updateUser } from '@/lib/supabase/writes'

/**
 * Both verbs — identity comes from the verified LINE ID token, never the
 * request body. Apps Script trusted whatever `lineUserId` the caller sent,
 * which is what let one account write another's profile.
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
  return respondFromSupabase(request, updateUser)
}

export async function POST(request: NextRequest) {
  return respondFromSupabase(request, registerUser, { greet: true })
}
