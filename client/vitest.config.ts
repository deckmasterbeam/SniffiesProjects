import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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
      "@sniffies-projects/core": resolve(root, "core/src/index.ts"),
    },
  },
  define: {
    __DEBUG__: "false",
    __SERVER_BASE__: JSON.stringify(""),
    __CLIENT_SECRET__: JSON.stringify(""),
    __FAVORITES_NOTIFICATIONS_ENABLED__: "false",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
