// @ts-check
/// <reference types="node" />
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist/**', 'node_modules/**', 'coverage/**', 'eslint.config.mjs', 'src/generated/**', 'scripts/**']),
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        projectService: {
          // Arquivos de config na raiz fora do `include` do tsconfig.json
          // (`src/**/*.ts`) — `scripts/**` já cai em `globalIgnores` acima.
          allowDefaultProject: ['prisma.config.ts', 'vitest.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{spec,test,e2e-spec}.ts', 'test/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'no-console': ['warn', { allow: ['warn', 'error', 'debug'] }],
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
);
