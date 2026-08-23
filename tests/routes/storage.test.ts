import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { getServiceClient } from '@/lib/supabase/server'
import {
  buildWastePhotoPath,
  isLegacyUrl,
  signWastePhotoUrls,
  signWastePhotoUrlsBatch,
  toStoragePath,
  uploadWastePhoto,
  WASTE_BUCKET,
} from '@/lib/supabase/storage'

import { supabaseConfigured } from './fixtures'

// Phase 6 — evidence photos move off Google Drive.
//
// Drive was failing twice: the thumbnail endpoint rate-limits per IP (429s on
// the history page), and the uploader never called setSharing, so the photos
// were only reachable because the folder was world-readable.

if (!supabaseConfigured()) {
  throw new Error('Route tests need a local Supabase. Run `pnpm db:start`.')
}

const USER = 'Utest_storage'
const OTHER = 'Utest_storage_other'
const db = getServiceClient()
const uploaded: string[] = []

async function cleanup(): Promise<void> {
  if (uploaded.length > 0) {
    await db.storage.from(WASTE_BUCKET).remove(uploaded)
    uploaded.length = 0
  }
}

async function put(user = USER): Promise<string> {
  // A 1x1 JPEG is enough — this is about paths and access, not pixels.
  const bytes = Buffer.from(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
      'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
      'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
    'base64',
  )
  const path = await uploadWastePhoto(user, bytes, 'image/jpeg')
  uploaded.push(path)
  return path
}

beforeEach(cleanup)
afterAll(cleanup)

describe('paths', () => {
  it('namespaces by user and month, and never reuses a name', () => {
    const a = buildWastePhotoPath(USER, 'image/jpeg')
    const b = buildWastePhotoPath(USER, 'image/jpeg')

    expect(a).toMatch(new RegExp(`^waste/${USER}/\\d{4}-\\d{2}/[0-9a-f-]{36}\\.jpg$`))
    expect(a).not.toBe(b)
  })

  it('keeps one user out of another user’s prefix', () => {
    // The path is built server-side from a verified token, never from the
    // request — this asserts the shape that makes that guarantee meaningful.
    expect(buildWastePhotoPath(USER, 'image/jpeg')).toContain(`waste/${USER}/`)
    expect(buildWastePhotoPath(OTHER, 'image/jpeg')).toContain(`waste/${OTHER}/`)
  })

  it('maps content types to extensions, defaulting to jpg', () => {
    expect(buildWastePhotoPath(USER, 'image/png')).toMatch(/\.png$/)
    expect(buildWastePhotoPath(USER, 'image/webp')).toMatch(/\.webp$/)
    expect(buildWastePhotoPath(USER, 'application/pdf')).toMatch(/\.jpg$/)
  })
})

describe('the bucket is private', () => {
  it('is not marked public', async () => {
    const { data, error } = await db.storage.getBucket(WASTE_BUCKET)
    expect(error).toBeNull()
    expect(data!.public).toBe(false)
  })

  it('refuses an unsigned fetch of an uploaded object', async () => {
    const path = await put()

    // The public URL shape resolves for a public bucket and 400s for a private
    // one. This is the check that would have caught the Drive exposure.
    const { data } = db.storage.from(WASTE_BUCKET).getPublicUrl(path)
    const response = await fetch(data.publicUrl)

    expect(response.ok).toBe(false)
    expect(response.status).toBeGreaterThanOrEqual(400)
  })
})

describe('signing', () => {
  it('produces a URL that actually serves the object', async () => {
    const path = await put()
    const [signed] = await signWastePhotoUrls([path])

    expect(signed).toContain(`/object/sign/${WASTE_BUCKET}/`)

    const response = await fetch(signed)
    expect(response.ok).toBe(true)
    expect(response.headers.get('content-type')).toContain('image')
  })

  it('passes legacy Drive URLs through untouched', async () => {
    const drive = 'https://drive.google.com/thumbnail?id=1RVWkxlUJv5&sz=w1000'
    expect(isLegacyUrl(drive)).toBe(true)
    expect(await signWastePhotoUrls([drive])).toEqual([drive])
  })

  it('signs a mixed record in one call and keeps the order', async () => {
    const drive = 'https://drive.google.com/thumbnail?id=abc&sz=w1000'
    const path = await put()

    const result = await signWastePhotoUrls([drive, path])
    expect(result).toHaveLength(2)
    expect(result[0]).toBe(drive)
    expect(result[1]).toContain('/object/sign/')
  })

  it('signs every photo across many records in one round trip', async () => {
    const a = await put()
    const b = await put()

    const groups = await signWastePhotoUrlsBatch([[a], [], [b, a]])

    expect(groups[0][0]).toContain('/object/sign/')
    expect(groups[1]).toEqual([])
    expect(groups[2]).toHaveLength(2)
    // The same path appearing twice is de-duplicated on the way out and still
    // resolves in both places.
    expect(groups[2][1]).toContain('/object/sign/')
  })

  it('drops a path that cannot be signed rather than rendering a broken image', async () => {
    const result = await signWastePhotoUrls(['waste/nobody/2026-01/missing.jpg'])
    expect(result).toEqual([])
  })
})

describe('toStoragePath', () => {
  it('recovers the path from a signed URL', async () => {
    const path = await put()
    const [signed] = await signWastePhotoUrls([path])

    // This is what stops a re-submitted record from storing an expiring URL in
    // place of its path.
    expect(toStoragePath(signed)).toBe(path)
  })

  it('leaves legacy URLs and bare paths alone', () => {
    const drive = 'https://drive.google.com/thumbnail?id=abc&sz=w1000'
    expect(toStoragePath(drive)).toBe(drive)
    expect(toStoragePath('waste/U1/2026-01/x.jpg')).toBe('waste/U1/2026-01/x.jpg')
  })

  it('survives a round trip through signing', async () => {
    const path = await put()
    const [signed] = await signWastePhotoUrls([path])
    const [resigned] = await signWastePhotoUrls([toStoragePath(signed)])

    expect(await (await fetch(resigned)).ok).toBe(true)
  })
})
