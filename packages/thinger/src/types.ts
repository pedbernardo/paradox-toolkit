import { Type, type Static } from '@sinclair/typebox'

/**
 * Semantic version of the content.json schema produced by @paradox/thinger.
 *
 * Bump this when the shape of ContentDefinitions changes in a breaking way -
 * i.e. when a consumer reading an older content.json would misinterpret or
 * fail to parse a newer one. This is independent of the package's publish
 * version: you can release a new package version without changing the schema,
 * and you must bump this even on a patch release if the JSON format changes.
 *
 * Consumers should reject files whose schema version they don't recognize.
 */
export const CONTENT_SCHEMA_VERSION = '1.0.0'

const StackOrderSchema = Type.Union([
  Type.Literal('ground'),
  Type.Literal('border'),
  Type.Literal('bottom'),
  Type.Literal('top'),
  Type.Literal('regular')
])
export type StackOrder = Static<typeof StackOrderSchema>

const ThingLayoutSchema = Type.Object({
  width: Type.Number(),
  height: Type.Number(),
  layers: Type.Number(),
  patternX: Type.Number(),
  patternY: Type.Number(),
  patternZ: Type.Number(),
  frames: Type.Number(),
  realSize: Type.Number(),
  exactSize: Type.Number()
})

const ItemGameplaySchema = Type.Object({
  walkable: Type.Boolean(),
  blocksSight: Type.Boolean(),
  blocksMissile: Type.Boolean(),
  blockPathfinder: Type.Boolean(),
  groundSpeed: Type.Number(),
  fullGround: Type.Boolean(),
  container: Type.Boolean(),
  stackable: Type.Boolean(),
  moveable: Type.Boolean(),
  pickupable: Type.Boolean(),
  useable: Type.Boolean(),
  forceUse: Type.Boolean(),
  multiUse: Type.Boolean(),
  readable: Type.Boolean(),
  allowDistRead: Type.Boolean(),
  writable: Type.Union([Type.Object({ length: Type.Number() }), Type.Null()]),
  writableOnce: Type.Union([Type.Object({ length: Type.Number() }), Type.Null()]),
  fluidContainer: Type.Boolean(),
  fluid: Type.Boolean(),
  cannotDecay: Type.Boolean(),
  floorChange: Type.Boolean(),
  floorChangeDown: Type.Boolean(),
  floorChangeNorth: Type.Boolean(),
  floorChangeEast: Type.Boolean(),
  floorChangeSouth: Type.Boolean(),
  floorChangeWest: Type.Boolean(),
  hangable: Type.Boolean(),
  hookEast: Type.Boolean(),
  hookSouth: Type.Boolean(),
  vertical: Type.Boolean(),
  horizontal: Type.Boolean(),
  rotatable: Type.Boolean(),
  rotateTo: Type.Union([Type.Number(), Type.Null()]),
  alwaysOnTop: Type.Boolean(),
  alwaysOnTopOrder: Type.Number(),
  isAnimation: Type.Boolean(),
  clientCharges: Type.Boolean(),
  clientDuration: Type.Boolean(),
  ignoreLook: Type.Boolean(),
  weight: Type.Number(),
  maxItems: Type.Number(),
  maxWriteLength: Type.Number(),
  description: Type.String(),
  minimapColor: Type.Union([Type.Number(), Type.Null()]),
  lensHelp: Type.Union([Type.Number(), Type.Null()])
})

const ItemVisualSchema = Type.Object({
  spriteIds: Type.Array(Type.Number()),
  layout: ThingLayoutSchema,
  light: Type.Union([Type.Object({ level: Type.Number(), color: Type.Number() }), Type.Null()]),
  elevation: Type.Number(),
  stackOrder: StackOrderSchema,
  offset: Type.Union([Type.Object({ x: Type.Number(), y: Type.Number() }), Type.Null()]),
  lyingObject: Type.Boolean(),
  alwaysAnimate: Type.Boolean(),
  dontHide: Type.Boolean(),
  translucent: Type.Boolean(),
  noMoveAnimation: Type.Boolean()
})

export const ItemContentDefSchema = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  gameplay: ItemGameplaySchema,
  visual: ItemVisualSchema
})
export type ItemContentDef = Static<typeof ItemContentDefSchema>

const VisualOnlyVisualSchema = Type.Object({
  spriteIds: Type.Array(Type.Number()),
  layout: ThingLayoutSchema,
  light: Type.Union([Type.Object({ level: Type.Number(), color: Type.Number() }), Type.Null()])
})

export const VisualOnlyDefSchema = Type.Object({
  id: Type.Number(),
  visual: VisualOnlyVisualSchema
})
export type VisualOnlyDef = Static<typeof VisualOnlyDefSchema>

export const ContentMetaSchema = Type.Object({
  schema: Type.String(),
  version: Type.Number(),
  dat: Type.String(),
  otb: Type.String(),
  counts: Type.Object({
    items: Type.Number(),
    creatures: Type.Number(),
    effects: Type.Number(),
    missiles: Type.Number()
  })
})
export type ContentMeta = Static<typeof ContentMetaSchema>

const ContentDefinitionsSchema = Type.Object({
  meta: ContentMetaSchema,
  items: Type.Array(ItemContentDefSchema),
  creatures: Type.Array(VisualOnlyDefSchema),
  effects: Type.Array(VisualOnlyDefSchema),
  missiles: Type.Array(VisualOnlyDefSchema)
})
export type ContentDefinitions = Static<typeof ContentDefinitionsSchema>

// Semantic alias: explicit link between ContentDefinitions and content.json on disk
export const ContentJsonSchema = ContentDefinitionsSchema
export type ContentJson = ContentDefinitions
