# @magicsandbox.ai/esbuild-plugin-tailwind

`@magicsandbox.ai/esbuild-plugin-tailwind` is an esbuild plugin for Tailwind.

## Getting Started

`npm install "@magicsandbox.ai/esbuild-plugin-tailwind"`

## Usage

```js
import { tailwindPlugin } from "@magicsandbox.ai/esbuild-plugin-tailwind";
import config from "./tailwind.config.js";

await esbuild.build({
  //other options...
  plugins: [tailwindPlugin(config)],
});
```
