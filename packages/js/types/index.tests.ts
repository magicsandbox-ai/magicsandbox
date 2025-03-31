/*
npx tsc -p packages/js/types
*/

interface TestArgs {
  testArg: string;
}

interface TestResult {
  testResult: string;
}

(async () => {
  // no options, infer generic types
  const { result } = await requestFunction("magicsandbox.test", {
    testArg: "test",
    // not an error!!
    foo: "foo",
  });
  console.log(result.testResult);
  console.log(result.foo);
})();

(async () => {
  // no options, specify generic types
  const { result } = await requestFunction<TestArgs, TestResult>(
    "magicsandbox.test",
    {
      testArg: "test",
    },
  );
  console.log(result.testResult);
  // @ts-expect-error
  console.log(result.foo);
})();

(async () => {
  // metadata, infer generic types
  const { result, metadata } = await requestFunction(
    "magicsandbox.test",
    {
      testArg: "test",
      // not an error!!
      foo: "foo",
    },
    {
      includeMetadata: ["id", "finalCost"],
    },
  );
  console.log(result.testResult);
  console.log(result.foo);
  console.log(metadata.id);
  // @ts-expect-error
  console.log(metadata.name);
})();

(async () => {
  // metadata, specify generic args and result types
  const { result, metadata } = await requestFunction<TestArgs, TestResult>(
    "magicsandbox.test",
    {
      testArg: "test",
    },
    {
      includeMetadata: ["id", "finalCost"],
    },
  );
  console.log(result.testResult);
  // @ts-expect-error
  console.log(result.foo);
  console.log(metadata.id);
  // not an error!!
  console.log(metadata.name);
})();

(async () => {
  // metadata, specify all generic types
  const { result, metadata } = await requestFunction<
    TestArgs,
    TestResult,
    "id" | "finalCost"
  >(
    "magicsandbox.test",
    {
      testArg: "test",
    },
    {
      includeMetadata: ["id", "finalCost"],
    },
  );
  console.log(result.testResult);
  // @ts-expect-error
  console.log(result.foo);
  console.log(metadata.id);
  // @ts-expect-error
  console.log(metadata.name);
})();

(async () => {
  // stream, infer generic types
  const stream = await requestFunction(
    "magicsandbox.test",
    {
      testArg: "test",
      // not an error!!
      foo: "foo",
    },
    {
      stream: true,
      includeMetadata: ["id", "finalCost"],
    },
  );
  for await (const { result, metadata } of stream) {
    // not an error!!
    console.log(result.testResult);
    // not an error!!
    console.log(result.foo);
    console.log(metadata?.id);
    // @ts-expect-error
    console.log(metadata.name);
  }
})();

(async () => {
  // stream, specify generic types
  const stream = await requestFunction<
    TestArgs,
    TestResult,
    "id" | "finalCost"
  >(
    "magicsandbox.test",
    {
      testArg: "test",
      // @ts-expect-error
      foo: "foo",
    },
    {
      stream: true,
      includeMetadata: ["id", "finalCost"],
    },
  );
  for await (const { result, metadata } of stream) {
    console.log(result?.testResult);
    // @ts-expect-error
    console.log(result?.foo);
    console.log(metadata?.id);
    // @ts-expect-error
    console.log(metadata.name);
  }
})();
