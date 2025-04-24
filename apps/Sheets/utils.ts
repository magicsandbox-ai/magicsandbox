function columnNameFromNumber(column: number): string {
  let name = "";
  while (column > 0) {
    name = String.fromCharCode(65 + ((column - 1) % 26)) + name;
    column = Math.floor((column - 1) / 26);
  }
  return name;
}

function columnNameToNumber(name: string): number {
  return name.split("").reduce((acc, char) => {
    return acc * 26 + (char.charCodeAt(0) - 64);
  }, 0);
}

export { columnNameFromNumber, columnNameToNumber };
