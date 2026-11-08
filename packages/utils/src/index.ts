export {
  createBinaryReader,
  type BinaryReader,
  createEscapedBinaryReader,
  type EscapedBinaryReader,
  createEscapedSliceReader,
  type EscapedSliceReader
} from './binary-reader.js'
export { createBinaryWriter, type BinaryWriter } from './binary-writer.js'
export {
  BinaryReaderError,
  BufferOverflowError,
  ByteNotFoundError,
  UnencodableTextError,
  UnsupportedVersionError,
  ParseError
} from './errors.js'
export { snakeCaseToCamelCase } from './string.js'
export {
  SUPPORTED_VERSIONS,
  type VersionFeatures,
  isVersionSupported,
  getVersionFeatures
} from './version-features.js'
export { createOutputBuffer } from './output-buffer.js'
export { TEXT_CODECS, utf8, windows1250, windows1251, windows1252 } from './text-codec.js'
export type {
  EscapedReaderOptions,
  OutputBuffer,
  OutputBufferOptions,
  TextCodec,
  TextCodecName,
  TextCodecSuggestion,
  TextOptions
} from './types.js'
export { detectTextCodec } from './detect-text.js'
