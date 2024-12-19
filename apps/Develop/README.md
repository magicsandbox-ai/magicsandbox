# magicsandbox.Develop

magicsandbox.Develop helps you create and publish Magic Apps. It includes:

- A code editor to develop and configure your App
- An automated and preconfigured build process using esbuild and Tailwind
- A live preview so you can test your App as you develop
- An AI chat to help with development
- A button for easy publishing

In the code editor, you'll see a `magic.json` file. This is your Magic App JSON described in the [docs](todo). It accepts all of the Magic App keys (`name`, `version`, `script`, etc.) described in the docs, but it also allows some additional keys. magicsandbox.Develop also provides different default values for `html` and `style`.

## magic.json file

This section lists the additional keys in `magic.json` that magicsandbox.Develop supports and details the different default values for `html` and `style`.

### args ({ input: string, budget: number })

### scriptFile (string) (default 'index.js')

Filename containing `script` code, defaults to `index.js`. Editing this file is usually more convenient than editing the `script` key in `magic.json` directly.

### esbuildOptions (object) (default below)

Options to pass to [esbuild](https://esbuild.github.io/api/#build) during the [build process](todo).

The default values below can be overridden, except for `entryPoints`, `write`, and `plugins`:

```javascript
{
  entryPoints: [scriptFile], //cannot be overridden
  write: false, //cannot be overridden
  plugins: [magicsandbox.Develop.customPlugins], //cannot be overridden
  bundle: true,
  globalName: 'app', //assigns exports (i.e. context, api, render) to this global variable
  loader: { '.js': 'jsx' },
  target: 'es2020',
  minify: publishing ? true : false, //true when building for publishing, false when building for live preview
  sourcemap: publishing ? false : true, //false when building for publishing, true when building for live preview
};
```

### html (string) (default '<div id="root"></div>')

Unlike when publishing to Magic Sandbox directly, magicsandbox.Develop provides a default value for `html` if you don't specify `html` or have an `htmlFile`.

### htmlFile (string) (default 'index.html')

Filename containing `html` code, defaults to `index.html`. Editing this file is usually more convenient than editing the `html` key in `magic.json` directly.

### style (string) (default '@tailwind base; @tailwind components; @tailwind utilities;')

Unlike when publishing to Magic Sandbox directly, magicsandbox.Develop provides a default value for `style`, assuming you're using Tailwind if you don't specify `style` or have a `styleFile`.

### styleFile (string) (default 'index.css')

Filename containing `style` code, defaults to `index.css`. Editing this file is usually more convenient than editing the `style` key in `magic.json` directly.

### tailwindConfig (object) (default below)

Options to pass to [Tailwind](https://tailwindcss.com/docs/configuration) during the [build process](todo).

Note that magicsandbox.Develop does not support glob patterns for `content` but instead accepts an array of regex patterns. The default value below will match any file ending in `.js`, `.jsx`, or `.html` and work for most use cases:

```javascript
{
  content: ['.+js$', '.+jsx$', '.+html$'],
};
```

`tailwindConfig` is simply an object, so it doesn't support all of Tailwind's configuration options. Rather than supplying `tailwindConfig` in `magic.json`, you can also create a `tailwind.config.js` file. This enables advanced features like `plugins`, `presets`, and `content.transform` that require the config to be evaluated as JavaScript:

```javascript
import typography from '@tailwindcss/typography';

export default {
  plugins: [typography],
};
```

`tailwindConfig` is not used if `tailwind.config.js` is present.

### dependencies (object)

Version ranges to use for the packages you import. magicsandbox.Develop supports import statements that use [semver ranges](https://github.com/npm/node-semver#versions):

```javascript
import React from 'react@^18';
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

### overrides (object)

Version ranges to use for all imports, enabling you to override the dependencies of your dependencies. If you're familiar with the behavior of `overrides` in npm, note that magicsandbox.Develop currently supports only a subset of the functionality that npm does:

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

### cacheRequests (boolean) (default true)

Whether to cache `requestApp` and `requestFunction` calls, which can save cost when making repeated calls during development. Set to false to disable.

### cdn (string) (default 'esm.sh')

The CDN to use for the build process. Supported values are `esm.sh` and `jsdelivr `.

### optimizedTreeShaking (boolean) (default false)

Whether to further minify the build by tree shaking unused imports, which requires two build passes. This is only supported for `cdn` `esm.sh`.

## Build Process

fetch plugin: jsdelivr, version resolution, allow multiple versions
bundle deps plugin: imports not hoisted or sealed, dynamic imports?
tailwind browser
request handler caveats? author, data? cache, assistant rejecting
how to debug/sourcemaps

### Peer Dependencies

magicsandbox.Develop handles peer dependencies differently than npm. Consider the following dependency graph:

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

magicsandbox.Develop currently takes a simplified approach, assuming a package marked as a peer dependency should only resolve to a single version throughout the tree. It will create the following tree and emit a warning that dep2's and dep3's version ranges for peer@2 are ignored:

```
root
  +-- peer@1
  +-- dep1
  +-- dep2
  +-- dep3
```

This is actually more convenient for peer dependencies like React when you want to ensure only a single version is used globally. However, it may not support more advanced use cases. Please [create an issue](todo) if you have any feedback.
