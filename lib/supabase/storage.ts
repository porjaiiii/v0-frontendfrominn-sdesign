import 'server-only'

import { getServiceClient } from './server'

// Waste evidence photos (Phase 6).
//
// Two rules hold this together:
//
//   1. The object path is built HERE, from a verified line_user_id — never from
//      the request. A client that could name its own path could write into
//      another user's prefix, and the signed upload URL is what would let it.
//
//   2. Reads are signed, short-lived and batched. The bucket is private
//      (supabase/migrations/0007_storage.sql), which is the fix for evidence
//      photos having been world-readable on Drive.

export const WASTE_BUCKET = 'waste-photos'

/** How long a read URL stays valid. Long enough to render a page, not to share. */
const READ_TTL_SECONDS = 60 * 60

/** How long the browser has to finish its PUT. */
const UPLOAD_TTL_SECONDS = 5 * 60

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * `waste/{line_user_id}/{yyyy-MM}/{uuid}.{ext}`
 *
 * The month segment keeps a single prefix from growing without bound, and makes
 * a future retention sweep a prefix delete rather than a query.
 */
export function buildWastePhotoPath(lineUserId: string, contentType: string): string {
  const now = new Date()
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const ext = EXTENSION[contentType] ?? 'jpg'
  // Encoded because a LINE user id is opaque; prod contains `demo_user` and
  // `Usample*` alongside real `U…` ids.
  return `waste/${encodeURIComponent(lineUserId)}/${month}/${crypto.randomUUID()}.${ext}`
}

export interface SignedUpload {
  /** Store this in waste_records.image_urls, not the signed URL. */
  path: string
  /** The browser PUTs the compressed Blob here. */
  signedUrl: string
  token: string
}

/**
 * Issues a one-shot upload URL for a path the caller does not get to choose.
 *
 * This is what lets the browser send the Blob straight to storage. The old flow
 * base64'd the image through a Vercel function, and base64's 33% inflation
 * against the 4.5MB body limit is exactly why lib/compress-image had to target
 * 0.5MB and shred the detail out of evidence photos.
 */
export async function createWastePhotoUpload(
  lineUserId: string,
  contentType: string,
): Promise<SignedUpload> {
  const path = buildWastePhotoPath(lineUserId, contentType)

  const { data, error } = await getServiceClient()
    .storage.from(WASTE_BUCKET)
    .createSignedUploadUrl(path, { upsert: false })

  if (error) throw error
  return { path, signedUrl: data.signedUrl, token: data.token }
}

/** Server-side upload, for the deprecated base64 shim. */
export async function uploadWastePhoto(
  lineUserId: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const path = buildWastePhotoPath(lineUserId, contentType)

  const { error } = await getServiceClient()
    .storage.from(WASTE_BUCKET)
    .upload(path, body, { contentType, upsert: false })

  if (error) throw error
  return path
}

/**
 * True for anything that is already a URL rather than a storage path.
 *
 * Legacy Drive links (`https://drive.google.com/thumbnail?id=…`) stay in
 * image_urls verbatim and must pass through untouched — the plan backfills them
 * separately in Phase 9. One check, in one place.
 */
export function isLegacyUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}

/**
 * The inverse of signing, and it is not optional.
 *
 * Reads hand the client signed URLs, and the client sends the whole record
 * straight back on update (components/waste-cart.tsx posts `record` verbatim).
 * Without this, confirm_waste would store the SIGNED URL in place of the path —
 * a value that stops resolving the moment its token expires, permanently
 * detaching the photo from the record.
 *
 * Anything that isn't one of our signed URLs is returned untouched, so legacy
 * Drive links and plain paths both survive.
 */
export function toStoragePath(value: string): string {
  const marker = `/storage/v1/object/sign/${WASTE_BUCKET}/`
  const index = value.indexOf(marker)
  if (index === -1) return value

  const path = value.slice(index + marker.length).split('?')[0]
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

/**
 * Turns stored values into renderable URLs.
 *
 * Batched: one request for the whole page rather than one per photo, which is
 * the habit that got the Drive thumbnails rate-limited in the first place.
 * A path that fails to sign is dropped rather than rendered as a broken image.
 */
export async function signWastePhotoUrls(values: string[]): Promise<string[]> {
  const paths = values.filter((value) => !isLegacyUrl(value))
  if (paths.length === 0) return values

  const { data, error } = await getServiceClient()
    .storage.from(WASTE_BUCKET)
    .createSignedUrls(paths, READ_TTL_SECONDS)

  if (error) {
    console.error('[storage] failed to sign waste photo URLs:', error)
    return values.filter(isLegacyUrl)
  }

  const signed = new Map<string, string>()
  for (const row of data ?? []) {
    if (row.signedUrl && row.path) signed.set(row.path, row.signedUrl)
  }

  return values
    .map((value) => (isLegacyUrl(value) ? value : signed.get(value)))
    .filter((value): value is string => Boolean(value))
}

/**
 * Signs every photo across many records in ONE round trip.
 *
 * Called by getWasteRecords, where the per-record alternative would be a
 * request per record per photo.
 */
export async function signWastePhotoUrlsBatch(
  groups: string[][],
): Promise<string[][]> {
  const paths = [...new Set(groups.flat().filter((value) => !isLegacyUrl(value)))]
  if (paths.length === 0) return groups

  const { data, error } = await getServiceClient()
    .storage.from(WASTE_BUCKET)
    .createSignedUrls(paths, READ_TTL_SECONDS)

  if (error) {
    console.error('[storage] failed to sign waste photo URLs:', error)
    return groups.map((group) => group.filter(isLegacyUrl))
  }

  const signed = new Map<string, string>()
  for (const row of data ?? []) {
    if (row.signedUrl && row.path) signed.set(row.path, row.signedUrl)
  }

  return groups.map((group) =>
    group
      .map((value) => (isLegacyUrl(value) ? value : signed.get(value)))
      .filter((value): value is string => Boolean(value)),
  )
}

export { READ_TTL_SECONDS, UPLOAD_TTL_SECONDS }

// ---------------------------------------------------------------------------
// Catalog images (Phase 7) — reward and donation photos.
//
// A different shape from waste-photos on purpose: those are private evidence
// tied to one user, signed on every read. These are shown to every visitor
// browsing /rewards or /donate, so the bucket is PUBLIC and reads need no
// signing at all — the only thing gated is the UPLOAD, server-side, to admins
// (see app/api/catalog/images/sign/route.ts).
// ---------------------------------------------------------------------------

export const CATALOG_BUCKET = 'catalog-images'

const CATALOG_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export type CatalogImageKind = 'rewards' | 'donations'

export function buildCatalogImagePath(kind: CatalogImageKind, contentType: string): string {
  const ext = CATALOG_EXTENSION[contentType] ?? 'jpg'
  return `${kind}/${crypto.randomUUID()}.${ext}`
}

/** Issues a one-shot upload URL. Caller (the route) is responsible for admin-gating this. */
export async function createCatalogImageUpload(
  kind: CatalogImageKind,
  contentType: string,
): Promise<SignedUpload> {
  const path = buildCatalogImagePath(kind, contentType)

  const { data, error } = await getServiceClient()
    .storage.from(CATALOG_BUCKET)
    .createSignedUploadUrl(path, { upsert: false })

  if (error) throw error
  return { path, signedUrl: data.signedUrl, token: data.token }
}

/**
 * Path → public URL. No signing, no expiry — unlike signWastePhotoUrls, this
 * never touches the network; the bucket being public means the URL shape alone
 * is enough.
 */
export function catalogImageUrl(path: string): string {
  if (!path) return ''
  if (isLegacyUrl(path)) return path
  // Local bundled assets (/images/rewards/*.jpg) predate this bucket and stay
  // exactly as they are — Next's own static file serving handles them.
  if (path.startsWith('/')) return path

  const { data } = getServiceClient().storage.from(CATALOG_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
