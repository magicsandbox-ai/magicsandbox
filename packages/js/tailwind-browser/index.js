import postcss from "postcss";
import tailwindcss from "tailwindcss";

export default async function processTailwindBrowser(config, css) {
  const result = await postcss([tailwindcss(config)]).process(
    css || "@tailwind base;@tailwind components;@tailwind utilities;",
    { from: undefined },
  );
  const classMap = {};
  postcss.parse(result.css).walkRules(/^\./, (rule) => {
    classMap[rule.selector.trim().slice(1)] = rule.toString();
  });
  return { processedCss: result.css, classMap };
}
