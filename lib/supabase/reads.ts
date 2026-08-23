import 'server-only'

import type { CouponRecord, CouponStatus } from '@/lib/coupon-config'
import { FALLBACK_AVATAR, type RankingEntry } from '@/lib/ranking'
import type { WasteRecord } from '@/lib/waste-records'

import { catalogImageUrl } from './storage'
import { getServiceClient } from './server'
import { signWastePhotoUrls, signWastePhotoUrlsBatch } from './storage'

// Phase 2 read paths.
//
// Every function here returns EXACTLY the shape its GAS-era counterpart
// returned, so the routes can be flipped one at a time behind lib/backend-flags
// and diffed against the old backend. Where a shape is ugly (the profile's
// duplicated fullName/name aliases, for instance) it is reproduced faithfully
// rather than cleaned up — tidying the contract is a separate, later change.

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  return Number.isFinite(n) ? n : 0
}

function str(value: unknown): string {
  return value == null ? '' : String(value)
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/** The exact object GAS getUser returned as `result.data`. */
export interface ProfileResponse {
  lineUserId: string
  userId: string
  pdpaConsent: string
  fullName: string
  /** Alias of fullName. Kept because consumers read both. */
  name: string
  nickname: string
  phoneNumber: string
  gender: string
  ageRange: string
  /** Alias of ageRange. */
  age: string
  userType: string
  /** Alias of userType. */
  type: string
  address: string
  subdistrict: string
  occupation: string
  registrationDate: string
}

/** Shared by every path that reads back an `app.users` row — reads and writes alike. */
export function mapProfileRow(data: Record<string, unknown>): ProfileResponse {
  const fullName = str(data.full_name)
  const ageRange = str(data.age_range)
  const userType = str(data.user_type)

  return {
    lineUserId: str(data.line_user_id),
    userId: str(data.display_user_id),
    pdpaConsent: str(data.pdpa_consent),
    fullName,
    name: fullName,
    nickname: str(data.nickname),
    phoneNumber: str(data.phone_number),
    gender: str(data.gender),
    ageRange,
    age: ageRange,
    userType,
    type: userType,
    address: str(data.address),
    subdistrict: str(data.subdistrict),
    occupation: str(data.occupation),
    registrationDate: str(data.registration_date_th),
  }
}

export async function getProfile(lineUserId: string): Promise<ProfileResponse | null> {
  const { data, error } = await getServiceClient()
    .from('users')
    .select('*')
    .eq('line_user_id', lineUserId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return mapProfileRow(data)
}

// ---------------------------------------------------------------------------
// Waste records
// ---------------------------------------------------------------------------

export interface WasteRecordsResult {
  records: WasteRecord[]
  stats: { total: number; pending: number }
}

/**
 * Returns typed objects, not the array-of-arrays GAS produced.
 *
 * `stats` is now scoped to the requested user. GAS computed it over the WHOLE
 * sheet (getRecords took no user filter), which meant every caller saw a global
 * pending count labelled as their own.
 */
export async function getWasteRecords(lineUserId: string): Promise<WasteRecordsResult> {
  const { data, error } = await getServiceClient()
    .from('waste_records')
    // Must stay ONE string literal: supabase-js derives the row type from it,
    // and a concatenated expression degrades to GenericStringError.
    .select('line_user_id, waste_type_id, waste_subtype_id, weight_kg, image_urls, carbon_reduction_kg, points_earned, status, notes, recorded_at')
    .eq('line_user_id', lineUserId)
    .order('recorded_at', { ascending: false })

  if (error) throw error

  const rows = data ?? []

  // ONE signing request for every photo on the page. Signing per record — or
  // worse, per photo — is the shape that got the Drive thumbnails rate-limited.
  // Values that are already URLs (legacy Drive links) pass through untouched.
  const imageUrls = await signWastePhotoUrlsBatch(rows.map((row) => row.image_urls ?? []))

  const records: WasteRecord[] = rows.map((row, index) => ({
    timestamp: row.recorded_at,
    user_id: row.line_user_id,
    waste_type: str(row.waste_type_id),
    waste_subtype: str(row.waste_subtype_id),
    // NULL is the legacy "not yet weighed" sentinel; mapWasteRecords coerced
    // that to 0, and every weight filter is `> 0`, so 0 is the faithful value.
    weight_kg: num(row.weight_kg),
    image_urls: imageUrls[index] ?? [],
    carbon_reduction: num(row.carbon_reduction_kg),
    points_earned: num(row.points_earned),
    status: str(row.status),
    notes: row.notes ?? undefined,
  }))

  return {
    records,
    stats: {
      total: records.length,
      pending: records.filter((r) => r.status === 'pending').length,
    },
  }
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

type CouponRow = {
  coupon_id: string
  line_user_id: string
  reward_id: number | null
  reward_name: string
  reward_description: string
  reward_image: string
  points_used: number
  tx_id: string | null
  status: string
  redeemed_at: string
  used_at: string | null
  expires_at: string | null
  scanned_by: string | null
  redeem_type: string | null
}

// One string literal — see the note on getWasteRecords' select.
const COUPON_COLUMNS =
  'coupon_id, line_user_id, reward_id, reward_name, reward_description, reward_image, points_used, tx_id, status, redeemed_at, used_at, expires_at, scanned_by, redeem_type'

function toCouponRecord(row: CouponRow): CouponRecord {
  return {
    coupon_id: row.coupon_id,
    user_id: row.line_user_id,
    reward_id: row.reward_id ?? 0,
    reward_name: row.reward_name,
    reward_description: row.reward_description,
    reward_image: row.reward_image,
    points_used: row.points_used,
    tx_id: row.tx_id ?? undefined,
    status: row.status as CouponStatus,
    redeemed_at: row.redeemed_at,
    used_at: row.used_at ?? undefined,
    expires_at: row.expires_at ?? undefined,
    scanned_by: row.scanned_by ?? undefined,
    redeem_type: (row.redeem_type as CouponRecord['redeem_type']) ?? undefined,
  }
}

export async function getCouponsByUser(
  lineUserId: string,
  status?: string | null,
): Promise<CouponRecord[]> {
  let query = getServiceClient()
    .from('coupons')
    .select(COUPON_COLUMNS)
    .eq('line_user_id', lineUserId)
    .order('redeemed_at', { ascending: false })

  // GAS returned every status and the route filtered afterwards; doing it here
  // means the rows never cross the wire.
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(toCouponRecord)
}

export async function getCouponById(couponId: string): Promise<CouponRecord | null> {
  const { data, error } = await getServiceClient()
    .from('coupons')
    .select(COUPON_COLUMNS)
    .eq('coupon_id', couponId)
    .maybeSingle()

  if (error) throw error
  return data ? toCouponRecord(data) : null
}

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

/** Same shape get_or_create_account / resync_balance / get_account_fast produced. */
export interface AccountResponse {
  user_id: string
  total_points: number
  total_weight: number
  total_co2: number
  tier: string
  last_updated?: string
}

/**
 * One query where the GAS path took three sequential round trips, because the
 * spendable balance is derived by app.v_user_balances rather than stored and
 * periodically resynced.
 */
export async function getAccount(lineUserId: string): Promise<AccountResponse | null> {
  const { data, error } = await getServiceClient()
    .from('v_leaderboard')
    .select('line_user_id, total_points, total_weight, total_co2, tier')
    .eq('line_user_id', lineUserId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    user_id: str(data.line_user_id),
    total_points: Math.round(num(data.total_points)),
    // 2-decimal metrics, matching the rounding fetchAccountFast applied.
    total_weight: Math.round(num(data.total_weight) * 100) / 100,
    total_co2: Math.round(num(data.total_co2) * 100) / 100,
    tier: str(data.tier),
  }
}

export interface TransactionResponse {
  tx_id: string
  user_id: string
  type: string
  points: number
  co2: number
  weight: number
  timestamp: string
}

export async function getTransactions(lineUserId: string): Promise<TransactionResponse[]> {
  const { data, error } = await getServiceClient()
    .from('point_transactions')
    .select('tx_id, line_user_id, kind, points_delta, co2_kg, weight_kg, occurred_at')
    .eq('line_user_id', lineUserId)
    .order('occurred_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    tx_id: row.tx_id,
    user_id: row.line_user_id,
    type: row.kind,
    // GAS stored spends as a positive magnitude with type='spend'.
    points: Math.abs(row.points_delta),
    co2: num(row.co2_kg),
    weight: num(row.weight_kg),
    timestamp: row.occurred_at,
  }))
}

export interface SpendDetailResponse {
  tx_id: string
  user_id: string
  category: string
  item_name: string
  quantity: number
  points: number
  status: string
  timestamp: string
}

export async function getSpendDetails(lineUserId: string): Promise<SpendDetailResponse[]> {
  const { data, error } = await getServiceClient()
    .from('spend_details')
    .select('tx_id, line_user_id, category, item_name, quantity, points, status, occurred_at')
    .eq('line_user_id', lineUserId)
    .order('occurred_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    tx_id: row.tx_id,
    user_id: row.line_user_id,
    category: row.category,
    item_name: row.item_name,
    quantity: row.quantity,
    points: row.points,
    status: row.status,
    timestamp: row.occurred_at,
  }))
}

export interface Co2EntryResponse {
  waste_type: string
  weight: number
  co2: number
  last_updated: string
}

export async function getCo2Collection(lineUserId: string): Promise<Co2EntryResponse[]> {
  const { data, error } = await getServiceClient()
    .from('v_co2_collection')
    .select('waste_type, weight, co2, last_updated')
    .eq('line_user_id', lineUserId)

  if (error) throw error

  return (data ?? []).map((row) => ({
    waste_type: str(row.waste_type),
    weight: num(row.weight),
    co2: num(row.co2),
    last_updated: str(row.last_updated),
  }))
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export interface LeaderboardResult {
  ranking: RankingEntry[]
  byUser: Record<string, { location: string; isTourist: boolean }>
}

/**
 * Replaces the two parallel Sheets reads (points_account + Registration) that
 * app/api/points/ranking cross-references today with a single view query.
 *
 * Ordering is by carbon descending, exactly as before. `points` is the spendable
 * balance and is displayed, not ranked on.
 */
export async function getLeaderboard(limit = 200): Promise<LeaderboardResult> {
  const { data, error } = await getServiceClient()
    .from('v_leaderboard')
    .select('line_user_id, display_name, subdistrict, is_tourist, total_points, total_co2')
    .order('total_co2', { ascending: false })
    .limit(limit)

  if (error) throw error

  const byUser: LeaderboardResult['byUser'] = {}
  const ranking: RankingEntry[] = (data ?? []).map((row, index) => {
    const lineUserId = str(row.line_user_id)
    byUser[lineUserId] = {
      location: str(row.subdistrict),
      isTourist: row.is_tourist ?? false,
    }
    return {
      rank: index + 1,
      lineUserId,
      name: str(row.display_name) || `ผู้ใช้ ${index + 1}`,
      carbon: Math.round(num(row.total_co2) * 100) / 100,
      points: Math.round(num(row.total_points)),
      avatar: FALLBACK_AVATAR,
      location: str(row.subdistrict),
      isTourist: row.is_tourist ?? false,
    }
  })

  return { ranking, byUser }
}

// ---------------------------------------------------------------------------
// Catalog (Phase 7)
// ---------------------------------------------------------------------------

export interface WasteTypeCatalogEntry {
  id: string
  name: string
  icon: string
  carbonFactor: number
  pointsPerKg: number
}

/** GET /api/catalog/waste-types — replaces the hardcoded rate tables. */
export async function getWasteTypes(): Promise<WasteTypeCatalogEntry[]> {
  const { data, error } = await getServiceClient()
    .from('waste_types')
    .select('id, name_th, icon_path, carbon_factor, points_per_kg')
    .eq('is_active', true)
    .order('sort_order')

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name_th,
    icon: row.icon_path ?? '',
    carbonFactor: num(row.carbon_factor),
    pointsPerKg: num(row.points_per_kg),
  }))
}

export interface RewardCatalogEntry {
  id: number
  name: string
  description: string
  points: number
  image: string
  isVariable: boolean
  minPoints: number | null
  /** null = unlimited. */
  stock: number | null
}

/** GET /api/catalog/rewards — replaces the static REWARDS array in lib/waste-data.ts. */
export async function getRewardsCatalog(): Promise<RewardCatalogEntry[]> {
  const { data, error } = await getServiceClient()
    .from('rewards')
    .select('id, name, description, points, image_path, is_variable, min_points, stock')
    .eq('is_active', true)
    .order('sort_order')

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: str(row.description),
    points: row.points,
    image: catalogImageUrl(row.image_path ?? ''),
    isVariable: row.is_variable,
    minPoints: row.min_points,
    stock: row.stock,
  }))
}

export interface DonationCampaignEntry {
  id: number
  name: string
  description: string
  image: string
  currentAmount: number
  closesAt: string | null
}

/** GET /api/catalog/donations — replaces the hardcoded DONATIONS array in app/donate/page.tsx. */
export async function getDonationCampaigns(): Promise<DonationCampaignEntry[]> {
  const { data, error } = await getServiceClient()
    .from('donation_campaigns')
    .select('id, name, description, image_path, current_amount, closes_at')
    .eq('is_active', true)
    .order('sort_order')

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: str(row.description),
    image: catalogImageUrl(row.image_path ?? ''),
    currentAmount: num(row.current_amount),
    closesAt: row.closes_at,
  }))
}
