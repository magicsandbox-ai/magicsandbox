# @magicsandbox.ai/build-docs

`@magicsandbox.ai/build-docs` turns a documentation Markdown file into a [Magic Sandbox](https://magicsandbox.ai) App.

## Getting Started

`npm install "@magicsandbox.ai/build-docs"`

Refer to the [Magic Sandbox docs](https://magicsandbox.ai/?app=magicsandbox.Docs) for details on the `magic.json` file and Magic Sandbox in general.

`@magicsandbox.ai/build-docs` installs [@magicsandbox.ai/dev](https://github.com/magicsandbox-ai/magicsandbox/tree/main/packages/js/dev) as a dependency.

## Usage

Set up a folder structured like so, where `index.md` is your documentation Markdown file. `@magicsandbox.ai/build-docs` will initialize these files for you if needed:

```
MyDocsApp/
├── magic.json5
└── index.md
```

Then run:

`npx magicsandbox docs MyDocsApp`

Which generates the following files. You may want to configure your .gitignore file to ignore the `dist` folder:

```
MyDocsApp/
├── magic.json5
├── index.md
├── dist/
│   ├── index.js
│   ├── index.html
│   └── index.css
```

And configures your `magic.json5` file like so:

```javascript
{
  scriptFile: "dist/index.js",
  htmlFile: "dist/index.html",
  styleFile: "dist/index.css",
  prebuild: "npx magicsandbox docs MyDocsApp",
  esbuildOptions: {
    loader: { ".md": "text" },
  },
}
```

You can then use `@magicsandbox.ai/dev` to preview and publish your App. All you have to do to make changes is edit the `index.md` file.

```
npx magicsandbox dev MyDocsApp
npx magicsandbox publish MyDocsApp
```

See the [@magicsandbox.ai/dev docs](https://github.com/magicsandbox-ai/magicsandbox/tree/main/packages/js/dev) for details.
