# Publishing

## magicsandbox.Dev

The App [magicsandbox.Dev](https://magicsandbox.ai?app=magicsandbox.Dev) is an easy way to create and publish Magic Apps without installing anything on your computer. It handles the build process for you, provides a live preview so you can test your App as you develop, and includes a button for easy publishing.

With magicsandbox.Dev, you'll edit a `magic.json` file, which is your Magic App JSON. magicsandbox.Dev supports all of the keys documented in [Magic Apps](magic-apps), but it also allows additional keys to make development easier. magicsandbox.Dev also provides different default values for `html` and `style`. These details are covered in the next section.

### magic.json

#### scriptFile (string) (default 'index.js')

Filename containing `script` code, defaults to `index.js`. Editing this file is usually more convenient than editing the `script` key in `magic.json` directly.

#### html (string) (default '<div id="root"></div>')

Unlike when publishing to Magic Sandbox directly, magicsandbox.Dev provides a default value for `html` if you don't specify `html` or have an `htmlFile`.

#### htmlFile (string) (default 'index.html')

Filename containing `html` code, defaults to `index.html`. Editing this file is usually more convenient than editing the `html` key in `magic.json` directly.

#### style (string) (default '@tailwind base; @tailwind components; @tailwind utilities;')

Unlike when publishing to Magic Sandbox directly, magicsandbox.Dev provides a default value for `style`, assuming you're using Tailwind if you don't specify `style` or have a `styleFile`.

#### styleFile (string) (default 'index.css')

Filename containing `style` code, defaults to `index.css`. Editing this file is usually more convenient than editing the `style` key in `magic.json` directly.

#### tailwindConfig (object) (default below)

Options to pass to [Tailwind](https://tailwindcss.com/docs/configuration) during the [build process](todo). Currently only Tailwind v3 is supported.

magicsandbox.Dev does not support configuring `content`. By default, all files ending in `.js`, `.jsx`, or `.html` are included. You can add an `excludeContent` key to exclude files:

```javascript
{
  excludeContent: ['utils.js', 'index.html],
};
```

`tailwindConfig` is simply an object, so it doesn't support all of Tailwind's configuration options. Rather than supplying `tailwindConfig` in `magic.json`, you can also create a `tailwind.config.js` or `tailwind.config.mjs` file. This enables advanced features like `plugins`, `presets`, and `content.transform` that require the config to be evaluated as JavaScript:

```javascript
import typography from "@tailwindcss/typography";

export default {
  plugins: [typography],
};
```

`tailwindConfig` is not used if `tailwind.config.js` or `tailwind.config.mjs` is present.

#### args ({ input: string, budget: number })

#### cacheRequests (boolean) (default true)

Whether to cache `requestApp` and `requestFunction` calls, which can save cost when making repeated calls during development. Set to false to disable.

#### writeData (object) (default { enabled: false, requestAppMaxCost: 0 })

Whether to write data to the database when calling `requestPutData` or `requestDeleteData`. If not enabled, data will be maintained in memory, so it can be retrieved by later calls to `requestGetData` but will be lost when the server restarts.

Magic Sandbox requires that an App was successfully called with `requestApp` before writing to the database. Therefore, to enable writing data:

- A version of your App must have been published successfully.
- You must set `writeData.enabled` to true and `writeData.requestAppMaxCost` to a number that's greater than your App's minCost.

After you do so, magicsandbox.Dev will call `requestApp` once and begin writing to the database.

#### dependencies (object)

Version ranges to use for the packages you import. magicsandbox.Dev supports import statements that use [semver ranges](https://github.com/npm/node-semver#versions):

```javascript
import React from "react@^18";
```

However, if you import a package across multiple files, it can be easier to manage the version in `magic.json` using the `dependencies` key:

```javascript
{
  "dependencies": {
    "react": "^18"
  }
}
```

todo dependencies takes precedence over the version ranges specified in the import statements

#### overrides (object)

Version ranges to use for all imports, enabling you to override the dependencies of your dependencies. If you're familiar with the behavior of `overrides` in npm, note that magicsandbox.Dev currently supports only a subset of the functionality that npm does:

```javascript
{
  "overrides": {
    //always import dep1 as major version 1
    "dep1": "^1",
    //except when importing from dep2@2.0.0, use version 2.0.0
    "dep2@2.0.0": { //note that version is required here, "dep2" or "dep2@^2" would not do anything
      "dep1": "2.0.0" //note this takes precedence over the dep1 override above
    }
  }
}
```

#### esbuildOptions (object) (default below)

Options to pass to [esbuild](https://esbuild.github.io/api/#build) during the [build process](todo).

The default values below can be overridden, except for `entryPoints`, `write`, and `plugins`:

```javascript
{
  entryPoints: [scriptFile], //cannot be overridden
  write: false, //cannot be overridden
  plugins: [magicsandbox.Dev.customPlugins], //cannot be overridden
  bundle: true,
  globalName: 'app', //assigns exports (i.e. context, api) to this global variable
  loader: { '.js': 'jsx' },
  target: 'es2020',
  minify: publishing ? true : false, //true when building for publishing, false when building for live preview
  sourcemap: publishing ? false : true, //false when building for publishing, true when building for live preview
};
```

#### debug (boolean) (default false)

Enable additional logging to debug the build.

#### cdn (string) (default 'esm.sh')

The CDN to use for the build. Supported values are `esm.sh` and `jsdelivr `.

#### optimizedTreeShaking (boolean) (default false)

Whether to further minify the build by tree shaking unused imports, which requires two build passes. This is only supported for `cdn` `esm.sh`.

### magicsandbox.Dev Advanced Details

This section covers advanced details about how magicsandbox.Dev works and can be skipped if you're just getting started.

fetch plugin: jsdelivr, version resolution, allow multiple versions
bundle deps plugin: imports not hoisted or sealed, dynamic imports?
tailwind browser
request handler caveats? author, data? cache, assistant rejecting
how to debug/sourcemaps

#### Peer Dependencies

magicsandbox.Dev handles peer dependencies differently than npm. Consider the following dependency graph:

```
root -> (peer@1, dep1, dep2)
dep1 -> (PEER: peer@1)
dep2 -> (peer@2, dep3)
dep3 -> (PEER: peer@2)
```

npm places peer dependencies at or above the dependent package, creating the following tree:

```
root
  +-- peer@1
  +-- dep1
  +-- dep2
      +-- peer@2
      +-- dep3
```

magicsandbox.Dev currently takes a simplified approach, assuming a package marked as a peer dependency should only resolve to a single version throughout the tree. It will create the following tree and emit a warning that dep2's and dep3's version ranges for peer@2 are ignored:

```
root
  +-- peer@1
  +-- dep1
  +-- dep2
  +-- dep3
```

This is actually more convenient for peer dependencies like React when you want to ensure only a single version is used globally. However, it may not support more advanced use cases. Please [create an issue](todo) if you have any feedback.

## @magicsandbox.ai/dev

The package [@magicsandbox.ai/dev](https://www.npmjs.com/package/@magicsandbox.ai/dev) is a command-line tool for creating and publishing Magic Apps locally. Refer to the docs for more details.

## magicsandbox.PublishFunction

The App [magicsandbox.PublishFunction](https://magicsandbox.ai?app=magicsandbox.PublishFunction) is a simple interface for publishing Magic Functions.

## Custom Methods

You can develop your own methods for publishing Magic Apps and Functions. Remember, only the keys documented in [Magic Apps](magic-apps) and [Magic Functions](magic-functions) are supported when publishing to the server. magicsandbox.Dev specific keys like `scriptFile` are not supported.

### Custom Magic App

Rather than using magicsandbox.Dev or magicsandbox.PublishFunction, you can create your own Magic App to publish Magic Apps and Functions using [requestPublish](todo).

### Custom Local Development

You can publish Magic Apps and Functions locally by making a POST request to `https://magicsandbox.ai/publish`. Your request should include the following:

- URL parameters:
  - `kind`: 'app' or 'function'
  - `name`: App or Function name
  - `version`: App or Function version
- Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <apiKey>`, where `<apiKey>` is your API key, which you can generate [here](https://magicsandbox.ai/api-key)
- Body:
  - the App or Function JSON object

Here's an example:

```javascript
fetch(
  `https://magicsandbox.ai/publish?kind=app&name=${appObj.name}&version=${appObj.version}`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(appObj),
  },
);
```

## Updating Magic Apps and Functions

You can update Magic Apps and Functions by publishing again with the same name and version.

Updates have the following restrictions:

- `script`, `html`, `style`: cannot be updated. Publish a new version instead.
- Apps cannot be changed to Functions or vice versa.

Note that you only need to provide the keys you're updating. In fact, this is required for Apps, as the server will throw an error if you include `script`, `html`, or `style` when republishing an App. For example, to update `description`, you can publish the following:

```javascript
{
  name: "MyApp",
  version: "1.0.0",
  description: "This is my new description and improved description",
}
```
