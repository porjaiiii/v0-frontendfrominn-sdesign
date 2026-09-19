import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'

import { getLineIdentity } from '@/lib/auth/verify-line-token'
import { SAMPLE_RANKING, type CallerInfo, type LeaderboardRow, type RankingEntry } from '@/lib/ranking'
import { getLeaderboard } from '@/lib/supabase/reads'

// The leaderboard.
//
// One query against app.v_leaderboard, which already joins the balances, the
// account aggregates and the user's ตำบล / tourist flag. It replaced two
// parallel Sheets reads (points_account + Registration) cross-referenced by
// LINE user id.
//
// Ordered by carbon descending; `points` is the spendable balance and is
// displayed rather than ranked on, so redeeming never moves a user's rank.
//
// PUBLIC, and therefore minimal. It used to return each user's real
// lineUserId — the identifier every other route is keyed on — for the top 200
// users, to anybody, with no token. That made it a bulk source of ids for
// exactly the lookups this API exposes. The id is now stripped before the rows
// leave the process, and the only per-viewer fact is `isYou`.
//
// Identity comes from the LINE ID token, not a query parameter. The old
// ?userId= told anyone the ตำบล and tourist status of any id they named.

export const maxDuration = 15

type UserInfo = { name: string; avatar: string; location: string; isTourist: boolean }

// nameMap is kept on the (server-side, viewer-independent) cached result so GET
// can look up the caller's own ตำบล/tourist status without re-reading the source.
type RankingResult = { ranking: LeaderboardRow[]; isSample: boolean; nameMap: Record<string, UserInfo> }

const SAMPLE_RESULT: RankingResult = {
  ranking: SAMPLE_RANKING.map((e, i) => ({ ...e, rank: i + 1, lineUserId: '' })),
  isSample: true,
  nameMap: {},
}

async function buildRankingFromSupabase(): Promise<RankingResult> {
  try {
    const { ranking, byUser } = await getLeaderboard()
    if (ranking.length === 0) return SAMPLE_RESULT

    const nameMap: Record<string, UserInfo> = {}
    for (const entry of ranking) {
      nameMap[entry.lineUserId] = {
        name: entry.name,
        avatar: entry.avatar,
        location: byUser[entry.lineUserId]?.location ?? '',
        isTourist: byUser[entry.lineUserId]?.isTourist ?? false,
      }
    }

    return { ranking, isSample: false, nameMap }
  } catch (error) {
    console.error('[points-ranking] supabase error:', error)
    return SAMPLE_RESULT
  }
}

// Shared, viewer-independent cache. 60 s keeps the leaderboard fresh (carbon
// totals change slowly) while collapsing bursts onto a single pair of reads.
// It holds the INTERNAL rows, ids included; stripping happens per request.
const getCachedRanking = unstable_cache(buildRankingFromSupabase, ['points-leaderboard'], {
  revalidate: 60,
  tags: ['points-leaderboard'],
})

/** Drops the LINE id and marks the caller's own row. */
function toWireEntry(row: LeaderboardRow, callerId: string): RankingEntry {
  const { lineUserId, ...entry } = row
  return { ...entry, isYou: lineUserId !== '' && lineUserId === callerId }
}

export async function GET(request: Request) {
  const result = await getCachedRanking()

  // Unauthenticated callers still get the board — it is a public scoreboard —
  // but nothing viewer-specific, because there is no verified viewer.
  const identity = await getLineIdentity(request)
  const callerId = identity?.lineUserId ?? ''

  const ranking = result.ranking.map((row) => toWireEntry(row, callerId))

  // The caller's own ตำบล/tourist status, so the ตำบล tab groups correctly even
  // before they have any points. Only ever about the verified caller.
  const info = callerId ? result.nameMap[callerId] : undefined
  const caller: CallerInfo | null = info
    ? { location: info.location, isTourist: info.isTourist }
    : null

  return NextResponse.json({ ranking, isSample: result.isSample, caller })
}
