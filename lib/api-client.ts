'use client'

import { useCallback, useRef } from 'react'
import liff from '@line/liff'

// One place that knows how to call our own API, so no call site can forget the
// two headers that matter.
//
//   Authorization: Bearer <LINE ID token>  — the migrated routes derive
//     line_user_id from this and ignore any user id in the body. Until every
//     route is migrated the header is best-effort: the GAS branches don't read
//     it, so sending it costs nothing and flipping a BACKEND_* flag doesn't
//     need a client deploy.
//
//   Idempotency-Key — held in a useRef for the lifetime of one submit press, so
//     a network retry, a double-tap or a second tab replays the SAME key and
//     the server returns the original record instead of creating another.
//     This is the client half of the duplicate-transaction fix; the server half
//     is the partial unique indexes in supabase/migrations/0001_schema.sql.

/** crypto.randomUUID() needs a secure context; plain-http dev doesn't have one. */
export function newIdempotencyKey(): string {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID()
  if (c?.getRandomValues) {
    const bytes = c.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * Set by hooks/use-liff.ts once liff.init() resolves.
 *
 * Without it, every call below throws `liffId is necessary for liff.init()`
 * while init is still in flight — caught, but thrown once per request. The
 * flag is only ever set to true, so a slow init costs an unauthenticated request
 * or two rather than permanently disabling the header.
 */
let sdkReady = false

export function setLiffSdkReady(ready: boolean): void {
  sdkReady = ready
}

/**
 * Best-effort — returns null outside LINE, before liff.init(), or when the
 * session has expired. Never throws: a missing token must not stop a submit
 * that the GAS backend would have accepted.
 */
function getIdToken(): string | null {
  if (!sdkReady) return null
  try {
    return liff.isLoggedIn() ? liff.getIDToken() : null
  } catch {
    return null
  }
}

export interface ApiFetchInit extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>
  /** Sent as Idempotency-Key. Use useIdempotencyKey() so retries reuse it. */
  idempotencyKey?: string | null
}

export async function apiFetch(path: string, init: ApiFetchInit = {}): Promise<Response> {
  const { idempotencyKey, headers, ...rest } = init

  const merged: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }

  const token = getIdToken()
  if (token) merged.Authorization = `Bearer ${token}`
  if (idempotencyKey) merged['Idempotency-Key'] = idempotencyKey

  return fetch(path, { ...rest, headers: merged })
}

/**
 * A key that survives re-renders and retries, and is retired only once the
 * request it identifies has actually succeeded.
 *
 * `current()` mints one lazily on first use, so a component that never submits
 * never generates one.
 */
export function useIdempotencyKey(): { current: () => string; reset: () => void } {
  const keyRef = useRef<string | null>(null)

  const current = useCallback(() => {
    if (!keyRef.current) keyRef.current = newIdempotencyKey()
    return keyRef.current
  }, [])

  const reset = useCallback(() => {
    keyRef.current = null
  }, [])

  return { current, reset }
}

/**
 * Storage path → a local object URL for the blob that was just uploaded.
 *
 * `image_urls` holds PATHS, because a signed URL expires. But a path is not
 * renderable: handing one to <Image src> makes the browser request it relative
 * to our own origin, which 404s. The server signs paths on the way out, so the
 * only gap is the moment between "just uploaded" and "saved and re-read" — and
 * for that moment the client already has the bytes.
 *
 * Module-level so it survives re-renders. Entries are per-session and few (one
 * per photo a user uploads before saving).
 */
const previewUrls = new Map<string, string>()

/**
 * What to put in <Image src>, given a value out of `image_urls`.
 *
 * Anything already a URL — a signed read URL from the server, a legacy Drive
 * link — is used as-is. A bare path resolves to the local preview if we have it,
 * and to a placeholder if we don't, because rendering the path itself is what
 * produces a 404 for an image that is in fact stored perfectly well.
 */
export function displaySrc(value: string): string {
  if (/^(https?|blob|data):/.test(value)) return value
  return previewUrls.get(value) ?? '/placeholder.jpg'
}

/**
 * Uploads a photo and returns the value to store in `image_urls`.
 *
 * Asks the server for a one-shot signed URL, then PUTs the Blob straight to
 * storage — the image never passes through a Vercel function. That is what lets
 * lib/compress-image target ~2MB instead of 0.5MB: base64 through a function
 * inflates by ~33% against a 4.5MB body limit, and squeezing under that is why
 * evidence photos used to come out unreadable.
 *
 * Falls back to the old base64 route when signing isn't available (the GAS
 * backend answers 501), so this works on either backend.
 */
export async function uploadWastePhoto(
  blob: Blob,
  fallback: { fileName: string; userId: string },
): Promise<string> {
  const contentType = blob.type || 'image/jpeg'

  const signRes = await apiFetch('/api/upload-image/sign', {
    method: 'POST',
    body: JSON.stringify({ contentType }),
  })

  if (signRes.ok) {
    const { path, signedUrl } = await signRes.json()

    const put = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    })

    if (!put.ok) {
      throw new Error(`อัปโหลดรูปไม่สำเร็จ (${put.status})`)
    }

    // Show the bytes we already have until the record is saved and read back
    // with a signed URL. Without this the freshly-added photo renders as a 404.
    previewUrls.set(path, URL.createObjectURL(blob))

    // The PATH is stored, not the signed URL — the URL expires, the path does
    // not. Reads sign it again on the way out.
    return path
  }

  if (signRes.status !== 501) {
    const err = await signRes.json().catch(() => ({}))
    throw new Error(err?.error ?? 'ไม่สามารถเตรียมการอัปโหลดได้')
  }

  // GAS backend: base64 through the old route.
  const base64 = await blobToBase64(blob)
  const res = await apiFetch('/api/upload-image', {
    method: 'POST',
    body: JSON.stringify({
      base64Data: base64,
      fileName: fallback.fileName,
      userId: fallback.userId,
    }),
  })

  const result = await res.json().catch(() => ({}))
  if (!res.ok || !result?.success || !result.imageUrl) {
    throw new Error(result?.error ?? 'ไม่สามารถอัปโหลดรูปได้')
  }
  return result.imageUrl
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Uploads a reward/donation image and returns the storage path to save.
 *
 * Same PUT-straight-to-storage shape as uploadWastePhoto, but against the
 * public catalog-images bucket via /api/catalog/images/sign — admin-only, no
 * GAS fallback (this feature has no GAS equivalent to fall back to).
 */
export async function uploadCatalogImage(
  blob: Blob,
  kind: 'rewards' | 'donations',
): Promise<string> {
  const contentType = blob.type || 'image/jpeg'

  const signRes = await apiFetch('/api/catalog/images/sign', {
    method: 'POST',
    body: JSON.stringify({ contentType, kind }),
  })

  const signed = await signRes.json().catch(() => ({}))
  if (!signRes.ok) {
    throw new Error(signed?.error ?? 'ไม่สามารถเตรียมการอัปโหลดได้')
  }

  const put = await fetch(signed.signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  })

  if (!put.ok) {
    throw new Error(`อัปโหลดรูปไม่สำเร็จ (${put.status})`)
  }

  return signed.path as string
}
