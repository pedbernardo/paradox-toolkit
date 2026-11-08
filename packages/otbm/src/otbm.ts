import { ParseError, createOutputBuffer, windows1252 } from '@paradoxlab/utils'
import { checkFileSize, resolveLimits } from './otbm-config.js'
import { collectDocument } from './otbm-document.js'
import { OtbmEncodeError, createOtbmEncoder } from './otbm-writer.js'
import { readOtbm, readOtbmSteps } from './otbm-stream.js'
import type {
  OtbmDocument,
  OtbmOptions,
  OtbmReadOptions,
  OtbmSource,
  OtbmVisitor,
  OtbmWriteStreamOptions
} from './types.js'

const DEFAULT_CHUNK_BYTES = 1 << 20

type Otbm = {
  /** Checks the node start and the size ceiling without reading the map. */
  validate(bytes: Uint8Array): void
  /** One visitor, or several called in order for each event (e.g. a model and its layout). */
  read(
    bytes: Uint8Array,
    visitor: OtbmVisitor | readonly OtbmVisitor[],
    readOptions?: OtbmReadOptions
  ): void
  /** The whole map as objects; the document is also an event source, so it can be written back. */
  load(bytes: Uint8Array, readOptions?: OtbmReadOptions): OtbmDocument
  /** The file as an event source, pausing after each tile area. */
  source(bytes: Uint8Array): OtbmSource
  write(source: OtbmSource): Uint8Array
  writeStream(source: OtbmSource, writeOptions?: OtbmWriteStreamOptions): Generator<Uint8Array>
}

export function Otbm(options: OtbmOptions = {}): Otbm {
  const text = options.text ?? windows1252
  const limits = resolveLimits(options.limits)

  return { validate, read, load, source, write, writeStream }

  function validate(bytes: Uint8Array): void {
    if (bytes.length < 6 || bytes[4] !== 0xfe) {
      throw new ParseError('Not an OTBM file: expected a node start at offset 4')
    }
    checkFileSize(bytes.length, limits)
  }

  function read(
    bytes: Uint8Array,
    visitor: OtbmVisitor | readonly OtbmVisitor[],
    readOptions: OtbmReadOptions = {}
  ): void {
    const single = Array.isArray(visitor) ? combine(visitor) : (visitor as OtbmVisitor)
    readOtbm(bytes, single, options, readOptions)
  }

  function load(bytes: Uint8Array, readOptions: OtbmReadOptions = {}): OtbmDocument {
    const collector = collectDocument()
    readOtbm(bytes, collector.visitor, options, readOptions)
    return collector.document()
  }

  function source(bytes: Uint8Array): OtbmSource {
    return { emit: (visitor) => readOtbmSteps(bytes, visitor, options) }
  }

  function write(input: OtbmSource): Uint8Array {
    const chunks = [...writeStream(input, { chunkBytes: Number.POSITIVE_INFINITY })]
    if (chunks.length === 1) return chunks[0]!
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const out = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      out.set(chunk, offset)
      offset += chunk.length
    }
    return out
  }

  function* writeStream(
    input: OtbmSource,
    writeOptions: OtbmWriteStreamOptions = {}
  ): Generator<Uint8Array> {
    const chunkBytes = writeOptions.chunkBytes ?? DEFAULT_CHUNK_BYTES
    const maxBytes = writeOptions.maxBytes ?? limits.fileBytes
    const initialBytes = Number.isFinite(chunkBytes) ? chunkBytes * 2 : DEFAULT_CHUNK_BYTES
    const output = createOutputBuffer({ initialBytes, text })
    const encoder = createOtbmEncoder(output, options)
    let written = 0

    const checkSize = (): void => {
      if (written + output.length > maxBytes) {
        throw new OtbmEncodeError(`OTBM output passed the ${maxBytes}-byte limit`)
      }
    }

    const steps = input.emit(encoder)[Symbol.iterator]()
    while (steps.next().done !== true) {
      checkSize()
      if (output.length >= chunkBytes) {
        written += output.length
        yield output.take()
      }
    }
    checkSize()
    if (!encoder.finished) throw new OtbmEncodeError('The event source ended before `end`')
    if (output.length > 0) yield output.take()
  }
}

/** One visitor that calls each of `visitors` in order, for the events they implement. */
function combine(visitors: readonly OtbmVisitor[]): OtbmVisitor {
  if (visitors.length === 1) return visitors[0]!
  const names = new Set(visitors.flatMap((visitor) => Object.keys(visitor))) as Set<
    keyof OtbmVisitor
  >
  const combined: Record<string, (...args: never[]) => void> = {}
  for (const name of names) {
    const targets = visitors.filter((visitor) => visitor[name] !== undefined)
    combined[name] = (...args: never[]) => {
      for (const target of targets) (target[name] as (...a: never[]) => void).apply(target, args)
    }
  }
  return combined as OtbmVisitor
}
