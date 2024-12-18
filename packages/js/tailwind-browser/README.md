Use Tailwind in the browser.

`npm install "@magicsandbox.ai/tailwind-browser"`

```js
import processTailwind from "@magicsandbox.ai/tailwind-browser";

const config = {
  content: [{ raw: '<div class="font-bold">', extension: "html" }],
};

const css = "@tailwind base; @tailwind components; @tailwind utilities;";

processTailwind(config, css).then(({ processedCss }) => {
  console.log(processedCss);
});

/*
...base, components, utilities styles...
.font-bold {
  font-weight: 700;
}
*/
```
