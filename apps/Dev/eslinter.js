import { esLint } from "@codemirror/lang-javascript";
import { Linter } from "./node_modules/eslint/lib/linter/linter.js";
import { linter } from "@codemirror/lint";
import globals from "globals";
import { globals as magicSandboxGlobals } from "@magicsandbox.ai/dev/browser";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";

//https://github.com/eslint/eslint/issues/18715

export default function eslinter() {
  const config = {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...magicSandboxGlobals,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react: pluginReact,
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...pluginReact.configs.recommended.rules,
      "react/prop-types": "off",
    },
    settings: {
      react: {
        version: "999.999.999", //setting this to 'detect' requires 'fs' and will break in the browser
      },
    },
  };
  return linter(esLint(new Linter({ configType: "flat" }), config));
}
