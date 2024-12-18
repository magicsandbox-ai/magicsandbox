Magic Sandbox development and publishing utilities

`npm install "@magicsandbox.ai/dev"`

Add the following to your `package.json`:

```json
"scripts": {
  "dev": "magicsandbox dev",
  "publish": "magicsandbox publish"
}
```

Then running `npm run dev MyApp` will start a local server with hot reloading.

Running `npm run publish MyApp` will build and publish your App.
