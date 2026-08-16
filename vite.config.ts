import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [dts({ include: ["src"], entryRoot: "src", rollupTypes: true })],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
    },
    rollupOptions: {
      external: ["@adobe/aio-lib-state", "openwhisk", "hono", "node:crypto"],
    },
    sourcemap: true,
  },
  test: {
    environment: "node",
    globals: true,
  },
});
