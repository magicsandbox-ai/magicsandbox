import { describe, expect, test } from "@jest/globals";
import processTailwindBrowser from "../index.js";

/*
npm run jest -- packages/js/tailwind-browser/__tests__/processTailwindBrowser.js
*/

describe("processTailwindBrowser", () => {
  test("works", async () => {
    const config = {
      content: [
        {
          raw: '<div class="font-bold hover:block hover:focus:underline text-lg">',
          extension: "html",
        },
      ],
    };
    const css = `@tailwind base; @tailwind components; @tailwind utilities;

@layer base {
  body {
    @apply flex;
  }
}`;
    const { processedCss, classMap } = await processTailwindBrowser(
      config,
      css,
    );
    expect(processedCss).toBeDefined();
    expect(classMap).toBeDefined();
    expect(classMap).toEqual({
      "font-bold": "font-weight: 700;",
      block: "display: block;",
      underline: "text-decoration-line: underline;",
      "text-lg": "font-size: 1.125rem;\nline-height: 1.75rem;",
      flex: "display: flex;",
    });
  });
});
