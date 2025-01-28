import globals from "globals";
import { globals as magicSandboxGlobals } from "@magicsandbox.ai/dev";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";

export default {
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
      version: "detect",
    },
  },
};
