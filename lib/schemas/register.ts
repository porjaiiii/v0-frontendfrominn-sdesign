import { z } from 'zod'

import {
  AGE_RANGES,
  GENDERS,
  OCCUPATIONS,
  SUBDISTRICTS,
  USER_TYPES,
} from '@/lib/registration-options'

// Registration write contract.
//
// lineUserId is deliberately absent, matching every other write schema in
// this codebase (see lib/schemas/common.ts) — identity comes from the
// verified LINE ID token (lib/auth/verify-line-token.ts), never the body.
//
// gender / ageRange / subdistrict / occupation used to be FK'd to app.ref_*
// tables, and those foreign keys were the only thing keeping a junk value out
// of columns that reports group by. The tables are gone
// (supabase/migrations/0011_drop_ref_tables.sql), so the enums below inherit
// that job — the list itself lives in lib/registration-options.ts, shared with
// the form so the two cannot drift.
//
// Each stays nullable: a tourist submits no subdistrict and no occupation, and
// an empty string would have violated the old FK, so '' is normalised to null
// BEFORE the enum sees it.

/** Empty means "not answered", which is null — never ''. */
const referenceValue = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .optional()
    .default('')
    .transform((value) => (value.trim() === '' ? null : value))
    .pipe(z.enum(values).nullable())

export const registerUserSchema = z.object({
  pdpaConsent: z.string().max(20),
  fullName: z.string().trim().min(1).max(200),
  nickname: z.string().max(200).optional().default(''),
  phoneNumber: z.string().max(20).optional().default(''),
  address: z.string().max(2000).optional().default(''),
  gender: referenceValue(GENDERS),
  ageRange: referenceValue(AGE_RANGES),
  userType: referenceValue(USER_TYPES),
  subdistrict: referenceValue(SUBDISTRICTS),
  occupation: referenceValue(OCCUPATIONS),
})

export type RegisterUserInput = z.infer<typeof registerUserSchema>
