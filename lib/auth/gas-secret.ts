import 'server-only'

import { timingSafeEqual } from 'node:crypto'

// Shared-secret gate for the two endpoints GAS #3 calls
// (google-apps-script/GAS3/Code.gs). Same secret the registration webhook has
// always used, so there is one value to set and one value to rotate.
//
// These endpoints answer questions about who is registered. Without a gate the
// single-user one is a free "is this LINE id one of your users?" oracle, and
// the list one hands over every LINE user id you have.

const HEADER = 'x-registration-secret'

/** Constant-time, and length-safe: timingSafeEqual throws on a length mismatch. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function hasGasSecret(request: Request): boolean {
  const expected = process.env.GAS_REGISTRATION_SECRET?.trim()
  // An unset secret denies everything rather than failing open.
  if (!expected) return false

  const provided = request.headers.get(HEADER)?.trim()
  if (!provided) return false

  return secretMatches(provided, expected)
}
