import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { Otbm } from './otbm.js'
import { mapSpec, specSource } from '../tests/support/otbm-arbitraries.js'
import { compareOtbm } from './otbm-compare.js'
import { readOtbm } from './otbm-stream.js'
import { drain, recorder } from '../tests/support/otbm-recorder.js'
import { upgradeOtbm } from './otbm-upgrade.js'

const otbm = Otbm()

describe('roundtrip properties', () => {
  it('reading what the encoder wrote gives back the same events', () => {
    fc.assert(
      fc.property(mapSpec, (spec) => {
        const expected = recorder()
        drain(specSource(spec), expected.visitor)
        const actual = recorder()
        readOtbm(otbm.write(specSource(spec)), actual.visitor)
        expect(actual.events).toEqual(expected.events)
      }),
      { numRuns: 300 }
    )
  })

  it('writing what the reader read gives back the same bytes', () => {
    fc.assert(
      fc.property(mapSpec, (spec) => {
        const bytes = otbm.write(specSource(spec))
        expect(otbm.write(otbm.source(bytes))).toEqual(bytes)
        expect(otbm.write(otbm.load(bytes))).toEqual(bytes)
      }),
      { numRuns: 300 }
    )
  })

  it('upgrading never changes what the map means, only its version', () => {
    fc.assert(
      fc.property(mapSpec, (spec) => {
        const bytes = otbm.write(specSource(spec))
        const upgraded = otbm.write(upgradeOtbm(otbm.source(bytes), 3))
        const differences = compareOtbm(otbm.load(bytes), otbm.load(upgraded))
        expect(differences.filter((d) => d.path !== 'header version')).toEqual([])
      }),
      { numRuns: 200 }
    )
  })
})
