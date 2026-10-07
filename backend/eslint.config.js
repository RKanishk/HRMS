import js from '@eslint/js';
import ts from 'typescript-eslint';
const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  structuredClone: 'readonly',
};
export default ts.config(js.configs.recommended, ...ts.configs.recommended, {
  ignores: ['dist/**', 'test-dist/**', 'node_modules/**', 'src/generated/**'],
}, {
  files: ['**/*.ts'],
  languageOptions: { globals: nodeGlobals },
  rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }], '@typescript-eslint/no-explicit-any': 'error' },
}, {
  files: ['scripts/**/*.mjs'],
  languageOptions: { globals: nodeGlobals },
}, {
  files: ['src/common/input.pipe.ts', 'src/documents/documents.service.ts'],
  rules: { 'no-control-regex': 'off' },
});
