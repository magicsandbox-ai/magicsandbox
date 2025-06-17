import { concatUint8Array } from "./utils.js";

function createLengthPrefixTransform({
  finalObject,
}: { finalObject?: boolean } = {}) {
  let prevChunk: Uint8Array | null = null;
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      try {
        if (prevChunk !== null) {
          //prefix each chunk with its length
          const length = lengthPrefix(prevChunk);
          controller.enqueue(concatUint8Array(length, prevChunk));
        }
        prevChunk = chunk;
      } catch (error) {
        if (error instanceof Error) {
          controller.error(error.message);
        } else {
          controller.error("Unknown error");
        }
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
        if (error instanceof Error) {
          controller.error(error.message);
        } else {
          controller.error("Unknown error");
        }
      }
    },
  });
}

function lengthPrefix(chunk: Uint8Array | string) {
  const arr = new Uint8Array(4);
  const view = new DataView(arr.buffer);
  view.setUint32(0, chunk.length, false);
  return arr;
}

export { createLengthPrefixTransform, lengthPrefix };
