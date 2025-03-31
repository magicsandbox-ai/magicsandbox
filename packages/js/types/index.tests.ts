async function test() {
  const result = await requestFunction<
    { testArg: string },
    { testResult: string }
  >("test", {
    testArg: "test",
  });
  console.log(result);
}

test();
