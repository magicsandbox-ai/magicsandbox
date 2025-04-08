import postcss from "postcss";
import tailwindcss from "tailwindcss";

export default async function processTailwindBrowser(config, css) {
  const result = await postcss([tailwindcss(config)]).process(
    css || "@tailwind base;@tailwind components;@tailwind utilities;",
    { from: undefined },
  );
  const classMap = {};
  addToClassMap(result.css, classMap);
  if (css?.includes("@apply")) {
    //@apply utility classes may not be in classMap
    //so we'll parse the original CSS to find all the @apply utility classes
    //then create a fake config with those classes and process it
    //then parse the result to add them to classMap
    const appliedClasses = new Set();
    postcss.parse(css || "").walkAtRules("apply", (atRule) => {
      atRule.params.split(/\s+/).forEach((className) => {
        className = className.trim().replace(/^!/, "");
        if (className) {
          appliedClasses.add(className);
        }
      });
    });
    const fakeConfig = {
      content: [
        {
          raw: `"${Array.from(appliedClasses).join(" ")}"`,
          extension: "js",
        },
      ],
    };
    const fakeResult = await postcss([tailwindcss(fakeConfig)]).process(
      "@tailwind utilities;",
      { from: undefined },
    );
    addToClassMap(fakeResult.css, classMap);
  }
  return { processedCss: result.css, classMap };
}

function addToClassMap(css, classMap) {
  postcss.parse(css).walkRules(/^\./, (rule) => {
    const modifiers = rule.selector.trim().slice(1).split(":");
    const cssProps = rule.nodes
      .map((node) => `${node.prop}: ${node.value};`)
      .join("\n");
    if (cssProps) {
      classMap[modifiers[Math.floor(modifiers.length / 2)]] = cssProps;
    }
  });
}
