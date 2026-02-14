import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default [
  // TypeScript files
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ['packages/*/src/**/*.ts'],
  })),
  {
    files: ['packages/*/src/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  // Browser JS (UI)
  {
    files: ['packages/server/src/routes/ui/**/*.js'],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'no-redeclare': 'error',
      'no-undef': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'eqeqeq': ['warn', 'smart'],
    },
  },
  // Ignore patterns
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.test.ts', '**/*.pbt.test.ts'],
  },
];
