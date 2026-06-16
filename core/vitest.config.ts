import { readFileSync } from "node:fs";
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
  test: {
    environment: "jsdom",
  },
});
