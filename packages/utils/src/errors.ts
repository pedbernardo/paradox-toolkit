export class BinaryReaderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BinaryReaderError'
  }
}

export class BufferOverflowError extends BinaryReaderError {
  constructor(message: string) {
    super(message)
    this.name = 'BufferOverflowError'
  }
}

export class ByteNotFoundError extends BinaryReaderError {
  constructor(message: string) {
    super(message)
    this.name = 'ByteNotFoundError'
  }
}

export class UnsupportedVersionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsupportedVersionError'
  }
}

export class UnencodableTextError extends Error {
  readonly codec: string
  readonly text: string
  /** UTF-16 index of the first character that cannot be encoded. */
  readonly index: number

  constructor(codec: string, text: string, index: number) {
    const char = String.fromCodePoint(text.codePointAt(index) ?? 0)
    super(`"${char}" at index ${index} cannot be encoded as ${codec}`)
    this.name = 'UnencodableTextError'
    this.codec = codec
    this.text = text
    this.index = index
  }
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}
