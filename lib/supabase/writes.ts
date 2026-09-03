import 'server-only'

import type { CouponRecord } from '@/lib/coupon-config'
import type { RegisterUserInput } from '@/lib/schemas/register'
import type { CreateDonationCampaignInput, CreateRewardInput } from '@/lib/schemas/catalog'
import type { DonatePointsInput, RedeemRewardsInput, UseCouponInput } from '@/lib/schemas/points'
import type { SubmitWasteInput, UpdateWasteInput } from '@/lib/schemas/waste'
import { generateUserIdFromLineId } from '@/lib/user-id-generator'
import type { WasteRecord } from '@/lib/waste-records'

import {
  mapProfileRow,
  type DonationCampaignEntry,
  type ProfileResponse,
  type RewardCatalogEntry,
} from './reads'
import { catalogImageUrl, signWastePhotoUrls, toStoragePath } from './storage'
import { getServiceClient } from './server'

// First Supabase write path in the migration. Follows the same identity rule
// the read/write schemas already commit to (lib/schemas/common.ts):
// line_user_id comes from the caller (the verified LINE ID token), never the
// request body.

async function upsertUserRow(
  lineUserId: string,
  input: RegisterUserInput,
  extra: Record<string, unknown>,
): Promise<ProfileResponse> {
  const { data, error } = await getServiceClient()
    .from('users')
    .upsert(
      {
        line_user_id: lineUserId,
        display_user_id: generateUserIdFromLineId(lineUserId),
        pdpa_consent: input.pdpaConsent,
        full_name: input.fullName,
        nickname: input.nickname,
        phone_number: input.phoneNumber,
        address: input.address,
        gender: input.gender,
        age_range: input.ageRange,
        user_type: input.userType,
        subdistrict: input.subdistrict,
        occupation: input.occupation,
        ...extra,
      },
      { onConflict: 'line_user_id' },
    )
    .select('*')
    .single()

  if (error) throw error
  return mapProfileRow(data)
}

/**
 * POST /api/register — first-time registration.
 *
 * Upsert rather than a bare insert: a retried submit (network blip,
 * double-tap) must not 23505 on the primary key, and re-registering an
 * already-registered account is just an edit.
 */
export async function registerUser(
  lineUserId: string,
  input: RegisterUserInput,
): Promise<ProfileResponse> {
  return upsertUserRow(lineUserId, input, {
    registration_date_th: new Date().toLocaleDateString('th-TH'),
  })
}

/**
 * PATCH /api/register?mode=edit — never touches registration_date_th, so
 * editing a profile can't overwrite the user's original registration date.
 */
export async function updateUser(
  lineUserId: string,
  input: RegisterUserInput,
): Promise<ProfileResponse> {
  return upsertUserRow(lineUserId, input, {})
}

// ---------------------------------------------------------------------------
// Waste records (Phase 4)
// ---------------------------------------------------------------------------
//
// Both call an RPC rather than composing statements here, because both are
// multi-table and must be atomic — see supabase/migrations/0004_rpc_waste.sql.
// supabase-js issues one HTTP request per statement, so composing them in
// TypeScript would reintroduce exactly the partial-write window that leaves a
// record `done` with no points today (app/api/waste/update/route.ts:105-133).

/** The RPCs hand back `record` in the same shape /api/waste/records serves. */
interface WasteRecordJson {
  id: number
  timestamp: string
  user_id: string
  waste_type: string
  waste_subtype: string
  weight_kg: number | string
  image_urls: string[] | null
  carbon_reduction: number | string
  points_earned: number | string
  status: string
  notes: string
}

/** numeric columns come back as strings over PostgREST; WasteRecord wants numbers. */
function toWasteRecord(json: WasteRecordJson): WasteRecord & { id: number } {
  return {
    id: json.id,
    timestamp: json.timestamp,
    user_id: json.user_id,
    waste_type: json.waste_type,
    waste_subtype: json.waste_subtype,
    weight_kg: Number(json.weight_kg) || 0,
    image_urls: json.image_urls ?? [],
    carbon_reduction: Number(json.carbon_reduction) || 0,
    points_earned: Number(json.points_earned) || 0,
    status: json.status,
    notes: json.notes || undefined,
  }
}

/**
 * A Postgres error the caller should see as a 4xx rather than a 500.
 *
 * The RPCs raise with deliberate SQLSTATEs so the route can map them without
 * string-matching a message that happens to be in Thai.
 */
export class WriteError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'WriteError'
  }
}

const RPC_ERROR_STATUS: Record<string, number> = {
  '23503': 400, // foreign_key_violation — unknown waste type / subtype
  '23505': 409, // unique_violation      — idempotency key belongs to someone else
  '23514': 400, // check_violation       — cancelled record, or no weight
  P0002: 404, // no_data_found          — record not found
}

function asWriteError(error: { message: string; code?: string }): WriteError {
  const status = error.code ? (RPC_ERROR_STATUS[error.code] ?? 500) : 500
  return new WriteError(error.message, status, error.code)
}

export interface SubmitWasteResult {
  record: WasteRecord & { id: number }
  /** True when the Idempotency-Key replayed an earlier submit. Still a 200. */
  duplicate: boolean
}

/**
 * POST /api/waste/submit — a new record, always landing in the cart as
 * `pending`. Points and carbon are priced server-side from app.waste_types.
 */
export async function submitWaste(
  lineUserId: string,
  input: SubmitWasteInput,
  idempotencyKey: string | null,
): Promise<SubmitWasteResult> {
  const { data, error } = await getServiceClient().rpc('submit_waste', {
    p_line_user_id: lineUserId,
    p_waste_type_id: input.waste_type,
    p_waste_subtype_id: input.waste_subtype,
    p_weight_kg: input.weight_kg ?? undefined,
    // Signed URLs the client got from a read must go back in as paths.
    p_image_urls: input.image_urls.map(toStoragePath),
    p_notes: input.notes ?? undefined,
    p_idempotency_key: idempotencyKey ?? undefined,
  })

  if (error) throw asWriteError(error)

  const payload = data as unknown as { record: WasteRecordJson; duplicate: boolean }
  const record = toWasteRecord(payload.record)
  // The RPC echoes back what was stored — storage paths. Sign them so the
  // response is renderable, exactly like the read path does.
  record.image_urls = await signWastePhotoUrls(record.image_urls)
  return { record, duplicate: payload.duplicate }
}

export interface ConfirmWasteResult {
  record: WasteRecord & { id: number }
  /** False on a replay, and false when the weight rounds to zero points. */
  pointsAwarded: boolean
  alreadyConfirmed: boolean
  txId: string | null
}

/**
 * PUT /api/waste/update — weigh a cart item, mark it done, award the points.
 *
 * Exactly-once: a second call for the same record awards nothing and returns
 * the same body. This is the duplicated-transaction bug that prompted the
 * migration, fixed structurally rather than with a disabled button.
 */
export async function confirmWaste(
  lineUserId: string,
  input: UpdateWasteInput,
  idempotencyKey: string | null,
): Promise<ConfirmWasteResult> {
  const recordedAt = new Date(input.timestamp)
  if (Number.isNaN(recordedAt.getTime())) {
    throw new WriteError(`Unparseable record timestamp: ${input.timestamp}`, 400)
  }

  const { data, error } = await getServiceClient().rpc('confirm_waste', {
    p_line_user_id: lineUserId,
    p_recorded_at: recordedAt.toISOString(),
    p_weight_kg: input.weight_kg ?? undefined,
    p_waste_type_id: input.waste_type ?? undefined,
    p_waste_subtype_id: input.waste_subtype ?? undefined,
    p_image_urls: input.image_urls?.map(toStoragePath) ?? undefined,
    p_notes: input.notes ?? undefined,
    p_idempotency_key: idempotencyKey ?? undefined,
  })

  if (error) throw asWriteError(error)

  const payload = data as unknown as {
    record: WasteRecordJson
    points_awarded: boolean
    already_confirmed: boolean
    tx_id: string | null
  }

  const record = toWasteRecord(payload.record)
  record.image_urls = await signWastePhotoUrls(record.image_urls)

  return {
    record,
    pointsAwarded: payload.points_awarded,
    alreadyConfirmed: payload.already_confirmed,
    txId: payload.tx_id,
  }
}

// ---------------------------------------------------------------------------
// Points and coupons (Phase 5)
// ---------------------------------------------------------------------------

// Custom SQLSTATEs raised by supabase/migrations/0005_rpc_points.sql.
const POINTS_ERROR_STATUS: Record<string, number> = {
  DW001: 402, // not enough points — Payment Required is the honest code here
  DW002: 409, // coupon already used
  DW003: 400, // reward unavailable, or a variable price below its floor
}

function asPointsError(error: { message: string; code?: string }): WriteError {
  const status = error.code
    ? (POINTS_ERROR_STATUS[error.code] ?? RPC_ERROR_STATUS[error.code] ?? 500)
    : 500
  return new WriteError(error.message, status, error.code)
}

export interface RedeemResult {
  txId: string
  pointsUsed: number
  coupons: CouponRecord[]
  /** True when the Idempotency-Key replayed an earlier redemption. Still a 200. */
  duplicate: boolean
}

/**
 * POST /api/coupons/redeem — price, spend and mint in one transaction.
 *
 * Replaces the client's spend-then-create pair. There is no longer an
 * interleaving in which points leave the balance and no coupon appears, which
 * is what app/checkout/page.tsx did on every single checkout.
 */
export async function redeemRewards(
  lineUserId: string,
  input: RedeemRewardsInput,
  idempotencyKey: string | null,
): Promise<RedeemResult> {
  const { data, error } = await getServiceClient().rpc('redeem_rewards', {
    p_line_user_id: lineUserId,
    p_items: input.items,
    p_redeem_type: input.redeem_type,
    p_idempotency_key: idempotencyKey ?? undefined,
  })

  if (error) throw asPointsError(error)

  const payload = data as unknown as {
    tx_id: string
    points_used: number
    coupons: CouponRecord[]
    duplicate: boolean
  }

  return {
    txId: payload.tx_id,
    pointsUsed: payload.points_used,
    coupons: payload.coupons ?? [],
    duplicate: payload.duplicate,
  }
}

export interface SpendResult {
  txId: string
  pointsSpent: number
  remainingBalance: number
}

/** POST /api/points {action:'spend_points'} — donations, where the user picks the amount. */
export async function spendPoints(
  lineUserId: string,
  input: DonatePointsInput,
  category: 'reward' | 'donate',
  idempotencyKey: string | null,
): Promise<SpendResult> {
  const { data, error } = await getServiceClient().rpc('spend_points', {
    p_line_user_id: lineUserId,
    p_points: input.points,
    p_category: category,
    p_items: input.items,
    p_idempotency_key: idempotencyKey ?? undefined,
  })

  if (error) throw asPointsError(error)

  const payload = data as unknown as {
    tx_id: string
    points_spent: number
    remaining_balance: number
  }

  return {
    txId: payload.tx_id,
    pointsSpent: payload.points_spent,
    remainingBalance: payload.remaining_balance,
  }
}

/**
 * POST /api/coupons/use — compare-and-swap, so two staff scanning the same QR
 * at once yields exactly one success.
 *
 * Also flips the matching spend_details rows to 'ใช้คูปองแล้ว'. That was a
 * separate best-effort `mark_spend_used` call the client made *after* the coupon
 * was already consumed, and was explicitly allowed to fail.
 */
export async function useCoupon(input: UseCouponInput): Promise<CouponRecord> {
  const { data, error } = await getServiceClient().rpc('use_coupon', {
    p_coupon_id: input.coupon_id,
    p_scanned_by: input.scanned_by ?? undefined,
  })

  if (error) throw asPointsError(error)
  return data as unknown as CouponRecord
}

// ---------------------------------------------------------------------------
// Admin keys (Phase 3, finishing)
// ---------------------------------------------------------------------------

const ADMIN_ERROR_STATUS: Record<string, number> = {
  DW004: 404, // key not found
  DW005: 403, // key already bound to someone else
}

/**
 * Binds an admin key to a LINE account, or re-affirms one this account already
 * holds. See supabase/migrations/0006_admin_keys.sql — a single CAS, so two
 * people racing the same key cannot both win.
 */
export async function activateAdminKey(key: string, lineUserId: string): Promise<boolean> {
  const { data, error } = await getServiceClient().rpc('activate_admin_key', {
    p_key: key,
    p_line_user_id: lineUserId,
  })

  if (error) {
    const status = error.code ? (ADMIN_ERROR_STATUS[error.code] ?? 500) : 500
    throw new WriteError(error.message, status, error.code)
  }

  return (data as unknown as { activated: boolean }).activated
}

// ---------------------------------------------------------------------------
// Catalog (Phase 7)
// ---------------------------------------------------------------------------

/**
 * POST /api/catalog/rewards — the write side of what
 * app/admin/rewards/new/page.tsx has collected all along with nowhere to send.
 *
 * Plain insert, not an RPC: creating a catalog row has no concurrency
 * invariant to protect (unlike spending points), so there's nothing an RPC
 * would buy here.
 */
export async function createReward(input: CreateRewardInput): Promise<RewardCatalogEntry> {
  // `id` is a small integer PK seeded manually in 0003 (legacy REWARDS ids);
  // pick the next free one rather than requiring the admin to know the scheme.
  const db = getServiceClient()
  const { data: maxRow, error: maxError } = await db
    .from('rewards')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (maxError) throw maxError

  const nextId = (maxRow?.id ?? 0) + 1

  const { data, error } = await db
    .from('rewards')
    .insert({
      id: nextId,
      name: input.name,
      description: input.description,
      points: input.points,
      image_path: input.imagePath,
      stock: input.stock ?? null,
      sort_order: nextId,
    })
    .select('id, name, description, points, image_path, is_variable, min_points, stock')
    .single()

  if (error) throw error

  return {
    id: data.id,
    name: data.name,
    description: data.description ?? '',
    points: data.points,
    image: catalogImageUrl(data.image_path ?? ''),
    isVariable: data.is_variable,
    minPoints: data.min_points,
    stock: data.stock,
  }
}

/** POST /api/catalog/donations — the write side of app/admin/donations/new/page.tsx. */
export async function createDonationCampaign(
  input: CreateDonationCampaignInput,
): Promise<DonationCampaignEntry> {
  const { data, error } = await getServiceClient()
    .from('donation_campaigns')
    .insert({
      name: input.name,
      description: input.description,
      image_path: input.imagePath,
      closes_at: input.closesAt ?? null,
    })
    .select('id, name, description, image_path, current_amount, closes_at')
    .single()

  if (error) throw error

  return {
    id: data.id,
    name: data.name,
    description: data.description ?? '',
    image: catalogImageUrl(data.image_path ?? ''),
    currentAmount: num2(data.current_amount),
    closesAt: data.closes_at,
  }
}

function num2(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  return Number.isFinite(n) ? n : 0
}
