import 'server-only'

// Server-side call to GAS #3 — the "LINE OA GAS" deployment that greets a newly
// registered user (see google-apps-script/PHASE-0-FINDINGS.md).
//
// The script itself is unchanged and stays deployed. What moves is the CALLER:
// this used to run in the browser from app/register/page.tsx, which meant
//
//   * the shared secret shipped in the client bundle, so anyone could read it
//     in devtools and POST arbitrary payloads — i.e. make your own OA push
//     messages to any LINE user id they knew;
//   * the endpoint URL was in the bundle and console.log'd on every render;
//   * `Content-Type: text/plain` existed only to dodge the CORS preflight,
//     which also made it callable cross-origin from any page;
//   * delivery raced the LIFF window closing, which is exactly when a user
//     finishes registering. A dropped request meant no welcome message, with
//     nothing recorded anywhere.
//
// None of that applies server-side. What this does NOT fix: the endpoint stays
// publicly reachable and the secret is still a static shared string — it just
// stops being published. Rotate it on both sides once this ships.

/** Exactly the body shape GAS #3 has always received. Do not reorder casually. */
export interface RegistrationNotification {
  lineUserId: string
  userId: string
  pdpaConsent: string
  fullName: string
  nickname: string
  phoneNumber: string
  address: string
  gender: string
  ageRange: string
  userType: string
  subdistrict: string
  occupation: string
  registrationDate: string
}

/**
 * NEXT_PUBLIC_GAS_URL3 is accepted as a fallback so nothing breaks between
 * deploying this and moving the variable. Rename it to GAS_URL3 in Vercel — the
 * NEXT_PUBLIC_ prefix inlines the URL into the client bundle, which is half of
 * what this change is meant to undo.
 */
function endpoint(): string | null {
  return process.env.GAS_URL3?.trim() || process.env.NEXT_PUBLIC_GAS_URL3?.trim() || null
}

let warned = false

/**
 * Fire-and-report. Never throws and never rejects: a failed greeting must not
 * fail a registration that has already been written.
 *
 * Awaited rather than left dangling — on Vercel an un-awaited promise is killed
 * the moment the response is returned, so a dangling fetch would be dropped
 * more often than not. The timeout bounds what that costs the response.
 */
export async function notifyRegistrationComplete(
  payload: RegistrationNotification,
): Promise<boolean> {
  const url = endpoint()
  const secret = process.env.GAS_REGISTRATION_SECRET?.trim()

  if (!url || !secret) {
    // Once per process — this runs on every registration and would otherwise
    // bury the logs.
    if (!warned) {
      warned = true
      console.warn(
        '[register] LINE greeting skipped: set GAS_URL3 and GAS_REGISTRATION_SECRET ' +
          'to enable it. Registration itself is unaffected.',
      )
    }
    return false
  }

  try {
    const response = await fetch(`${url}?route=register`, {
      method: 'POST',
      // Kept as text/plain, byte-identical to what GAS #3 has always received.
      // There is no CORS preflight to dodge from a server, but the script's
      // doPost may branch on e.postData.type, and its source is not exported —
      // so this is not the change to make blind.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret, ...payload }),
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('[register] LINE greeting failed:', response.status)
      return false
    }
    return true
  } catch (error) {
    console.error('[register] LINE greeting failed:', error)
    return false
  }
}
