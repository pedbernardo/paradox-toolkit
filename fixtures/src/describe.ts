import { describe } from 'vitest'
import { createFixtures } from './resolve.js'
import type { Fixtures, ResolvedMap } from './resolve.js'

let shared: Fixtures | undefined

/** Lazily created resolvers over the repository's `fixtures/`. */
export function fixtures(): Fixtures {
  shared ??= createFixtures()
  return shared
}

/**
 * Declares a suite that needs a map fixture. When the fixture is not on disk (local fixtures in a
 * clean clone or in CI), the suite is skipped and its name says which fixture is missing.
 */
export function describeWithFixture(
  id: string,
  body: (fixture: ResolvedMap) => void,
  from: Fixtures = fixtures()
): void {
  const fixture = from.mapFixture(id)
  if (fixture === undefined) {
    describe.skip(`${id} (fixture not present)`, () => {})
    return
  }
  describe(id, () => {
    body(fixture)
  })
}
