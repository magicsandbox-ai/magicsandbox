function columnNameFromNumber(column: number): string {
  let name = "";
  while (column > 0) {
    name = String.fromCharCode(65 + ((column - 1) % 26)) + name;
    column = Math.floor((column - 1) / 26);
  }
  return name;
}

export { columnNameFromNumber };
