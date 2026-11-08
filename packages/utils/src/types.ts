/**
 * One growing output buffer for a whole file. Raw writes go as is; `esc*` writes prefix the bytes
 * 0xfd, 0xfe and 0xff with the 0xfd escape marker (the OTB/OTBM node format). The writer hands out
 * what it has written with `take()` and keeps its capacity, so a file is produced in chunks without
 * allocating per node.
 */
export type OutputBuffer = {
  /** Bytes written since the last `take()`. */
  readonly length: number
  u8(value: number): void
  u16(value: number): void
  u32(value: number): void
  bytes(value: Uint8Array): void
  escU8(value: number): void
  escU16(value: number): void
  escU32(value: number): void
  /** Little-endian 64-bit integer from a JS number (exact up to 2^53). */
  escU64(value: number): void
  escBytes(value: Uint8Array): void
  /** A position to `truncate` back to, e.g. before a group that may be dropped. */
  mark(): number
  /** Drops everything written after `mark`. */
  truncate(mark: number): void
  /** The bytes written since the last `take()`, as a copy; the buffer restarts empty. */
  take(): Uint8Array
}

export type OutputBufferOptions = {
  /** Initial capacity in bytes (default 1 MiB). The buffer doubles when it fills. */
  initialBytes?: number
}
