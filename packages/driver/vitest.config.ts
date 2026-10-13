import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The checklist imports the core by package name; tests run it from source.
    alias: { "driver.js": fileURLToPath(new URL("./src/driver.ts", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
  },
});
