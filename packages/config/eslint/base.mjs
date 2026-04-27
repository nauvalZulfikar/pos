// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/** @type {import("eslint").Linter.Config[]} */
export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "TSAsExpression[typeAnnotation.typeName.name!='const']",
          message:
            "Avoid `as` casts in business logic. Use Zod parse at trust boundaries; use type guards otherwise.",
        },
      ],
    },
  },
  {
    ignores: ['dist/**', 'build/**', '.next/**', '.turbo/**', 'node_modules/**', 'coverage/**'],
  },
];
