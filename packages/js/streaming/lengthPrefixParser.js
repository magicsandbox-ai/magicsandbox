let _TransformStream = TransformStream;
let _TextDecoder = TextDecoder;
(async () => {
  if (typeof window === 'undefined') {
    ({ _TransformStream } = await import('node:stream/web'));
    ({ _TextDecoder } = await import('node:util'));
  }
})();
//eslint-disable-next-line no-global-assign
TransformStream = _TransformStream;
//eslint-disable-next-line no-global-assign
TextDecoder = _TextDecoder;

/**
 * Returns a TransformStream that parses an object stream and calls
 * handler({ controller, state, readRemaining, chunk }) with the parsed chunks.
 *
 * The object stream format is:
 *
 * [length][object][length][object][0xFFFFFFFF][finalObject]
 *
 * handler is called:
 *
 * - When a length is read: state is 'length', readRemaining is the length of the next object
 * - When an object chunk is read: state is 'object', readRemaining is the object length remaining
 * - When an object is fully read: state is 'object', readRemaining is 0
 * - When a final object chunk is read: state is 'finalObject', readRemaining is 0xFFFFFFFF
 * - When the final object is fully read: state is 'finalObject', readRemaining is 0, chunk is not provided
 */

// Commented out for now: When the stream is complete: state is 'complete', readRemaining and chunk are not provided

function createLengthPrefixParser(handler) {
  return new TransformStream({
    start() {
      this.__handler = handler;
      this.__state = 'length';
      this.__readRemaining = 4;
      this.__buffer = new Uint8Array(0);
    },
    transform(chunk, controller) {
      try {
        let offset = 0;
        while (offset < chunk.length) {
          const readLength = Math.min(
            this.__readRemaining,
            chunk.length - offset
          );
          if (this.__state === 'length') {
            this.__buffer = concatUint8Array(
              this.__buffer,
              chunk.subarray(offset, offset + readLength)
            );
            offset += readLength;
            this.__readRemaining -= readLength;
            if (this.__buffer.length === 4) {
              this.__readRemaining = readUInt32BE(this.__buffer);
              this.__handler({
                controller,
                state: this.__state,
                readRemaining: this.__readRemaining,
                chunk: this.__buffer,
              });
              if (this.__readRemaining === 0xffffffff) {
                this.__state = 'finalObject';
              } else {
                this.__state = 'object';
              }
              this.__buffer = new Uint8Array(0);
            }
          } else if (this.__state === 'object') {
            this.__readRemaining -= readLength;
            this.__handler({
              controller,
              state: this.__state,
              readRemaining: this.__readRemaining,
              chunk: chunk.subarray(offset, offset + readLength),
            });
            offset += readLength;
            if (this.__readRemaining === 0) {
              this.__state = 'length';
              this.__readRemaining = 4;
            }
          } else if (this.__state === 'finalObject') {
            this.__handler({
              controller,
              state: this.__state,
              readRemaining: this.__readRemaining,
              chunk: chunk.subarray(offset),
            });
            offset = chunk.length;
          }
        }
      } catch (error) {
        controller.error(error.message);
      }
    },
    flush(controller) {
      try {
        if (this.__state !== 'finalObject' && this.__readRemaining > 0) {
          controller.error('Unexpected end of stream');
          return;
        }
        if (this.__state === 'finalObject') {
          this.__handler({
            controller,
            state: this.__state,
            readRemaining: 0,
          });
        }
        // this.__handler({
        //   controller,
        //   state: 'complete',
        // });
      } catch (error) {
        controller.error(error.message);
      }
    },
  });
}

function concatUint8Array(arr1, arr2) {
  if (arr2 === undefined) {
    return arr1;
  }
  const output = new Uint8Array(arr1.length + arr2.length);
  output.set(arr1);
  output.set(arr2, arr1.length);
  return output;
}

function readUInt32BE(arr) {
  return new DataView(arr.buffer).getUint32(0, false);
}

export { createLengthPrefixParser, concatUint8Array };
