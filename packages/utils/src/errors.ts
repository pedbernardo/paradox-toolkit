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

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}
