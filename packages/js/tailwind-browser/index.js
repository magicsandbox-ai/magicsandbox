import postcss from "postcss";
import tailwindcss from "tailwindcss";

export default async function processTailwindBrowser(config, css) {
  const result = await postcss([tailwindcss(config)]).process(
    css || "@tailwind base;@tailwind components;@tailwind utilities;",
    { from: undefined },
  );
  const classMap = {};
  postcss.parse(result.css).walkRules(/^\./, (rule) => {
    const modifiers = rule.selector.trim().slice(1).split(":");
    const cssProps = rule.nodes
      .map((node) => `${node.prop}: ${node.value};`)
      .join("\n");
    if (cssProps) {
      classMap[modifiers[Math.floor(modifiers.length / 2)]] = cssProps;
    }
  });
  return { processedCss: result.css, classMap };
}
