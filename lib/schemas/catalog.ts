import { z } from 'zod'

// Admin-only catalog writes (Phase 7).
//
// Both app/admin/rewards/new/page.tsx and app/admin/donations/new/page.tsx
// already collected this input — they just had nowhere to send it
// ("// TODO: POST to GAS / API route"). These are the schemas for where it
// goes now.

export const createRewardSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().default(''),
  points: z.coerce.number().int().positive().max(1_000_000),
  /** Storage path from POST /api/catalog/images/sign, or empty for no image. */
  imagePath: z.string().trim().max(500).optional().default(''),
  /** Omitted or empty means unlimited — matches the DB default (stock NULL). */
  stock: z.coerce.number().int().min(0).max(1_000_000).nullish(),
})

export type CreateRewardInput = z.infer<typeof createRewardSchema>

export const createDonationCampaignSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().default(''),
  imagePath: z.string().trim().max(500).optional().default(''),
  /** ISO date (YYYY-MM-DD). Omitted means open-ended, matching the "ไม่มีวันสิ้นสุด" toggle. */
  closesAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
})

export type CreateDonationCampaignInput = z.infer<typeof createDonationCampaignSchema>

/** POST /api/catalog/images/sign body. */
export const catalogImageUploadSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
  /** Which gallery the image belongs to — becomes part of the storage path. */
  kind: z.enum(['rewards', 'donations']),
})

export type CatalogImageUploadInput = z.infer<typeof catalogImageUploadSchema>
