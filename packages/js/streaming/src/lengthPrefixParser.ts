import { concatUint8Array } from "./utils.js";

/**
 * Returns a TransformStream that transforms a length prefixed ReadableStream of Uint8Arrays
 *
 * The length prefix format is:
 *
 * [length][object][length][object][0xFFFFFFFF][finalObject]
 *
 * The transform stream emits objects { state, readRemaining, chunk }, where chunk is the Uint8Array that has been read
 * and state and readRemaining describe the state of the stream:
 *
 * - When a length is read: state is 'length', readRemaining is the length of the next object
 * - When an object chunk is read: state is 'object', readRemaining is the object length remaining
 * - When an object is fully read: state is 'object', readRemaining is 0
 * - When a final object chunk is read: state is 'finalObject', readRemaining is 0xFFFFFFFF
 * - When the final object is fully read: state is 'finalObject', readRemaining is 0
 */

// Add these interfaces at the top of the file
interface LengthPrefixState {
  __state: "length" | "object" | "finalObject";
  __readRemaining: number;
  __buffer: Uint8Array;
}

function createLengthPrefixParser() {
  return new TransformStream<
    Uint8Array,
    { state: string; readRemaining: number; chunk: Uint8Array }
  >({
    start(this: LengthPrefixState) {
      this.__state = "length";
      this.__readRemaining = 4;
      this.__buffer = new Uint8Array(0);
    },
    transform(this: LengthPrefixState, chunk, controller) {
      try {
        let offset = 0;
        while (offset < chunk.length) {
          const readLength = Math.min(
            this.__readRemaining,
            chunk.length - offset,
          );
          if (this.__state === "length") {
            this.__buffer = concatUint8Array(
              this.__buffer,
              chunk.subarray(offset, offset + readLength),
            );
            offset += readLength;
            this.__readRemaining -= readLength;
            if (this.__buffer.length === 4) {
              this.__readRemaining = readUInt32BE(this.__buffer);
              controller.enqueue({
                state: this.__state,
                readRemaining: this.__readRemaining,
                chunk: this.__buffer,
              });
              if (this.__readRemaining === 0xffffffff) {
                this.__state = "finalObject";
              } else {
                this.__state = "object";
              }
              this.__buffer = new Uint8Array(0);
            }
          } else if (this.__state === "object") {
            this.__readRemaining -= readLength;
            controller.enqueue({
              state: this.__state,
              readRemaining: this.__readRemaining,
              chunk: chunk.subarray(offset, offset + readLength),
            });
            offset += readLength;
            if (this.__readRemaining === 0) {
              this.__state = "length";
              this.__readRemaining = 4;
            }
          } else if (this.__state === "finalObject") {
            controller.enqueue({
              state: this.__state,
              readRemaining: this.__readRemaining,
              chunk: chunk.subarray(offset),
            });
            offset = chunk.length;
          }
        }
      } catch (error) {
        if (error instanceof Error) {
          controller.error(error.message);
        } else {
          controller.error("Unknown error");
        }
      }
    },
    flush(this: LengthPrefixState, controller) {
      try {
        if (
          !(
            this.__state === "finalObject" ||
            (this.__state === "length" && this.__readRemaining === 4)
          )
        ) {
          controller.error("Unexpected end of stream");
          return;
        }

        if (this.__state === "finalObject") {
          controller.enqueue({
            state: this.__state,
            readRemaining: 0,
            chunk: new Uint8Array(0),
          });
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

function readUInt32BE(arr: Uint8Array) {
  return new DataView(arr.buffer).getUint32(0, false);
}

export { createLengthPrefixParser };
