// note the \ in the example below is to escape < for jsdoc
/**
 * Parses the top level tags of a stream
 *
 * Arguments: an object with keys:
 * - stream (AsyncIterable<any>): The stream to parse
 * - chunkProcessor (function(any) => string) (default (chunk) => chunk): A function that returns a string from a chunk of the stream
 * - validTags (string[]): An optional array of valid tags. All other tags are ignored
 * - maxTagLength (number) (default 100): The maximum expected length of a tag. Only used if validTags is not provided
 *
 * Returns:
 * - AsyncGenerator<{content: string, tag?: string}>
 *   - content: A string of content from the stream
 *   - tag: The name of the top level tag enclosing the content, if any
 *
 * Example: "hello world\<example>test\</example>goodbye"
 *
 * Could yield the following. Note that there is no guarantee on the number of objects yielded or how content is split across objects:
 * - {content: 'hello '}
 * - {content: 'world'}
 * - {content: 'test', tag: 'example'}
 * - {content: 'goodbye'}
 *
 * Usage: for await (const {content, tag} of tagStreamParser({stream: ...})) {
 */
async function* tagStreamParser({
  stream,
  chunkProcessor = (chunk) => chunk,
  validTags,
  maxTagLength = 100,
}) {
  if (validTags) {
    maxTagLength = Math.max(...validTags.map((tag) => tag.length));
    validTags = new Set(validTags);
  }
  let buffer = "";
  let tag;
  for await (const chunk of stream) {
    const str = chunkProcessor(chunk);
    if (str) {
      let results;
      ({ buffer, tag, results } = processBuffer({
        buffer: buffer + str,
        tag,
        validTags,
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
    validTags,
    bufferLength: 0,
  });
  if (results) {
    for (const result of results) {
      yield result;
    }
  }
}

function processBuffer({ buffer, tag, validTags, bufferLength }) {
  const results = [];
  while (buffer.length > bufferLength) {
    let match;
    if (tag) {
      match = buffer.match(new RegExp(`<\\/${tag}>`));
    } else {
      match = buffer.match(/<[a-zA-Z_][\w.-]*>/);
      if (validTags && match && !validTags.has(match[0].slice(1, -1))) {
        match = null;
      }
    }
    if (match) {
      if (match.index > 0) {
        results.push({
          content: buffer.slice(0, match.index),
          tag,
        });
      }
      buffer = buffer.slice(match.index + match[0].length);
      if (match[0][1] === "/") {
        tag = undefined;
      } else {
        tag = match[0].slice(1, -1);
      }
    } else {
      const content =
        bufferLength > 0 ? buffer.slice(0, -bufferLength) : buffer;
      results.push({
        content,
        tag,
      });
      buffer = bufferLength > 0 ? buffer.slice(-bufferLength) : "";
    }
  }
  return { buffer, tag, results };
}

/**
 * Parses the top level tags of a string
 *
 * Arguments: a string
 * - string (string): The string to parse
 * - validTags (string[]): An optional array of valid tags. All other tags are ignored
 *
 * Returns: {content: string, tag?: string}[]
 *
 * Example: "hello world\<example>test\</example>goodbye"
 *
 * Returns: [{content: "hello world"}, {content: "test", tag: "example"}, {content: "goodbye"}]
 */
function tagParser(string, validTags) {
  validTags = validTags ? new Set(validTags) : undefined;
  const { results } = processBuffer({
    buffer: string,
    tag: undefined,
    validTags,
    bufferLength: 0,
  });
  return results;
}

export { tagStreamParser, tagParser };
