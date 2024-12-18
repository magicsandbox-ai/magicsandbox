# Magic Sandbox development and publishing utilities

## Install

`npm install "@magicsandbox.ai/dev"`

## Usage

Add the following to your `package.json`:

```json
"scripts": {
  "dev": "magicsandbox dev",
  "publish": "magicsandbox publish"
}
```

If your file structure is like this:

```
apps/
  MyApp/
    magic.json
    index.js
```

Running `npm run dev apps/MyApp` will start a local dev server. Open magicsandbox.ai?app=magicsandbox.DevLocal to see your App.

Running `npm run publish apps/MyApp` will build and publish your App.

See the Magic Sandbox [docs](todo) for more details.

## Debugging

Debug your builds with `npm run dev --debug apps/MyApp`.

This will save three files in the same directory as your app:

- `app.json`: The build output, your Magic App JSON. This is the JSON that is sent to Magic Sandbox when publishing.
- `metafile.json`: esbuild's [metafile](https://esbuild.github.io/api/#metafile)
- `metafile.txt`: The output of [esbuild.analyzeMetafile](https://esbuild.github.io/api/#analyze)
