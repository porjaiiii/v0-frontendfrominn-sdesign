import { describe, expect, it } from 'vitest'

import { displaySrc } from './api-client'

// `image_urls` stores storage PATHS, because a signed URL expires. A path is not
// renderable: <Image src="waste/U…/2026-08/x.jpg"> makes the browser request it
// relative to our own origin, which 404s for an image that is stored perfectly
// well. This is the seam between what we save and what we show.

describe('displaySrc', () => {
  it('passes through anything already renderable', () => {
    const cases = [
      'https://drive.google.com/thumbnail?id=abc&sz=w1000',
      'http://127.0.0.1:54321/storage/v1/object/sign/waste-photos/waste/U1/2026-08/x.jpg?token=y',
      'blob:http://localhost:3000/8cba1c0b-a1f3',
      'data:image/jpeg;base64,/9j/4AAQ',
    ]
    for (const value of cases) {
      expect(displaySrc(value)).toBe(value)
    }
  })

  it('never returns a bare storage path, which is what produced the 404', () => {
    const path = 'waste/U1/2026-08/8cba1c0b-a1f3-41f1-aa50-7581c8cddc28.jpg'
    const result = displaySrc(path)

    expect(result).not.toBe(path)
    expect(result).toBe('/placeholder.jpg')
  })
})
