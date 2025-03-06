import { describe, expect, test } from "@jest/globals";
import { getHeadings } from "../index.js";

/*
npm run jest -- packages/js/docs
*/

const docs = `# Documentation

## Section 1

alpha

### Subsection 1.1

beta

### Subsection 1.2

gamma

## Section 2

delta

## Section 3

epsilon

### Subsection 3.1

zeta
`;

console.log(getHeadings(docs, ["Section 1", "Subsection 3.1"]));

describe("getHeadings", () => {
  test("works", () => {
    const result = getHeadings(docs, ["Section 1", "Subsection 3.1"]);
    expect(result).toBe(`## Section 1

alpha

### Subsection 1.1

beta

### Subsection 1.2

gamma

### Subsection 3.1

zeta
`);
  });

  test("throws if some headings are not found", async () => {
    expect(() => getHeadings(docs, ["Section 1", "Subsection 3.2"])).toThrow();
  });
});
