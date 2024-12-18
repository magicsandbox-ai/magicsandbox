import { Transform } from 'stream';

class LengthPrefixTransform extends Transform {
  constructor(options) {
    const { finalObject, ...rest } = options;
    super(rest);
    this.__finalObject = finalObject;
    this.__prevChunk = null;
  }
  _transform(chunk, _, callback) {
    if (this.__prevChunk !== null) {
      //prefix each chunk with its length
      const lengthBuffer = lengthPrefix(this.__prevChunk);
      this.push(Buffer.concat([lengthBuffer, this.__prevChunk]));
    }
    this.__prevChunk = chunk;
    callback();
  }
  _flush(callback) {
    if (this.__prevChunk !== null) {
      let lengthBuffer;
      if (this.__finalObject) {
        //special marker for final object
        lengthBuffer = Buffer.from([255, 255, 255, 255]);
      } else {
        lengthBuffer = lengthPrefix(this.__prevChunk);
      }
      this.push(Buffer.concat([lengthBuffer, this.__prevChunk]));
    }
    callback();
  }
}

function lengthPrefix(chunk) {
  return Buffer.alloc(4).writeUInt32BE(chunk.length);
}

export { LengthPrefixTransform, lengthPrefix };
