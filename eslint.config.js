import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import importX from "eslint-plugin-import-x";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import unusedImports from "eslint-plugin-unused-imports";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cdk.out/**",
      "**/*.tsbuildinfo",
      "infra/cdk/**/*.js",
      "infra/cdk/**/*.d.ts",
      "infra/cdk/**/*.js.map",
      "infra/cdk/**/*.d.ts.map",
      "!eslint.config.js",
      "!prettier.config.js",
    ],
  },

  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,vue}"],
    ...js.configs.recommended,
  },

  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.{ts,mts,cts,vue}"],
  })),
  {
    files: ["**/*.{ts,mts,cts,vue}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".vue"],
      },
    },
  },

  ...pluginVue.configs["flat/recommended"].map((config) => ({
    ...config,
    files: ["apps/frontend/**/*.vue"],
  })),
  {
    files: ["apps/frontend/**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".vue"],
      },
    },
  },

  {
    files: ["**/*.{ts,mts,cts,vue}"],
    ...importX.flatConfigs.recommended,
  },
  {
    files: ["**/*.{ts,mts,cts,vue}"],
    ...importX.flatConfigs.typescript,
    settings: {
      ...importX.flatConfigs.typescript.settings,
      "import-x/resolver-next": [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          project: [
            "apps/frontend/tsconfig.app.json",
            "apps/frontend/tsconfig.node.json",
            "apps/backend/tsconfig.json",
            "infra/cdk/tsconfig.json",
          ],
        }),
      ],
    },
  },

  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,vue}"],
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },

  {
    files: ["apps/frontend/**/*.{ts,vue}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: [
      "apps/backend/**/*.ts",
      "infra/cdk/**/*.ts",
      "**/*.config.{js,ts,mjs,cjs}",
      "eslint.config.js",
      "prettier.config.js",
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  {
    files: ["**/*.{js,mjs,cjs}"],
    ...tseslint.configs.disableTypeChecked,
  },

  prettier,
);
