# Publishing

## magicsandbox.Dev

The App [magicsandbox.Dev](https://magicsandbox.ai?app=magicsandbox.Dev) is an easy way to create and publish Magic Apps without installing anything on your computer. It provides a live preview so you can test your App as you develop and includes a button for easy publishing.

With magicsandbox.Dev, you'll edit a `magic.json` file. This file can include all of the keys documented in [Magic Apps](#magic-apps), like `script`, `style`, and `html`. However, trying to edit code inside of a JSON file is inconvenient, so `magic.json` accepts additional keys enabling you to edit code using separate files instead. For example, rather than editing `script` in `magic.json` directly, you can create multiple JavaScript files. When magicsandbox.Dev builds your App, it will combine all of your files and populate `script`, `style`, and `html` for you.

### magic.json

#### scriptFile

_(string, default 'index.js')_

Main filename for `script` code. magicsandbox.Dev bundles your JavaScript files using esbuild using `scriptFile` as the entrypoint.

#### html

_(string, default '<div id="root"></div>')_

Unlike when publishing to Magic Sandbox directly, magicsandbox.Dev provides a default value for `html` if you don't specify `html` or have an `htmlFile`.

#### htmlFile

_(string, default 'index.html')_

Filename containing `html` code.

#### style

_(string, default '@tailwind base; @tailwind components; @tailwind utilities;')_

Unlike when publishing to Magic Sandbox directly, magicsandbox.Dev provides a default value for `style`, assuming you're using Tailwind if you don't specify `style` or have a `styleFile`.

#### styleFile

_(string, default 'index.css')_

Filename containing `style` code.

#### tailwindConfig

_(object, default below)_

Options to pass to [Tailwind](https://v3.tailwindcss.com/docs/configuration). Currently only Tailwind v3 is supported.

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

#### initArgs ({ input: string, budget: number, urlParams: object })

Arguments to pass to `app.init` during development.

#### cacheRequests (boolean) (default true)

Whether to cache `requestApp` and `requestFunction` calls, which can save cost when making repeated calls during development. Set to false to disable.

#### author (string)

To read from the database using e.g. `requestGetData`, magicsandbox.Dev needs to know the App to use for storage in the form 'author.name', so you must set the `author` key. Alternatively, you can set `options.app` when calling `requestGetData`.

Note that magicsandbox.Dev only maintains writes made with `requestPutData` or `requestDeleteData` in memory, not saved to the database. They can be retrieved by later calls to `requestGetData` but will be lost upon refresh. magicsandbox.Dev does not currently enforce the 10 MB database size limit.

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

Options to pass to [esbuild](https://esbuild.github.io/api/#build).

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

#### optimizedTreeShaking (boolean) (default true)

Whether to further minify the build by tree shaking unused imports, which requires two build passes. This is only supported for `cdn` `esm.sh`.

#### update (boolean) (default false)

Whether to update the App when publishing. magicsandbox.Dev will skip the build, as `script`, `html`, and `style` cannot be updated. See [Updating Magic Apps and Functions](#updating-magic-apps-and-functions) for details.

### magicsandbox.Dev advanced details

#### JSON5

The `magic.json` file can be written in JSON5.

#### Why are my builds sometimes slow?

magicsandbox.Dev parses your import statements and bundles external dependencies like React separately. When you rebuild your App, if the external dependencies haven't changed, magicsandbox.Dev will skip bundling external dependencies, making the rebuild extremely fast. If your external dependencies have changed, magicsandbox.Dev will fetch and bundle them again, making the build slower.

#### Debugging

When using magicsandbox.Dev, your code runs in an iframe that's nested several layers deep. Because of this, it can be difficult to find your code in the Sources tab in Chrome's devtools.

The easiest way to debug your code in Chrome is to add a `debugger` statement and run your code with devtools open, which will open your file in the Sources tab. Your files will all be prefixed with 'MagicApp', like 'MagicApp:index.js'.

#### Peer dependencies

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

This is actually more convenient for peer dependencies like React when you want to ensure only a single version is used globally. However, it may not support more advanced use cases. Please [create an issue](https://github.com/magicsandbox-ai/magicsandbox/issues/new?template=Blank+issue) if you have any feedback.

## @magicsandbox.ai/dev

The package [@magicsandbox.ai/dev](https://www.npmjs.com/package/@magicsandbox.ai/dev) is a command-line tool for creating and publishing Magic Apps locally. Refer to the docs for more details.

## Custom Methods

You can develop your own methods for publishing Magic Apps and Functions. Remember, only the keys documented in [Magic Apps](#magic-apps) and [Magic Functions](#magic-functions) are supported when publishing to the server. `magic.json` keys like `scriptFile` are not supported.

### Custom Magic App

Rather than using magicsandbox.Dev, you can create your own Magic App to publish Magic Apps and Functions using [requestPublish](#requestPublish).

### Custom Local Development

You can publish Magic Apps and Functions locally by making a POST request to `magicsandbox.ai/publish`. Your request should include the following:

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

You only need to provide the keys you're updating. In fact, this is required for Apps, as the server will throw an error if you include `script`, `html`, or `style` when republishing an App. For example, to update `description`, you can publish the following:

```javascript
{
  name: "MyApp",
  version: "1.0.1",
  update: true, //if using magicsandbox.Dev or @magicsandbox.ai/dev
  description: "This is my new and improved description",
}
```
