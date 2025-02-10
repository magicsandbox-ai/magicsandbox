# @magicsandbox.ai/docs

`@magicsandbox.ai/docs` provides tools for working with [Magic Sandbox](https://magicsandbox.ai) documentation.

## Getting Started

`npm install "@magicsandbox.ai/docs"`

## Usage

### Importing the Docs

`@magicsandbox.ai/docs` exposes a `docs.md` file that contains the Magic Sandbox documentation:

```javascript
import docs from "@magicsandbox.ai/docs/docs.md";
```

Make sure your bundler is configured to load Markdown files. For example, with esbuild:

```javascript
{
  loader: { ".md": "text" },
}
```

### getHeadings

You can use `getHeadings` to extract specific headings from the docs:

```javascript
import docs from "@magicsandbox.ai/docs/docs.md";
import { getHeadings } from "@magicsandbox.ai/docs";

function context() {
  return `Context specific to my App here...

  Magic Sandbox executes Apps in a sandbox. The restrictions and capabilities of the Sandbox are documented below:

  ${getHeadings(docs, ["Sandbox"])}
  `;
}

export { context };
```
