# @magicsandbox.ai/dev

@magicsandbox.ai/dev helps you develop and publish [Magic Sandbox](https://magicsandbox.ai) Apps and Functions locally.

## Getting Started

Install:

`npm install "@magicsandbox.ai/dev"`

Run:

`npx magicsandbox init MyApp`

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

You can then run `npm run dev MyApp`, which will start a local dev server and open magicsandbox.DevLocal, where you can see your App and start making changes.

Run `npx magicsandbox --help` to see more command line options.

## Publishing

Run `npm run publish MyApp` to build and publish your App.

Publishing requires an API key, which you can get [here](https://magicsandbox.ai/api-key).

`@magicsandbox.ai/dev` requires the `MAGICSANDBOX_API_KEY` environment variable to be set, which you can set in a `.env` file in your project root.

```
MyApp1/
└── magic.json5
MyApp2/
└── magic.json5
.env
package.json
```

## Documentation

This section documents behavior specific to how `@magicsandbox.ai/dev` works and interprets the `magic.json` file. Refer to the [Magic Sandbox docs](https://magicsandbox.ai/?_app=magicsandbox.Docs) for details on `magic.json` and Magic Sandbox in general.

### magic.json file

Can be named either `magic.json` or `magic.json5`. JSON5 is supported either way.

### dependencies

If `dependencies` is present in `magic.json`, `@magicsandbox.ai/dev` will handle installing them for you by:

1. Creating a `package.json` file using `magic.json`
2. Running `npm install` to install the dependencies
3. Deleting `package.json`

If `dependencies` is not present in `magic.json`, `@magicsandbox.ai/dev` will assume you're handling dependencies yourself. You should either use `dependencies` in `magic.json` or `package.json`, not both. `@magicsandbox.ai/dev` will throw an error if both are present.

todo install `npx magicsandbox install MyApp react`

### tailwindConfig

Unlike `magicsandbox.Dev`, `@magicsandbox.ai/dev` supports configuring `content` in the usual way. `@magicsandbox.ai/dev` also supports `excludeContent` to enable porting Apps from `magicsandbox.Dev`. Behind the scenes, it transforms:

```javascript
{
  excludeContent: ['utils.js', 'index.html],
};
```

into:

```javascript
{
  content: ['!path/to/MyApp/utils.js', '!path/to/MyApp/index.html'],
};
```

### documentationFile

todo

### prebuild

Script to run before building the App. The script will run in your current working directory, not the App folder.

## Globals

This package exports a `globals` object that can be used with your linter. See [here](https://github.com/magicsandbox-ai/magicsandbox/blob/main/eslint.config.mjs) for an example.

## Debugging

Debug your builds with `npm run dev --debug MyApp`.

This will save three files in the same directory as your app:

- `_debug_magic.json`: The build output, your Magic App JSON. This is the JSON that is sent to Magic Sandbox when publishing.
- `_debug_metafile.json`: esbuild's [metafile](https://esbuild.github.io/api/#metafile)
- `_debug_metafile.txt`: The output of [esbuild.analyzeMetafile](https://esbuild.github.io/api/#analyze)

You may want to add `**/_debug_*` to your `.gitignore` file.
