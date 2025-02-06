import { concatUint8Array } from "./utils.js";

function createLengthPrefixTransform({ finalObject } = {}) {
  let prevChunk = null;
  return new TransformStream({
    transform(chunk, controller) {
      try {
        if (prevChunk !== null) {
          //prefix each chunk with its length
          const length = lengthPrefix(prevChunk);
          controller.enqueue(concatUint8Array(length, prevChunk));
        }
        prevChunk = chunk;
      } catch (error) {
        controller.error(error.message);
      }
    },
    flush(controller) {
      try {
        if (prevChunk !== null) {
          let length;
          if (finalObject) {
            //special marker for final object
            length = new Uint8Array([255, 255, 255, 255]);
          } else {
            length = lengthPrefix(prevChunk);
          }
          controller.enqueue(concatUint8Array(length, prevChunk));
        }
      } catch (error) {
        controller.error(error.message);
      }
    },
  });
}

function lengthPrefix(chunk) {
  const arr = new Uint8Array(4);
  const view = new DataView(arr.buffer);
  view.setUint32(0, chunk.length, false);
  return arr;
}

export { createLengthPrefixTransform, lengthPrefix };
