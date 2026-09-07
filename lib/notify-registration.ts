import 'server-only'

// Server-side call to GAS #3 — the "LINE OA GAS" deployment that greets a newly
// registered user and switches their LINE rich menu to the registered one.
// Source: google-apps-script/GAS3/Code.gs (handleRegistration).
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
      // Its doPost JSON.parses e.postData.contents without looking at the type,
      // so this is cosmetic — but changing it buys nothing either.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret, ...payload }),
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    })

    const text = await response.text()

    if (!response.ok) {
      console.error('[register] LINE greeting failed:', response.status, text.slice(0, 200))
      return false
    }

    // A 200 is not success here. Apps Script's ContentService cannot set a
    // status code at all, so every outcome — including a rejected secret —
    // arrives as 200 with the real result in the BODY. Trusting the status code
    // is what let a stale secret read as a delivered greeting: no message, no
    // rich-menu switch, nothing in the logs.
    //
    // Deliberately asymmetric, because the deployed script's exact success
    // shape is not something this code should depend on:
    //   - not JSON at all  -> failure. An Apps Script web app answering with
    //     HTML is the Google sign-in page, i.e. the deployment stopped being
    //     reachable anonymously.
    //   - { status: 'error' } -> failure, the documented rejection shape.
    //   - anything else JSON -> treated as success, so a script revision that
    //     returns a different body cannot turn working greetings into noise.
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      console.error('[register] LINE greeting: GAS did not return JSON:', text.slice(0, 200))
      return false
    }

    if ((parsed as { status?: string } | null)?.status === 'error') {
      console.error('[register] LINE greeting rejected by GAS:', text.slice(0, 200))
      return false
    }

    return true
  } catch (error) {
    console.error('[register] LINE greeting failed:', error)
    return false
  }
}
