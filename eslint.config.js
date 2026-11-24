import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'max-params': ['warn', 4],
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Beroenderegeln i SPEC.md avsnitt 14: kärnan känner inte till domäner, appen eller React/three.js.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/domains/**', '**/app/**'], message: 'core får inte importera från domains eller app.' },
            { group: ['react', 'react-*', 'three', 'three/*', '@react-three/*'], message: 'core är ren TypeScript utan React och three.js.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/domains/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/app/**'], message: 'domains får bara importera från core.' }] },
      ],
    },
  },
);
