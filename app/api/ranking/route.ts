import { NextResponse } from 'next/server'

export type RankingEntry = {
  rank: number
  lineUserId: string
  name: string
  carbon: number
  points: number
  avatar: string
  location: string
  // นักท่องเที่ยว (tourist). Tourists are grouped together regardless of any
  // (possibly stale) ตำบล value in the sheet.
  isTourist?: boolean
}

const SAMPLE_RANKING: Omit<RankingEntry, 'rank'>[] = [
  { lineUserId: 'Usample001', name: 'สมชาย ใจดี', carbon: 256.5, points: 2565, avatar: '/placeholder.svg?height=40&width=40', location: 'ตำบลบางกะเจ้า' },
  { lineUserId: 'Usample002', name: 'สมหญิง รักษ์โลก', carbon: 234.3, points: 2343, avatar: '/placeholder.svg?height=40&width=40', location: 'ตำบลบางน้ำผึ้ง' },
  { lineUserId: 'Usample003', name: 'มนัส เกื้อกูล', carbon: 112.4, points: 1124, avatar: '/placeholder.svg?height=40&width=40', location: 'ตำบลบางกอบัว' },
  { lineUserId: 'Usample004', name: 'กมลา ตาวุดีมี', carbon: 89.0, points: 890, avatar: '/placeholder.svg?height=40&width=40', location: '' },
  { lineUserId: 'Usample005', name: 'ณัฐพล สิริมงคล', carbon: 78.0, points: 780, avatar: '/placeholder.svg?height=40&width=40', location: 'ตำบลบางกระสอบ' },
  { lineUserId: 'Usample006', name: 'วรรณา เจริญสุข', carbon: 76.0, points: 760, avatar: '/placeholder.svg?height=40&width=40', location: 'ตำบลบางยอ' },
  { lineUserId: 'Usample007', name: 'ประยุทธ รุ่งเรือง', carbon: 74.0, points: 740, avatar: '/placeholder.svg?height=40&width=40', location: 'ตำบลทรงคะนอง' },
]

function parseCSV(text: string): string[][] {
  return text.split('\n').map(line =>
    line.split(',').map(cell => cell.trim().replace(/^"(.*)"$/, '$1'))
  )
}

function normalizeHeader(h: string): string {
  return (h ?? '').toLowerCase().trim().replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x2050)
  )
}

function findColumnIndex(headers: string[], possibleNames: string[]): number {
  return headers.findIndex(h =>
    possibleNames.some(name => normalizeHeader(h).includes(name))
  )
}

export type RankingResponse =
  | { ranking: RankingEntry[]; isSample: boolean }
  | { error: string }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const callerUserId = searchParams.get('userId')?.trim() || ''
  const callerName   = searchParams.get('name')?.trim() || ''

  const sheetId = process.env.POINTS_SPREADSHEET_ID
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY

  if (!sheetId || !apiKey) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 })
  }

  try {
    // Use Sheets API v4 to fetch the "point" tab by name — avoids the gid/sheet-name ambiguity
    const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/point?key=${apiKey}`
    const pointsRes = await fetch(apiUrl, { cache: 'no-store' })

    if (!pointsRes.ok) {
      console.error('[ranking] Sheets API error:', pointsRes.status, await pointsRes.text())
      return NextResponse.json({
        ranking: SAMPLE_RANKING.map((e, i) => ({ ...e, rank: i + 1 })),
        isSample: true,
      })
    }

    const json = await pointsRes.json()
    const rows: string[][] = json.values ?? []

    if (rows.length <= 1) {
      return NextResponse.json({
        ranking: SAMPLE_RANKING.map((e, i) => ({ ...e, rank: i + 1 })),
        isSample: true,
      })
    }

    const headers = rows[0]
    let lineIdIdx = findColumnIndex(headers, ['line user id', 'lineuserid', 'line_user_id'])
    let co2Idx    = findColumnIndex(headers, ['kgco2e', 'kgco2', 'co2e', 'co2', 'carbon'])
    let pointsIdx = findColumnIndex(headers, ['total points', 'totalpoints', 'points'])

    // Positional fallback: LINE User ID (A=0) | total points (B=1) | total kgCO2e (C=2)
    if (headers.length >= 3) {
      if (lineIdIdx < 0) lineIdIdx = 0
      if (pointsIdx  < 0) pointsIdx  = 1
      if (co2Idx    < 0) co2Idx    = 2
    }


    const dataRows = rows.slice(1).filter(r => r.some(cell => cell?.trim()))
    const entries = dataRows
      .map(row => ({
        lineUserId: row[lineIdIdx]?.trim() || '',
        carbon:     parseFloat(row[co2Idx]    ?? '') || 0,
        points:     parseFloat(row[pointsIdx] ?? '') || 0,
      }))
      .filter(e => e.lineUserId)

    if (entries.length === 0) {
      return NextResponse.json({
        ranking: SAMPLE_RANKING.map((e, i) => ({ ...e, rank: i + 1 })),
        isSample: true,
      })
    }

    // Cross-reference the default profile sheet (CSV) to get names and locations
    const nameMap: Record<string, { name: string; avatar: string; location: string }> = {}
    try {
      const profileUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`
      const profileRes = await fetch(profileUrl, { cache: 'no-store' })
      if (profileRes.ok) {
        const profileRows = parseCSV(await profileRes.text())
        if (profileRows.length > 1) {
          const ph = profileRows[0]
          const pLineIdx      = findColumnIndex(ph, ['line user id', 'lineuserid', 'line_user_id'])
          // Primary: Thai full-name column; fallback: LINE display name / nickname columns
          const pNameIdx      = findColumnIndex(ph, ['ชื่อ-นามสกุล', 'fullname', 'full name'])
          const pAltNameIdx   = findColumnIndex(ph, ['ชื่อ', 'name', 'ชื่อไลน์', 'ชื่อที่แสดง', 'displayname', 'display name', 'ชื่อเล่น'])
          const pAvatarIdx    = findColumnIndex(ph, ['ภาพ', 'picture', 'avatar'])
          const pLocIdx       = findColumnIndex(ph, ['ตำบล', 'subdistrict'])
          profileRows.slice(1).forEach(row => {
            const lid = pLineIdx >= 0 ? row[pLineIdx]?.trim() : ''
            if (lid) {
              const primaryName = pNameIdx    >= 0 ? row[pNameIdx]?.trim()    || '' : ''
              const altName     = pAltNameIdx >= 0 ? row[pAltNameIdx]?.trim() || '' : ''
              nameMap[lid] = {
                name:     primaryName || altName,
                avatar:   pAvatarIdx >= 0 && row[pAvatarIdx]?.trim()
                            ? row[pAvatarIdx].trim()
                            : '/placeholder.svg?height=40&width=40',
                location: pLocIdx    >= 0 ? row[pLocIdx]?.trim()    || '' : '',
              }
            }
          })
        }
      }
    } catch {
      // Profile fetch failed — continue without names
    }

    const ranking: RankingEntry[] = entries
      .sort((a, b) => b.carbon - a.carbon)
      .map((entry, i) => {
        const info = nameMap[entry.lineUserId]
        const isCallerEntry = callerUserId && entry.lineUserId === callerUserId
        return {
          rank:       i + 1,
          lineUserId: entry.lineUserId,
          name:       isCallerEntry && callerName ? callerName : info?.name || `ผู้ใช้ ${i + 1}`,
          carbon:     entry.carbon,
          points:     entry.points,
          avatar:     info?.avatar || '/placeholder.svg?height=40&width=40',
          location:   info?.location || '',
        }
      })

    return NextResponse.json({ ranking, isSample: false })
  } catch (error) {
    console.error('[ranking] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch ranking' }, { status: 500 })
  }
}
