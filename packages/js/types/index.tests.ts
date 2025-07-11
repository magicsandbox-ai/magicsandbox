/*
npx tsc -p packages/js/types
*/

(async () => {
  // no options
  const result = await requestApp("magicsandbox.Test");
  console.log(result.style);
  console.log(result.html);
  console.log(result.script);
  // @ts-expect-error
  console.log(result.foo);
  // @ts-expect-error
  console.log(result.metadata.id);
})();

(async () => {
  // options
  const result = await requestApp("magicsandbox.Test", {
    includeMetadata: ["id", "finalCost"],
  });
  console.log(result.style);
  console.log(result.html);
  console.log(result.script);
  // @ts-expect-error
  console.log(result.foo);
  console.log(result.metadata.id);
  // @ts-expect-error
  console.log(result.metadata.name);
})();

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
  const { result } = await requestFunction<TestResult, TestArgs>(
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
  const { result, metadata } = await requestFunction<TestResult, TestArgs>(
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
    TestResult,
    TestArgs,
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
    TestResult,
    TestArgs,
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

(async () => {
  const result = await requestMetadata("magicsandbox", ["id", "minCost"], {
    kind: "app",
  });
  for (const app of result) {
    console.log(app.id, app.minCost);
    // @ts-expect-error
    console.log(app.name);
  }
})();

interface DBSchema {
  foo: string;
  bar: number;
  baz: {
    qux: boolean;
  };
}

(async () => {
  // no need to specify schema
  await requestPutData("foo", "hello");
  // but of course it's not type safe if not
  await requestPutData("foo", 1);
  // can't put null - this should be an error but can't figure it out
  await requestPutData("foo", null);
  // need both generics for full type safety (annoying, but can't figure out a way around it)
  await requestPutData<DBSchema, "foo">("foo", "hello");
  // @ts-expect-error
  await requestPutData<DBSchema, "foo">("foo", null);
  // @ts-expect-error
  await requestPutData<DBSchema, "foo">("foo", 1);
  // @ts-expect-error
  await requestPutData<DBSchema, "blah">("blah", 1);

  const foo1 = await requestGetData("foo");
  console.log(foo1?.length);
  console.log(foo1?.toFixed(2));

  const foo2 = await requestGetData<DBSchema, "foo">("foo");
  console.log(foo2.length);
  // @ts-expect-error
  console.log(foo2.toFixed(2));

  const db = await requestGetAllData<DBSchema>();
  console.log(db.foo.length, db.bar.toFixed(2), db.baz.qux);
  // @ts-expect-error
  console.log(db.blah);

  const keys = await requestGetAllKeysData<DBSchema>();
  for (const key of keys) {
    console.log(key.length);
  }
})();

(async () => {
  const response = await requestFetch<{ foo: string }>(
    "https://api.example.com",
  );
  console.log(response.body.foo);
  // @ts-expect-error
  console.log(response.body.bar);

  // @ts-expect-error
  await requestFetch("https://api.example.com", { credentials: "include" });
})();

(async () => {
  const result = await requestUrlParams({ foo: "bar" });
  Object.entries(result).forEach(([key, value]) => {
    console.log(key, value);
  });
})();
