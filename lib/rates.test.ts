import { describe, expect, it } from 'vitest'

import { carbonFactorFor, pointsPerKgFor, type WasteRate } from './rates'

// This module used to carry its own copy of app.waste_types and fall back to it
// whenever the live rates were missing — so a rate changed in the database and
// forgotten here showed the user one estimate and awarded them another. There is
// no copy any more: the rates are an argument, and "not loaded yet" is null,
// which the screens render as "—" rather than as a number that might be wrong.

const rates: Record<string, WasteRate> = {
  plastic: { carbonFactor: 1.031, pointsPerKg: 6 },
}

describe('carbonFactorFor / pointsPerKgFor', () => {
  it('reads the rate out of the table it is given', () => {
    expect(carbonFactorFor('plastic', rates)).toBe(1.031)
    expect(pointsPerKgFor('plastic', rates)).toBe(6)
  })

  it('reports an unknown waste type as null rather than guessing', () => {
    expect(carbonFactorFor('unobtainium', rates)).toBeNull()
    expect(pointsPerKgFor('unobtainium', rates)).toBeNull()
  })

  it('reports null when the rates have not loaded yet', () => {
    expect(carbonFactorFor('plastic', null)).toBeNull()
    expect(pointsPerKgFor('plastic', null)).toBeNull()
  })

  it('reports null for a rate that is present but unusable', () => {
    // A malformed row reaching the client is not a reason to invent 1.0.
    const broken = { plastic: { carbonFactor: NaN, pointsPerKg: NaN } }

    expect(carbonFactorFor('plastic', broken)).toBeNull()
    expect(pointsPerKgFor('plastic', broken)).toBeNull()
  })
})
