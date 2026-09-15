import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { ROOT_DIR } from "../scripts/const.mjs";

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
      "@sniffies-projects/core": resolve(ROOT_DIR, "core/src/index.ts"),
    },
  },
  define: {
    __DEBUG__: "false",
    __SERVER_BASE__: JSON.stringify(""),
    __CLIENT_SECRET__: JSON.stringify(""),
    __FAVORITES_NOTIFICATIONS_ENABLED__: "false",
    __REPORTING_ENABLED__: "false",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
