import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/figma-import/**"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@leaklens/security",
              message: "apps/web is a browser client and cannot import Node-specific @leaklens/security.",
            },
            {
              name: "@leaklens/detectors",
              message:
                "apps/web is a browser client and cannot import @leaklens/detectors directly; use @leaklens/shared or apps/web/src/lib/api.",
            },
          ],
          patterns: [
            {
              group: ["**/packages/security/**", "**/packages/detectors/**"],
              message: "apps/web cannot import backend security or detector packages.",
            },
          ],
        },
      ],
    },
  },
];
