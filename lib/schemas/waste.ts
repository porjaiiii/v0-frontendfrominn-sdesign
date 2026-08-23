import { z } from 'zod'

import { lineUserIdSchema } from './common'

// Waste record contracts.
//
// `user_id` appears only in the READ schemas, and only because Phase 2 ships
// before Phase 3's auth enforcement. Phase 3 removes it: the id comes from the
// verified token. The write schemas never accept it.

/** Rejects the blob:/data: URLs waste-detail-modal.tsx persists on upload failure. */
export const remoteImageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((url) => !/^(blob|data):/i.test(url), {
    message: 'Local object URLs cannot be persisted',
  })

export const imageUrlsSchema = z.array(remoteImageUrlSchema).max(10).default([])

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const wasteRecordsQuerySchema = z.object({
  user_id: lineUserIdSchema,
})

export type WasteRecordsQuery = z.infer<typeof wasteRecordsQuerySchema>

// ---------------------------------------------------------------------------
// Writes (Phase 4)
// ---------------------------------------------------------------------------

/**
 * Folds the several shapes today's clients send for images into one array.
 *
 * The backend flag can be flipped without redeploying the browser bundle, so
 * the Supabase path has to accept exactly what the GAS path accepts:
 *   - `image_urls: string[]`         — components/waste-cart.tsx
 *   - `image_url: string[]`          — app/home/page.tsx (an array, despite the name)
 *   - `image_url: 'a.jpg,b.jpg'`     — components/waste-detail-modal.tsx (joined)
 *   - `image_url: null | ''`         — nothing attached
 *
 * Empty strings are dropped rather than rejected: `[''].join(',')` is how the
 * modal represents "no image", and a 400 there would be a regression.
 */
function collectImageUrls(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input
  const body = input as Record<string, unknown>
  if (body.image_urls !== undefined && body.image_url === undefined) return input

  const raw = body.image_urls ?? body.image_url
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : []

  return {
    ...body,
    image_urls: list.map((url) => String(url).trim()).filter((url) => url.length > 0),
  }
}

/** The legacy "not yet weighed" sentinel. `0` reaches the same place. */
function normaliseWeight(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input
  const body = input as Record<string, unknown>
  if (typeof body.weight_kg === 'number' && body.weight_kg <= 0) {
    return { ...body, weight_kg: null }
  }
  return body
}

const fromLegacyClient = (input: unknown) => normaliseWeight(collectImageUrls(input))

/**
 * Submitting a new record.
 *
 * Deliberately absent: `status` (GAS hardcoded 'pending' and ignored the
 * client's 'done' — see google-apps-script/PHASE-0-FINDINGS.md), and
 * `points_earned` / `carbon_reduction`, which the server derives from
 * app.waste_types so a client cannot price its own submission.
 */
export const submitWasteSchema = z.preprocess(
  fromLegacyClient,
  z.object({
    waste_type: z.string().min(1).max(64),
    waste_subtype: z.string().min(1).max(64),
    /** Omitted or null means "not yet weighed" — the legacy -1 sentinel. */
    weight_kg: z.number().positive().max(10_000).nullish(),
    image_urls: imageUrlsSchema,
    notes: z.string().max(2000).optional(),
  }),
)

export type SubmitWasteInput = z.infer<typeof submitWasteSchema>

/**
 * Confirming (or editing) a record already in the cart.
 *
 * `status` is accepted and ignored — the clients all send `'done'`, which is
 * the only transition this path performs. Naming it here documents that it
 * cannot be used to force a record back to `pending`.
 */
export const updateWasteSchema = z.preprocess(
  fromLegacyClient,
  z.object({
    /** Identifies the record: today's de-facto key is (line_user_id, recorded_at). */
    timestamp: z.string().min(1),
    waste_type: z.string().min(1).max(64).optional(),
    waste_subtype: z.string().min(1).max(64).optional(),
    weight_kg: z.number().positive().max(10_000).nullish(),
    image_urls: imageUrlsSchema.optional(),
    notes: z.string().max(2000).optional(),
    status: z.enum(['pending', 'done', 'cancelled']).optional(),
  }),
)

export type UpdateWasteInput = z.infer<typeof updateWasteSchema>
