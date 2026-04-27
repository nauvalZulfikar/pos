// @ts-check
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import base from './base.mjs';

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...base,
  {
    files: ['**/*.{ts,tsx,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-uses-react': 'off',
    },
  },
];
