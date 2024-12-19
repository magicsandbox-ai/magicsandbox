@magicsandbox.ai/dev helps you develop and publish Magic Apps and Functions locally.

## Getting Started

Install:

`npm install "@magicsandbox.ai/dev"`

Run:

`npm run magicsandbox init MyApp`

This creates a new directory with a basic project structure:

```
MyApp/
├── magic.json5
├── index.js
├── index.html
└── index.css
```

And adds the following to your `package.json`:

```json
"scripts": {
  "dev": "magicsandbox dev",
  "publish": "magicsandbox publish"
}
```

You can then run `npm run dev MyApp`, which will start a local dev server. Open [magicsandbox.ai?app=magicsandbox.DevLocal](https://magicsandbox.ai?app=magicsandbox.DevLocal) to see your App and start making changes.

Run `npm run magicsandbox --help` to see more command line options.

## Publishing

Run `npm run publish MyApp` to build and publish your App.

Publishing requires an API key, which you can get [here](https://magicsandbox.ai/api-key).

`@magicsandbox.ai/dev` will walk upwards from your App directory, looking for a `.env` file with a `MAGICSANDBOX_API_KEY` environment variable. If it can't find one and `process.env.MAGICSANDBOX_API_KEY` is not set, it will throw an error.

## Documentation

This section documents behavior specific to how `@magicsandbox.ai/dev` works and interprets the `magic.json` file. Refer to the [Magic Sandbox docs](todo) for details on `magic.json` and Magic Sandbox in general.

### magic.json file

This may be either a JSON or JSON5 file.

### dependencies

If `dependencies` is present in `magic.json`, `@magicsandbox.ai/dev` will handle installing them for you by:

1. Creating a basic `package.json` file using the information in `magic.json`
2. Running `npm install` to install the dependencies
3. Deleting `package.json`

If `dependencies` is not present in `magic.json`, `@magicsandbox.ai/dev` will assume you're handling installation yourself. You should either use `dependencies` in `magic.json` or `package.json`, not both. `@magicsandbox.ai/dev` will throw an error if both are present.

## Debugging

Debug your builds with `npm run dev --debug MyApp`.

This will save three files in the same directory as your app:

- `_debug_app.json`: The build output, your Magic App JSON. This is the JSON that is sent to Magic Sandbox when publishing.
- `_debug_metafile.json`: esbuild's [metafile](https://esbuild.github.io/api/#metafile)
- `_debug_metafile.txt`: The output of [esbuild.analyzeMetafile](https://esbuild.github.io/api/#analyze)

You may want to add `**/_debug_*` to your `.gitignore` file.
