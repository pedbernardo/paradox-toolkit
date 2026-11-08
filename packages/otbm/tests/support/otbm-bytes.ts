/** Builders of synthetic OTBM bytes for tests: nodes, escaped properties, headers. */
const START = 0xfe
const END = 0xff
const ESCAPE = 0xfd

export const u16 = (value: number): number[] => [value & 0xff, (value >> 8) & 0xff]
export const u32 = (value: number): number[] => [
  value & 0xff,
  (value >> 8) & 0xff,
  (value >> 16) & 0xff,
  (value >>> 24) & 0xff
]
/** A u16-length string, one byte per char (callers pass windows-1252 text or raw bytes). */
export const str = (text: string | number[]): number[] => {
  const bytes = typeof text === 'string' ? [...text].map((c) => c.charCodeAt(0)) : text
  return [...u16(bytes.length), ...bytes]
}

export type RawNode = { type: number; props: number[]; children: RawNode[] }

export const node = (type: number, props: number[] = [], ...children: RawNode[]): RawNode => ({
  type,
  props,
  children
})

const escape = (bytes: number[]): number[] =>
  bytes.flatMap((b) => (b === START || b === END || b === ESCAPE ? [ESCAPE, b] : [b]))

export const encodeNode = (raw: RawNode): number[] => [
  START,
  raw.type,
  ...escape(raw.props),
  ...raw.children.flatMap(encodeNode),
  END
]

export const headerProps = (version = 2, width = 1000, height = 1000, major = 3, minor = 57) => [
  ...u32(version),
  ...u16(width),
  ...u16(height),
  ...u32(major),
  ...u32(minor)
]

export function otbmBytes(root: RawNode, trailing: number[] = []): Uint8Array {
  return Uint8Array.from([0, 0, 0, 0, ...encodeNode(root), ...trailing])
}

/** A map with a root, map data and the given map data children. */
export function mapBytes(
  children: RawNode[],
  version = 2,
  mapDataProps: number[] = []
): Uint8Array {
  return otbmBytes(node(0, headerProps(version), node(2, mapDataProps, ...children)))
}
