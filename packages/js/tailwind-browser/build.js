import * as esbuild from "esbuild";
import fs from "fs";

/*
cd packages/js/tailwind-browser
node build.js
*/

const preflightCss = fs.readFileSync(
  "./node_modules/tailwindcss/src/css/preflight.css",
  "utf8",
);

const replacePlugin = {
  name: "replace-fs-readFileSync",
  setup(build) {
    build.onLoad({ filter: /corePlugins\.js$/ }, async (args) => {
      let contents = await fs.promises.readFile(args.path, "utf8");
      contents = contents.replace(
        `_fs.default.readFileSync(_path.join(__dirname, "./css/preflight.css"), "utf8")`,
        JSON.stringify(preflightCss),
      );
      return {
        contents,
        loader: "js",
      };
    });
  },
};

await esbuild.build({
  entryPoints: ["index.js"],
  bundle: true,
  loader: { ".js": "jsx" },
  alias: {
    fs: "./dummy.js",
    path: "./dummy.js",
    url: "./dummy.js",
    crypto: "./dummy.js",
    jiti: "./dummy.js",
    "jiti/dist/babel.js": "./dummy.js",
    os: "./dummy.js",
    stream: "./dummy.js",
    "glob-parent": "./dummy.js",
    "fast-glob": "./dummy.js",
    util: "./dummy.js",
  },
  plugins: [replacePlugin],
  outfile: "dist/index.js",
  minify: true,
  format: "esm",
});
