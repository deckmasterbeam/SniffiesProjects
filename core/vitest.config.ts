import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "text-loader",
      transform(_code: string, id: string) {
        if (id.endsWith(".html") || id.endsWith(".css")) {
          return `export default ${JSON.stringify(readFileSync(id, "utf-8"))}`;
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@core": resolve(dirname(fileURLToPath(import.meta.url)), "src"),
    },
  },
  define: {
    __DEBUG__: "false",
  },
  test: {
    environment: "jsdom",
  },
});
