// async function* createStream(chunks) {
//   for (const chunk of chunks) {
//     yield chunk;
//   }
// }

function createStream(chunks: any[]) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

async function collectStream(stream: AsyncIterable<any>) {
  const results = [];

  for await (const chunk of stream) {
    results.push(chunk);
  }
  return results;
}

export { createStream, collectStream };
