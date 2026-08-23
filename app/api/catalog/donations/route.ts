import { NextRequest, NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/auth/admin-session'
import { createDonationCampaignSchema } from '@/lib/schemas/catalog'
import { parseJsonBody } from '@/lib/schemas/common'
import { getDonationCampaigns } from '@/lib/supabase/reads'
import { createDonationCampaign } from '@/lib/supabase/writes'

/**
 * GET /api/catalog/donations
 *
 * Live campaigns from app.donation_campaigns, replacing the hardcoded
 * DONATIONS array in app/donate/page.tsx. That array is what
 * supabase/migrations/0008_catalog.sql seeded the table from, so switching
 * this on changes nothing a user sees until an admin adds a new one.
 *
 * No offline fallback here, deliberately — unlike waste rates or reward
 * prices, a stale hardcoded donation total would be actively misleading (it
 * would show baht amounts nobody actually gave). An empty list on error is
 * the honest answer.
 */
export async function GET() {
  try {
    const donations = await getDonationCampaigns()
    return NextResponse.json({ success: true, donations })
  } catch (error) {
    console.error('[catalog/donations] read failed:', error)
    return NextResponse.json({ success: false, donations: [] }, { status: 500 })
  }
}

/**
 * POST /api/catalog/donations — admin only.
 *
 * The write side of app/admin/donations/new/page.tsx, which used to
 * `// TODO: POST to GAS / API route`.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'ต้องเข้าสู่ระบบเจ้าหน้าที่ก่อน' }, { status: 403 })
  }

  const parsed = await parseJsonBody(request, createDonationCampaignSchema)
  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: parsed.status })
  }

  try {
    const donation = await createDonationCampaign(parsed.data)
    return NextResponse.json({ success: true, donation })
  } catch (error) {
    console.error('[catalog/donations] create failed:', error)
    return NextResponse.json(
      { error: 'ไม่สามารถเพิ่มรายการบริจาคได้ กรุณาลองใหม่' },
      { status: 500 },
    )
  }
}
