import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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
      "@core": resolve(root, "core/src"),
      "@icons": resolve(root, "client/icons"),
      "@bookmarklet": resolve(root, "bookmarklet/src"),
    },
  },
  define: {
    __DEBUG__: "false",
    __VERSION__: JSON.stringify("0.0.0-test"),
    __SERVER_BASE__: JSON.stringify("https://server.example"),
    __CLIENT_SECRET__: JSON.stringify("test-secret"),
  },
  test: {
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "https://sniffies.com/" } },
  },
});
