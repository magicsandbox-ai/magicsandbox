import { test, expect } from "@jest/globals";
import { columnNameFromNumber, columnNameToNumber } from "../utils.ts";

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
