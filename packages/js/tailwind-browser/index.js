import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

/**
 * Run tailwind in the browser
 * @param config - tailwind config object
 * @param content - optional content that will override content in config. should be of the format [{raw, extension}]
 * @param css - optional string of css to process
 * @return processed css string
 */
export default async function processTailwindBrowser(config, css) {
  const result = await postcss([tailwindcss(config)]).process(
    css || '@tailwind base;@tailwind components;@tailwind utilities;',
    { from: undefined }
  );
  const classMap = {};
  postcss.parse(result.css).walkRules(/^\./, (rule) => {
    classMap[rule.selector.trim().slice(1)] = rule.toString();
  });
  return { processedCss: result.css, classMap };
}

//todo duplicated in tailwindPlugin
