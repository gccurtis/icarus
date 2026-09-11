import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = resolve(import.meta.dirname);
const repository = resolve(root, "..");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@app-styles": resolve(repository, "app", "src", "lib", "styles"),
      "@app-src": resolve(repository, "app", "src")
    }
  },
  server: {
    fs: {
      allow: [repository]
    }
  }
});
