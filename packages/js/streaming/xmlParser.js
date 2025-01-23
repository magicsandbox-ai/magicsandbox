// note the \ in the example below is to escape < for jsdoc
/**
 * Parses the top level tags of a stream that optionally contains XML tags
 *
 * Arguments: an object with keys:
 * - stream (AsyncIterable<any>): The stream to parse
 * - chunkProcessor (function(any) => string) (default (chunk) => chunk): A function that returns the XML string from a chunk of the stream
 * - maxTagLength (number) (default 100): The maximum expected length of an XML tag
 *
 * Returns:
 * - AsyncGenerator<{content: string, tag?: string}>
 *   - content: A string of content from the XML stream
 *   - tag: The name of the top level tag enclosing the content, if any
 *
 * Example: "hello world\<example>test\</example>goodbye"
 *
 * Yields the following. Note that content can be arbitrarily split across chunks:
 * - {content: 'hello '}
 * - {content: 'world'}
 * - {content: 'test', tag: 'example'}
 * - {content: 'goodbye'}
 *
 * Usage: for await (const {content, tag} of xmlParser({stream: ...})) {
 */
async function* xmlParser({
  stream,
  chunkProcessor = (chunk) => chunk,
  maxTagLength = 100,
}) {
  let buffer = "";
  let tag;
  for await (const chunk of stream) {
    const str = chunkProcessor(chunk);
    if (str) {
      let results;
      ({ buffer, tag, results } = processBuffer({
        buffer: buffer + str,
        tag,
        bufferLength: maxTagLength + 3,
      }));
      if (results) {
        for (const result of results) {
          yield result;
        }
      }
    }
  }
  const { results } = processBuffer({
    buffer,
    tag,
    bufferLength: 0,
  });
  if (results) {
    for (const result of results) {
      yield result;
    }
  }
}

function processBuffer({ buffer, tag, bufferLength }) {
  const results = [];
  while (buffer.length > bufferLength) {
    const match = buffer.match(/<.+?>/);
    if (match) {
      results.push({ content: buffer.slice(0, match.index), tag });
      buffer = buffer.slice(match.index + match[0].length);
      if (match[0][1] === "/") {
        tag = undefined;
      } else {
        tag = match[0].slice(1, -1);
      }
    } else {
      results.push({
        content: bufferLength > 0 ? buffer.slice(0, -bufferLength) : buffer,
        tag,
      });
      buffer = bufferLength > 0 ? buffer.slice(-bufferLength) : "";
    }
  }
  return { buffer, tag, results };
}

export { xmlParser };
