import { z } from 'zod'

// Registration write contract.
//
// lineUserId is deliberately absent, matching every other write schema in
// this codebase (see lib/schemas/common.ts) — identity comes from the
// verified LINE ID token (lib/auth/verify-line-token.ts), never the body.
//
// gender / ageRange / userType / subdistrict / occupation are FK'd to
// app.ref_* tables (supabase/migrations/0001_schema.sql). An empty string
// would violate that constraint — a tourist submits no subdistrict/occupation
// — so each is normalised to null.

const emptyToNull = (value: string) => (value.trim() === '' ? null : value)

export const registerUserSchema = z.object({
  pdpaConsent: z.string().max(20),
  fullName: z.string().trim().min(1).max(200),
  nickname: z.string().max(200).optional().default(''),
  phoneNumber: z.string().max(20).optional().default(''),
  address: z.string().max(2000).optional().default(''),
  gender: z.string().max(50).optional().default('').transform(emptyToNull),
  ageRange: z.string().max(50).optional().default('').transform(emptyToNull),
  userType: z.string().max(100).optional().default('').transform(emptyToNull),
  subdistrict: z.string().max(100).optional().default('').transform(emptyToNull),
  occupation: z.string().max(200).optional().default('').transform(emptyToNull),
})

export type RegisterUserInput = z.infer<typeof registerUserSchema>
