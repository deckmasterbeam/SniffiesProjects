import { defineConfig } from "vitest/config";

export default defineConfig({
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
