// @ts-check
import base from './base.mjs';

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...base,
  {
    languageOptions: {
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
      },
    },
  },
];
