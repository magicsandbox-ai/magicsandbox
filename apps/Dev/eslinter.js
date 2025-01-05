import { esLint } from '@codemirror/lang-javascript';
import { Linter } from 'node_modules/eslint/lib/linter/linter.js';
import { linter } from '@codemirror/lint';
import globals from 'globals';
import pluginJs from '@eslint/js';
import pluginReact from 'eslint-plugin-react';

export default function eslinter() {
  const config = {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
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
      'react/prop-types': 'off',
    },
    settings: {
      react: {
        version: '999.999.999', //setting this to 'detect' requires 'fs' and will break in the browser
      },
    },
  };
  return linter(esLint(new Linter({ configType: 'flat' }), config));
}
