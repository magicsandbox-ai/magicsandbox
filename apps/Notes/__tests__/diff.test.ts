import { describe, expect, test } from "@jest/globals";
import { handleDiff } from "../diff.ts";
import { serialize } from "../prosemirrorMarkdown.ts";
import { type Node } from "prosemirror-model";
import { type DecorationSet } from "prosemirror-view";
/*
npm run jest -- apps/Notes/__tests__/diff.test.ts
*/

const prevContent = `
alpha
bravo
charlie

# delta
## echo
### foxtrot

> golf
> hotel
> india

\`\`\`
juliet
kilo
lima
\`\`\`

- mike
- november
- oscar

1. papa
2. quebec
3. romeo
`;

const content = `
alpha
beta
charlie

# delta
## elephant
### foxtrot

> golf
> hydrogen
> india

\`\`\`
juliet
kevin
lima
\`\`\`

\`\`\`
I'm a new code block!
\`\`\`

- mike
- nancy
  - I'm a new sub bullet!
- oscar

1. papa
2. quail
3. romeo
`;

/*
for some reason the serializer likes "*" instead of "-" for bullet points
and the ordering is different - but I don't think there's anything we can do about that
*/
const expectedContent = `
alpha
bravo
beta
charlie

# delta
## echo
## elephant
### foxtrot

> golf
> hotel
> hydrogen
> india

\`\`\`
juliet
kilo
kevin
lima
\`\`\`

\`\`\`
I'm a new code block!
\`\`\`

* mike
* november
* nancy
  * I'm a new sub bullet!
* oscar

1. papa
2. quebec
3. quail
4. romeo
`;

const expectedDecorationClasses = {
  alpha: "",
  bravo: "removed",
  beta: "added",
  charlie: "",
  delta: "",
  echo: "removed",
  elephant: "added",
  foxtrot: "",
  golf: "",
  hotel: "removed",
  hydrogen: "added",
  india: "",
  juliet: "",
  kilo: "removed",
  kevin: "added",
  lima: "",
  "new code block": "added",
  mike: "",
  november: "removed",
  nancy: "added",
  "new sub bullet": "added",
  oscar: "",
  papa: "",
  quebec: "removed",
  quail: "added",
  romeo: "",
};

describe("diff", () => {
  test("works", () => {
    const { doc, decorationSet } = handleDiff(prevContent, content);
    expect(serialize(doc)).toBe(expectedContent);
    for (const [text, expectedClass] of Object.entries(
      expectedDecorationClasses,
    )) {
      expect(getDecorationClasses(text, doc, decorationSet)).toBe(
        expectedClass,
      );
    }
  });
});

function getDecorationClasses(
  text: string,
  doc: Node,
  decorationSet: DecorationSet,
) {
  let start: number | undefined;
  let end: number | undefined;
  doc.descendants((node, pos) => {
    if (node.text) {
      const index = node.text.indexOf(text);
      if (index !== -1) {
        start = pos + index;
        end = start + text.length;
      }
    }
    if (start !== undefined) {
      return false; //don't search further
    }
  });
  const decorations = decorationSet.find(start, end);
  return decorations.map((d) => d.spec.class as string).join(" ");
}
