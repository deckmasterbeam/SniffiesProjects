import tsParser from "@typescript-eslint/parser";

const RELATIVE = "^\\.{1,2}(/|$)";
// An esquery regex literal can't contain a slash, so the selectors match it as \x2F.
const RELATIVE_IN_SELECTOR = "^\\.{1,2}(\\x2F|$)";
const MESSAGE =
  "Use an absolute import (@core/, @client/, @userscript/ or @bookmarklet/), not a relative one.";

export default [
  { ignores: ["**/node_modules/**", "**/dist/**"] },
  {
    files: ["{core,client,userscript,bookmarklet}/src/**/*.ts"],
    languageOptions: { parser: tsParser },
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ regex: RELATIVE, message: MESSAGE }] }],
      // `no-restricted-imports` doesn't see dynamic imports or `import("...")` types.
      "no-restricted-syntax": [
        "error",
        { selector: `ImportExpression[source.value=/${RELATIVE_IN_SELECTOR}/]`, message: MESSAGE },
        {
          selector: `TSImportType[argument.literal.value=/${RELATIVE_IN_SELECTOR}/]`,
          message: MESSAGE,
        },
      ],
    },
  },
];
