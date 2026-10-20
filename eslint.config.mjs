import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "eslint.config.mjs",
            "prisma.config.ts",
            "vitest.config.ts",
            "scripts/*.mjs",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      // Mocks (vi.fn()) são passados como valor para expect(...) o tempo
      // todo — não é um unbound method de verdade, é o padrão do Vitest.
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },
  {
    // Scripts utilitários de CLI (não fazem parte do app TS) — console e
    // top-level await são o ponto deles, não um cheiro de código aqui.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
  {
    ignores: ["dist/**", "src/generated/**", "node_modules/**"],
  },
);
