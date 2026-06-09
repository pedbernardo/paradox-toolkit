import { Type, type Static } from '@sinclair/typebox'

/**
 * Semantic version of the positions.json schema produced by @paradoxlab/spriter.
 *
 * Bump this when the shape of SpritesheetJson changes in a breaking way -
 * i.e. when a consumer reading an older positions.json would misinterpret or
 * fail to parse a newer one. This is independent of the package's publish
 * version: you can release a new package version without changing the schema,
 * and you must bump this even on a patch release if the JSON format changes.
 *
 * Consumers should reject files whose schema version they don't recognize.
 */
export const SPRITESHEET_SCHEMA_VERSION = '1.0.0'

export type SpritesheetMeta = {
  schema: string
  version: number
  spr: string
  width: number
  height: number
  sprites: number
}

export type SpritesheetOutput = {
  meta: SpritesheetMeta
  png: Buffer
  positions: Map<number, { x: number; y: number }>
}

const SpritesheetMetaSchema = Type.Object({
  schema: Type.String(),
  version: Type.Number(),
  spr: Type.String(),
  width: Type.Number(),
  height: Type.Number(),
  sprites: Type.Number()
})

export const SpritesheetJsonSchema = Type.Object({
  meta: SpritesheetMetaSchema,
  positions: Type.Record(Type.String(), Type.Object({ x: Type.Number(), y: Type.Number() }))
})

export type SpritesheetJson = Static<typeof SpritesheetJsonSchema>
