import js from '@eslint/js';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist/', 'coverage/', 'node_modules/', '.claude/', 'ios/', 'android/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Determinism: sim code must draw randomness from world.rng.
    files: ['src/sim/**/*.ts', 'src/game/**/*.ts', 'src/content/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use world.rng; the sim must be seeded.' },
      ],
    },
  },
  {
    files: ['*.config.{js,ts}', 'tests/**/*.ts', 'tools/pwa/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);
