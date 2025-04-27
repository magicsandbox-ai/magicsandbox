import { describe, test, expect } from "@jest/globals";
import {
  columnNameFromNumber,
  columnNameToNumber,
  getRanges,
  type Range,
} from "../utils.ts";
import { SheetData } from "@ironcalc/wasm";

/*
npm run jest -- apps/Sheets/__tests__/utils.ts
*/

test("columnNameFromNumber", () => {
  expect(columnNameFromNumber(1)).toBe("A");
  expect(columnNameFromNumber(2)).toBe("B");
  expect(columnNameFromNumber(26)).toBe("Z");
  expect(columnNameFromNumber(27)).toBe("AA");
  expect(columnNameFromNumber(28)).toBe("AB");
  expect(columnNameFromNumber(52)).toBe("AZ");
  expect(columnNameFromNumber(53)).toBe("BA");
});

test("columnNameToNumber", () => {
  expect(columnNameToNumber("A")).toBe(1);
  expect(columnNameToNumber("B")).toBe(2);
  expect(columnNameToNumber("Z")).toBe(26);
  expect(columnNameToNumber("AA")).toBe(27);
  expect(columnNameToNumber("AB")).toBe(28);
  expect(columnNameToNumber("AZ")).toBe(52);
  expect(columnNameToNumber("BA")).toBe(53);
});

function makeSheetData(cells: Array<[number, number]>): SheetData {
  const sheet: SheetData = new Map();
  for (const [row, col] of cells) {
    if (!sheet.has(row)) sheet.set(row, new Map());
    sheet.get(row)!.set(col, { value: "1", formula: null });
  }
  return sheet;
}

function compareRanges(ranges: Range[], expected: Range[]) {
  // order of ranges may vary, so sort for comparison
  ranges.sort((a, b) => a.leftRow - b.leftRow || a.leftCol - b.leftCol);
  expect(ranges).toEqual(expected);
}

describe("getRanges", () => {
  test("works", () => {
    const sheetData = makeSheetData([
      [1, 1],
      [2, 1],
      [2, 2],
      [3, 1],
      [3, 3],
    ]);
    const ranges = getRanges(sheetData);
    const expected: Range[] = [
      { leftRow: 1, leftCol: 1, rightRow: 3, rightCol: 3 },
    ];
    compareRanges(ranges, expected);
  });

  test("handles multiple ranges", () => {
    const sheetData = makeSheetData([
      [1, 2],
      [2, 1],
      [2, 2],
      [4, 1],
      [4, 2],
      [4, 3],
      [5, 2],
    ]);
    const ranges = getRanges(sheetData);
    const expected: Range[] = [
      { leftRow: 1, leftCol: 1, rightRow: 2, rightCol: 2 },
      { leftRow: 4, leftCol: 1, rightRow: 5, rightCol: 3 },
    ];
    compareRanges(ranges, expected);
  });
});
