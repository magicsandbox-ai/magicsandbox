import { test, expect } from "@jest/globals";
import { columnNameFromNumber } from "../utils.ts";

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
