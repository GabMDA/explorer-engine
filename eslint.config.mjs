// ESLint flat config (P0-T2). Style + syntactic architecture guardrails.
// Enforces (chapter 15, ENGINE_CONSTITUTION):
//   - encapsulation: no deep imports into another package's internals;
//   - L9 headless core: core/plugin-sdk/schema must not import three or a UI framework.
// The acyclic-graph invariant (L10) is enforced separately and reliably by
// dependency-cruiser (see .dependency-cruiser.cjs; wired into `npm run lint`).
// Style/format conflicts are disabled by eslint-config-prettier (kept last).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    // `public/**` holds vendored decoder assets (minified UMD/WASM) that must not
    // be linted or reformatted (P2-T3).
    ignores: ['**/node_modules/**', '**/dist/**', '**/public/**', '**/*.md', 'package-lock.json'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Encapsulation — a package is imported only via its public entry, never a deep path.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@explorer-engine/*/*'],
              message:
                'Deep import forbidden: import a package only via its public entry (@explorer-engine/<pkg>).',
            },
          ],
        },
      ],
    },
  },
  {
    // L9 — the headless core must not depend on three or a UI framework.
    files: ['packages/core/**', 'packages/plugin-sdk/**', 'packages/schema/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three', 'three/*'],
              message: 'Headless core must not import three (only renderer-three may).',
            },
            {
              group: ['react', 'react-dom', 'vue', '@angular/*', 'svelte', 'lit', 'lit/*'],
              message: 'Headless core must not import a UI framework.',
            },
            {
              group: ['@explorer-engine/*/*'],
              message: 'Deep import forbidden: use the public entry (@explorer-engine/<pkg>).',
            },
          ],
        },
      ],
    },
  },
  {
    // Node tooling scripts and config files (ESM): allow Node globals.
    files: ['scripts/**/*.mjs', 'eslint.config.mjs', '**/*.config.*'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', URL: 'readonly', Buffer: 'readonly' },
    },
  },
  {
    // CommonJS tooling config files (e.g. .dependency-cruiser.cjs).
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        module: 'readonly',
        require: 'readonly',
        exports: 'writable',
        __dirname: 'readonly',
        process: 'readonly',
        console: 'readonly',
      },
    },
  },
  prettier,
);
