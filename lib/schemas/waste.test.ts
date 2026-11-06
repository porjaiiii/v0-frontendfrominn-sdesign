import { describe, expect, it } from 'vitest'

import {
  adminUpdateWasteSchema,
  cancelWasteSchema,
  submitWasteSchema,
  updateWasteSchema,
} from '@/lib/schemas/waste'

// These cover the 400 reported from production:
//
//   insert or update on table "waste_records" violates foreign key constraint
//   "waste_records_subtype_fk"
//
// The edit modal's subtype <select> carried `sub.name` in its option values, so
// changing either the type or the subtype sent a Thai label where
// waste_records.waste_subtype_id expects a catalog id. The modal is fixed, but
// the LINE webview caches a bundle we do not control the lifetime of, so the
// schema normalises labels back to ids on the way in.

describe('updateWasteSchema — Thai label normalisation', () => {
  const base = { timestamp: '2026-09-18T03:00:00.000Z', weight_kg: 2 }

  it('maps a Thai type and subtype label to catalog ids', () => {
    const parsed = updateWasteSchema.parse({
      ...base,
      waste_type: 'พลาสติก',
      waste_subtype: 'ขวดน้ำพลาสติกใส',
    })

    expect(parsed.waste_type).toBe('plastic')
    expect(parsed.waste_subtype).toBe('pet')
  })

  it('resolves the subtype against the type in the same payload', () => {
    // The bug's exact shape: handleTypeChange switched the type and set the
    // subtype to the new type's first *name*.
    const parsed = updateWasteSchema.parse({
      ...base,
      waste_type: 'paper',
      waste_subtype: 'กระดาษลัง',
    })

    expect(parsed.waste_type).toBe('paper')
    expect(parsed.waste_subtype).toBe('cardboard')
  })

  it('leaves ids alone', () => {
    const parsed = updateWasteSchema.parse({
      ...base,
      waste_type: 'aluminum',
      waste_subtype: 'scrap',
    })

    expect(parsed.waste_type).toBe('aluminum')
    expect(parsed.waste_subtype).toBe('scrap')
  })

  // A record whose subtype was never set round-trips as ''. min(1) rejected
  // that outright, so such a record could not be saved at all.
  it('treats an empty subtype as absent rather than invalid', () => {
    const parsed = updateWasteSchema.parse({ ...base, waste_type: 'glass', waste_subtype: '' })

    expect(parsed.waste_subtype).toBeUndefined()
    expect(parsed.waste_type).toBe('glass')
  })

  it('treats an empty type as absent', () => {
    const parsed = updateWasteSchema.parse({ ...base, waste_type: '' })

    expect(parsed.waste_type).toBeUndefined()
  })

  it('still accepts a payload that names neither', () => {
    const parsed = updateWasteSchema.parse(base)

    expect(parsed.waste_type).toBeUndefined()
    expect(parsed.waste_subtype).toBeUndefined()
  })
})

describe('submitWasteSchema — Thai label normalisation', () => {
  it('maps labels to ids', () => {
    const parsed = submitWasteSchema.parse({
      waste_type: 'แก้ว',
      waste_subtype: 'ขวดแก้วรวม',
      weight_kg: 1.5,
    })

    expect(parsed.waste_type).toBe('glass')
    expect(parsed.waste_subtype).toBe('colored')
  })

  // Submitting without a subtype is still a client bug — unlike an update,
  // there is no stored value to fall back on.
  it('still requires a subtype', () => {
    expect(() =>
      submitWasteSchema.parse({ waste_type: 'glass', waste_subtype: '', weight_kg: 1 }),
    ).toThrow()
  })
})

describe('cancelWasteSchema', () => {
  it('needs only the record timestamp', () => {
    const parsed = cancelWasteSchema.parse({ timestamp: '2026-09-18T01:39:50.000Z' })

    expect(parsed.timestamp).toBe('2026-09-18T01:39:50.000Z')
  })

  it('rejects a payload with no timestamp to identify the record', () => {
    expect(() => cancelWasteSchema.parse({})).toThrow()
    expect(() => cancelWasteSchema.parse({ timestamp: '' })).toThrow()
  })

  it('ignores a user_id, so nobody can cancel on behalf of someone else', () => {
    // The owner comes from the verified LINE token, never from the body.
    const parsed = cancelWasteSchema.parse({
      timestamp: '2026-09-18T01:39:50.000Z',
      user_id: 'U_somebody_else',
    })

    expect(parsed).not.toHaveProperty('user_id')
  })
})

describe('adminUpdateWasteSchema', () => {
  const base = { timestamp: '2026-09-22T03:00:00.000Z', weight_kg: 2 }

  it('keeps the owner, which the staff route cannot take from a token', () => {
    const parsed = adminUpdateWasteSchema.parse({ ...base, user_id: 'Uowner' })

    expect(parsed.user_id).toBe('Uowner')
  })

  it('rejects a payload that does not name the owner', () => {
    expect(() => adminUpdateWasteSchema.parse(base)).toThrow()
    expect(() => adminUpdateWasteSchema.parse({ ...base, user_id: '' })).toThrow()
  })

  it('normalises Thai labels the same way the owner schema does', () => {
    const parsed = adminUpdateWasteSchema.parse({
      ...base,
      user_id: 'Uowner',
      waste_type: 'พลาสติก',
      waste_subtype: 'ขวดน้ำพลาสติกใส',
    })

    expect(parsed.waste_type).toBe('plastic')
    expect(parsed.waste_subtype).toBe('pet')
  })

  it('leaves the owner schema unchanged: it still strips user_id', () => {
    const parsed = updateWasteSchema.parse({ ...base, user_id: 'U_somebody_else' })

    expect(parsed).not.toHaveProperty('user_id')
  })
})
