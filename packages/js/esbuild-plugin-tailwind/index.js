import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { promises as fs } from "fs";
import path from "path";

async function processTailwind(config, css) {
  const result = await postcss([tailwindcss(config)]).process(
    css || "@tailwind base;@tailwind components;@tailwind utilities;",
    { from: undefined },
  );
  return { processedCss: result.css };
}

function tailwindPlugin(config) {
  return {
    name: "tailwindPlugin",
    setup(build) {
      build.onResolve({ filter: /.+\.css/ }, async (args) => {
        const filepath = path.join(args.resolveDir, args.path);
        return {
          path: filepath,
          namespace: "tailwind",
          watchFiles: [filepath],
        };
      });
      build.onLoad({ filter: /.*/, namespace: "tailwind" }, async (args) => {
        const dir = path.dirname(args.path);
        config.content = config.content || [
          `${dir.replace(/\\/g, "/")}/**/*.js`,
        ];
        const css = await fs.readFile(args.path, "utf-8");
        const { processedCss } = await processTailwind(config, css);
        return {
          contents: processedCss,
          loader: "css",
        };
      });
    },
  };
}

export { tailwindPlugin, processTailwind };
