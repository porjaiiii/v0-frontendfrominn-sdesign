import { REWARDS } from '@/lib/waste-data'

// The rewards catalog as a PRICING source, usable from both a route handler and
// a component.
//
// Phase 5 moved pricing off the client, and the GAS backend has no catalog table
// to price from — so this module is what the GAS branch of /api/coupons/redeem
// looks prices up in. It mirrors the SEEDED rows of
// supabase/migrations/0003_seed_catalog.sql, and is the offline fallback both
// GET /api/catalog/rewards and app/rewards/page.tsx use before/if a live fetch
// resolves.
//
// This intentionally does NOT try to mirror every row of app.rewards — an
// admin can add new rewards at runtime (POST /api/catalog/rewards), and this
// file is static. It only has to stay in sync with the rows it was seeded
// from; the route test checks exactly that, not exact parity.

export interface CatalogReward {
  id: number
  name: string
  description: string
  /** For a variable reward this is the MINIMUM, not the price. */
  points: number
  image: string
  isVariable: boolean
  minPoints: number | null
  /** null = unlimited. Always null here — stock is a live-only concept. */
  stock: number | null
}

/**
 * Redeem points for a cash-back coupon at 1 point = 1 baht.
 *
 * This lived in app/rewards/page.tsx as a component-local constant, which meant
 * the floor of 20 was a client-side check and nothing more — the amount the user
 * typed became `points_used` verbatim. It is now a catalog row
 * (app.rewards id 99, is_variable) so the floor is enforced server-side.
 */
export const CASH_REWARD_ID = 99

const VARIABLE: Record<number, number> = {
  [CASH_REWARD_ID]: 20,
}

export const CATALOG_REWARDS: CatalogReward[] = [
  ...REWARDS.map((reward) => ({
    id: reward.id,
    name: reward.name,
    description: reward.description,
    points: reward.points,
    image: reward.image,
    isVariable: false,
    minPoints: null,
    stock: null,
  })),
  {
    id: CASH_REWARD_ID,
    name: 'แลกแต้มเป็นเงินคืน',
    description: 'คูปองแลกเงินสด',
    points: VARIABLE[CASH_REWARD_ID],
    image: '/images/rewards/THB-cash.jpg',
    isVariable: true,
    minPoints: VARIABLE[CASH_REWARD_ID],
    stock: null,
  },
]

export function findReward(id: number): CatalogReward | undefined {
  return CATALOG_REWARDS.find((reward) => reward.id === id)
}

export interface PricedLine {
  reward: CatalogReward
  quantity: number
  /** Points for ONE unit — the catalog price, or the floored variable amount. */
  unitPoints: number
  description: string
}

export class PricingError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'PricingError'
  }
}

/**
 * Prices a redemption request. The mirror of app.redeem_rewards' first pass —
 * same rules, same rejections, so flipping BACKEND_COUPONS cannot change what a
 * basket costs.
 */
export function priceRedemption(
  items: { reward_id: number; quantity: number; points?: number }[],
): { lines: PricedLine[]; total: number } {
  const lines: PricedLine[] = []
  let total = 0

  for (const item of items) {
    const reward = findReward(item.reward_id)
    if (!reward) {
      throw new PricingError(`ไม่พบของรางวัล (id ${item.reward_id})`, 400)
    }

    let unitPoints: number
    if (reward.isVariable) {
      unitPoints = item.points ?? 0
      if (unitPoints < (reward.minPoints ?? 1)) {
        throw new PricingError(
          `ต้องใช้อย่างน้อย ${reward.minPoints} คะแนนสำหรับ "${reward.name}"`,
          400,
        )
      }
    } else {
      // The request's `points` is not consulted.
      unitPoints = reward.points
    }

    lines.push({
      reward,
      quantity: item.quantity,
      unitPoints,
      description: reward.isVariable
        ? `${reward.description} ${unitPoints.toLocaleString()} บาท`
        : reward.description,
    })
    total += unitPoints * item.quantity
  }

  return { lines, total }
}
