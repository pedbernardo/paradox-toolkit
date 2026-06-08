export type Sprite = {
  id: number
  rgba: Uint8Array
  width: 32
  height: 32
}

export type SprWriteInput =
  | { readonly count: number; get(id: number): Sprite | undefined }
  | Iterable<Sprite | null>

export type SprWriteOpts = {
  onProgress?: (pct: number) => void
}
