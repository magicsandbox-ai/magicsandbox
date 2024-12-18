esbuild plugin for Tailwind

`npm install "@magicsandbox.ai/esbuild-plugin-tailwind"`

```js
import { tailwindPlugin } from "@magicsandbox.ai/esbuild-plugin-tailwind";
import config from "./tailwind.config.js";

await esbuild.build({
  //other options...
  plugins: [tailwindPlugin(config)],
});
```
