import { z } from 'zod'

import { lineUserIdSchema } from './common'

// Points contracts.
//
// There is NO earn_points schema, and that is the point. Earning happens only
// as a side effect of confirm_waste inside one transaction; it is not a public
// action. `/api/points` POST currently forwards any {action, user_id, points}
// body straight to GAS, so anyone can mint 999999 points — Phase 4 removes that
// surface rather than porting it.

/** Read actions that survive the migration. */
export const pointsReadActionSchema = z.enum([
  'get_account_fast',
  'get_balance',
  'get_transactions',
  'get_spend_details',
  'get_co2_collection',
])

export const pointsQuerySchema = z.object({
  action: pointsReadActionSchema,
  user_id: lineUserIdSchema,
})

export type PointsQuery = z.infer<typeof pointsQuerySchema>

export const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>

// ---------------------------------------------------------------------------
// Writes (Phase 5)
// ---------------------------------------------------------------------------

export const spendItemSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().int().positive().max(999).default(1),
})

/**
 * Spending points.
 *
 * `points` is NOT accepted: the total is derived server-side from the reward
 * catalog, because today `points_used` is checked only for truthiness and the
 * 17,000-point reward can be redeemed for 1.
 */
export const spendPointsSchema = z.object({
  category: z.enum(['reward', 'donate']).default('reward'),
  items: z.array(spendItemSchema).min(1).max(50),
})

export type SpendPointsInput = z.infer<typeof spendPointsSchema>

/**
 * Redeeming rewards — the migration's ONE intentional contract break.
 *
 * Was: `{user_id, reward_id, reward_name, reward_description, reward_image,
 * points_used, tx_id, redeem_type}` — every field of which the client chose,
 * including the price. Now the request names *what* and *how many*, and the
 * server answers *how much*.
 *
 * `points` survives only for variable-price rewards (the cash-back coupon,
 * app.rewards.is_variable) and is floored at min_points server-side. For any
 * other reward it is ignored, not rejected — an older client that still sends
 * points_used must not start failing, it must simply stop being believed.
 */
export const redeemItemSchema = z.object({
  reward_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
  points: z.coerce.number().int().positive().max(1_000_000).optional(),
})

export const redeemRewardsSchema = z.object({
  items: z.array(redeemItemSchema).min(1).max(50),
  redeem_type: z.enum(['pickup', 'delivery']).default('pickup'),
})

export type RedeemRewardsInput = z.infer<typeof redeemRewardsSchema>

/**
 * Accepts the legacy single-reward body as well, so the backend flag and the
 * client bundle can be deployed in either order.
 */
export const redeemRequestSchema = z.preprocess((input) => {
  if (!input || typeof input !== 'object') return input
  const body = input as Record<string, unknown>
  if (Array.isArray(body.items)) return body

  if (body.reward_id !== undefined) {
    return {
      redeem_type: body.redeem_type,
      items: [
        {
          reward_id: body.reward_id,
          quantity: 1,
          // Only meaningful for a variable reward; discarded for the rest.
          points: body.points_used,
        },
      ],
    }
  }
  return body
}, redeemRewardsSchema)

export const useCouponSchema = z.object({
  coupon_id: z.string().trim().min(4).max(64),
  scanned_by: z.string().max(120).optional(),
})

export type UseCouponInput = z.infer<typeof useCouponSchema>

/** Donations: the amount is genuinely the user's choice, so it is accepted. */
export const donatePointsSchema = z.object({
  points: z.coerce.number().int().positive().max(1_000_000),
  items: z.array(spendItemSchema.extend({ points: z.coerce.number().int().min(0).optional() }))
    .max(50)
    .default([]),
})

export type DonatePointsInput = z.infer<typeof donatePointsSchema>
