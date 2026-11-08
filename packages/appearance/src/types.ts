/** Sprite grid of a thing type, as read from the DAT (`layers` defaults to 1 for pre-composed items). */
export type SpriteLayout = {
  readonly width: number
  readonly height: number
  readonly layers?: number
  readonly patternX: number
  readonly patternY: number
  readonly patternZ: number
  readonly frames: number
}

export type SpriteCoordinates = {
  readonly frame: number
  readonly patternX: number
  readonly patternY: number
  readonly patternZ: number
  readonly layer?: number
  /** Part column within a multi-tile thing; 0 is the anchor (rightmost) column. */
  readonly w: number
  /** Part row within a multi-tile thing; 0 is the anchor (bottom) row. */
  readonly h: number
}

export type Patterns = {
  readonly patternX: number
  readonly patternY: number
  readonly patternZ: number
}

export type Hook = 'south' | 'east' | null
