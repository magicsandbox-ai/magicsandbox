# @magicsandbox.ai/dev

`@magicsandbox.ai/dev` helps you develop and publish [Magic Sandbox](https://magicsandbox.ai) Apps and Functions locally.

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
```

And adds the following to your `package.json`:

```json
"scripts": {
  "dev": "magicsandbox dev",
  "publish": "magicsandbox publish"
}
```

You can then run `npm run dev MyApp`, which will start a local dev server and open `magicsandbox.DevLocal`, where you can see your App and start making changes.

Run `npx magicsandbox --help` to see more command line options.

## Publishing

Run `npm run publish MyApp` to build and publish your App.

Publishing requires an API key, which you can get [here](https://magicsandbox.ai/account/api-key).

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

Refer to the [Magic Sandbox docs](https://magicsandbox.ai/?_app=magicsandbox.Docs) for details on `magic.json` and Magic Sandbox in general.

This section documents behavior specific to how `@magicsandbox.ai/dev` works and interprets the `magic.json` file.

### magic.json file

Can be named either `magic.json` or `magic.json5`. JSON5 is supported either way.

### dependencies

If `dependencies` is present in `magic.json`, `@magicsandbox.ai/dev` will handle installing them for you by:

1. Creating a `package.json` file using `magic.json`
2. Running `npm install` to install the dependencies
3. Deleting `package.json`

If `dependencies` is not present in `magic.json`, `@magicsandbox.ai/dev` will assume you're handling dependencies yourself. You should either use `dependencies` in `magic.json` or `package.json`, not both. `@magicsandbox.ai/dev` will throw an error if both are present.

You can install a package and add it to `dependencies` in `magic.json` using the `install` command. For example, to add "react" to MyApp:

`npx magicsandbox install MyApp react`

### tailwindConfig

Unlike `magicsandbox.Dev`, `@magicsandbox.ai/dev` supports configuring `content` in the usual way. `@magicsandbox.ai/dev` also supports `excludeContent` to enable easily porting Apps from `magicsandbox.Dev`. Behind the scenes, it transforms:

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

Filename containing `documentation`. Defaults to 'README.md'. Only used for Functions.

### prebuild

Script to run before building the App. The script will run in your current working directory, not the App folder.

## Globals

This package exports a `globals` object that can be used with your linter. See [here](https://github.com/magicsandbox-ai/magicsandbox/blob/main/eslint.config.mjs) for an example.

## TypeScript Support

Use `index.ts` or `index.tsx` as your entrypoint. The build looks for these files by default, so you don't need to configure `scriptFile` in `magic.json`.

This package installs `magicsandbox.ai/types` as a dependency. To get type definitions for `requestFunction` and other Sandbox functions, add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["@magicsandbox.ai/types"]
  }
}
```

See [here](https://github.com/magicsandbox-ai/magicsandbox/blob/main/tsconfig.json) for an example `tsconfig.json`.

You can specify generics for additional type safety:

```typescript
interface MyArgs {
  myArg: string;
}

interface MyResult {
  myResult: string;
}

const { result } = await requestFunction<MyArgs, MyResult>(
  "author.myFunction",
  {
    myArg: "myArg",
  },
);

interface DBSchema {
  foo: string;
  bar: number;
}

const foo = await requestGetData<DBSchema, "foo">("foo");
```

## Debugging

Debug your builds with `npm run dev --debug MyApp`.

This will save three files in the same directory as your app:

- `_debug_magic.json`: The build output, your App JSON. This is the JSON that is sent to Magic Sandbox when publishing.
- `_debug_metafile.json`: esbuild's [metafile](https://esbuild.github.io/api/#metafile)
- `_debug_metafile.txt`: The output of [esbuild.analyzeMetafile](https://esbuild.github.io/api/#analyze)

You may want to add `**/_debug_*` to your `.gitignore` file.

## Testing

Consider using [@magicsandbox.ai/test](https://github.com/magicsandbox-ai/magicsandbox/tree/main/packages/js/test) to test your App.

## Using HTTPS

`magicsandbox.DevLocal` works by making a fetch request to the dev server at `http://localhost`. There are scenarios where this won't work and you'll need to use HTTPS:

- Using Safari: Safari doesn't allow HTTP requests to localhost from a site served over HTTPS
- Accessing the dev server from another device: for example, to test your App on your phone before publishing

To access the dev server using HTTPS, follow these steps:

1. Sign up for a tunneling service. Currently only [ngrok](https://dashboard.ngrok.com/signup) is supported. If you want to use a different service, please create an issue or a PR.

2. Start the dev server with the `--tunnel` flag. By default, when tunneling, the dev server will minify your code and not generate sourcemaps to reduce bandwidth usage.

```
npm run dev MyApp -- --tunnel ngrok
```

3. Rather than automatically opening `magicsandbox.DevLocal` in your default browser, you'll see a message in the console "Open this url on any device: ...". Open this url on any device to access the dev server using HTTPS.
