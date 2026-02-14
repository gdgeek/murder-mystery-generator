import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default [
  // Ignore patterns (must be first)
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.test.ts', '**/*.pbt.test.ts'],
  },
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
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
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
      'no-redeclare': 'warn',
      'no-undef': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'eqeqeq': ['warn', 'smart'],
    },
  },
];
