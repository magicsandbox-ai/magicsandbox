function concatUint8Array(arr1: Uint8Array, arr2: Uint8Array | undefined) {
  if (arr2 === undefined) {
    return arr1;
  }
  const output = new Uint8Array(arr1.length + arr2.length);
  output.set(arr1);
  output.set(arr2, arr1.length);
  return output;
}

export { concatUint8Array };
