import { describe, expect, it } from 'vitest'
import { getDatFlags } from './dat-flags.js'
import { ParseError } from '@paradoxlab/utils'

describe('getDatFlags', () => {
  it('returns a flag map for every supported version group', () => {
    for (const version of [710, 740, 750, 755, 760, 770, 772, 860, 870, 960, 980, 1098]) {
      expect(() => getDatFlags(version)).not.toThrow()
    }
  })

  it('throws ParseError for a version with no flag map', () => {
    expect(() => getDatFlags(999)).toThrow(ParseError)
  })

  describe('version 710', () => {
    it('has GROUND at 0', () => expect(getDatFlags(710)['GROUND']).toBe(0))
    it('does not have GROUND_BORDER', () =>
      expect(getDatFlags(710)['GROUND_BORDER']).toBeUndefined())
    it('does not have BLOCK_PATHFINDER', () =>
      expect(getDatFlags(710)['BLOCK_PATHFINDER']).toBeUndefined())
  })

  describe('version 772', () => {
    it('has GROUND_BORDER at 1', () => expect(getDatFlags(772)['GROUND_BORDER']).toBe(1))
    it('has STACKABLE at 5 (shifted from 710)', () => expect(getDatFlags(772)['STACKABLE']).toBe(5))
    it('has LIGHT_INFO at 21', () => expect(getDatFlags(772)['LIGHT_INFO']).toBe(21))
    it('has FULL_GROUND at 30', () => expect(getDatFlags(772)['FULL_GROUND']).toBe(30))
  })

  describe('version 860', () => {
    it('has TRANSLUCENT at 23 (replaces FLOOR_CHANGE)', () =>
      expect(getDatFlags(860)['TRANSLUCENT']).toBe(23))
    it('has FLOOR_CHANGE repositioned to 252', () =>
      expect(getDatFlags(860)['FLOOR_CHANGE']).toBe(252))
    it('has CLOTH at 32', () => expect(getDatFlags(860)['CLOTH']).toBe(32))
  })

  describe('version 1098', () => {
    it('has NO_MOVE_ANIMATION at 16', () => expect(getDatFlags(1098)['NO_MOVE_ANIMATION']).toBe(16))
    it('has PICKUPABLE at 17 (shifted to make room for NO_MOVE_ANIMATION at 16)', () => {
      expect(getDatFlags(1098)['PICKUPABLE']).toBe(17)
    })
  })
})
