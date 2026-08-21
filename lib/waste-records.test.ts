import { describe, expect, it } from 'vitest'
import {
  mapWasteRecords,
  parseImageUrls,
  wasteSubtypeName,
  wasteTypeName,
} from '@/lib/waste-records'

describe('parseImageUrls', () => {
  it('returns an empty array for empty/nullish input', () => {
    expect(parseImageUrls(null)).toEqual([])
    expect(parseImageUrls(undefined)).toEqual([])
    expect(parseImageUrls('')).toEqual([])
    expect(parseImageUrls('   ')).toEqual([])
  })

  it('parses a JSON array string', () => {
    expect(parseImageUrls('["a.jpg","b.jpg"]')).toEqual(['a.jpg', 'b.jpg'])
  })

  it('falls back to the raw string when JSON parsing fails', () => {
    expect(parseImageUrls('[not valid json')).toEqual(['[not valid json'])
  })

  it('splits a comma-separated string and trims each entry', () => {
    expect(parseImageUrls('a.jpg, b.jpg ,c.jpg')).toEqual(['a.jpg', 'b.jpg', 'c.jpg'])
  })

  it('wraps a single URL', () => {
    expect(parseImageUrls('https://example.com/a.jpg')).toEqual(['https://example.com/a.jpg'])
  })

  it('normalizes an array input', () => {
    expect(parseImageUrls([' a.jpg ', '', 'b.jpg'])).toEqual(['a.jpg', 'b.jpg'])
  })
})

describe('mapWasteRecords', () => {
  const rows = [
    ['2026-01-01', 'DW1', 'plastic', 'pet', '2.5', '["a.jpg"]', '1.25', '10', 'approved', 'note'],
    ['2026-01-02', 'DW2', 'paper', 'a4', '1', '', '0.5', '5', 'pending', null],
  ]

  it('keeps only rows belonging to the given user', () => {
    const result = mapWasteRecords(rows, 'DW1')
    expect(result).toHaveLength(1)
    expect(result[0].user_id).toBe('DW1')
  })

  it('coerces numeric fields and parses image urls', () => {
    const [record] = mapWasteRecords(rows, 'DW1')
    expect(record.weight_kg).toBe(2.5)
    expect(record.carbon_reduction).toBe(1.25)
    expect(record.points_earned).toBe(10)
    expect(record.image_urls).toEqual(['a.jpg'])
    expect(record.notes).toBe('note')
  })

  it('falls back to 0 for unparseable numbers', () => {
    const [record] = mapWasteRecords([['t', 'DW1', 'plastic', 'pet', 'abc', '', 'xyz', '', '', null]], 'DW1')
    expect(record.weight_kg).toBe(0)
    expect(record.carbon_reduction).toBe(0)
    expect(record.points_earned).toBe(0)
  })

  it('leaves notes undefined when the column is null', () => {
    const [record] = mapWasteRecords(rows, 'DW2')
    expect(record.notes).toBeUndefined()
  })

  it('handles empty and non-array input safely', () => {
    expect(mapWasteRecords([], 'DW1')).toEqual([])
    expect(mapWasteRecords([null, 'nope', 42], 'DW1')).toEqual([])
  })
})

describe('waste label lookups', () => {
  it('resolves a known waste type to its Thai name', () => {
    expect(wasteTypeName('plastic')).toBe('พลาสติก')
  })

  it('falls back to the raw id for an unknown type', () => {
    expect(wasteTypeName('unknown-type')).toBe('unknown-type')
  })

  it('resolves a known subtype within its type', () => {
    expect(wasteSubtypeName('plastic', 'pet')).toBe('ขวดน้ำพลาสติกใส')
  })

  it('collapses newlines in subtype names to single spaces', () => {
    expect(wasteSubtypeName('paper', 'mixed')).toBe('กระดาษนิตยสาร หนังสือพิมพ์')
  })

  it('falls back to the raw id for unknown type or subtype', () => {
    expect(wasteSubtypeName('plastic', 'nope')).toBe('nope')
    expect(wasteSubtypeName('nope', 'pet')).toBe('pet')
  })
})
