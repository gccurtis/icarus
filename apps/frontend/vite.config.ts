import { fileURLToPath } from "node:url";

import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  // tailwindcss() before svelte(): the CSS plugin needs to see .svelte files as
  // content sources, which requires it to be registered first.
  plugins: [tailwindcss(), svelte()],

  // Subpath aliases rather than relative paths, matching the backend convention.
  // These must stay in step with `paths` in tsconfig.json — TypeScript resolves
  // one, Vite resolves the other, and nothing checks that they agree.
  resolve: {
    alias: {
      "#style": src("style"),
      "#simple-components": src("simple-components"),
      "#routes": src("routes"),
      "#src": src(""),
    },
  },

  server: {
    port: 3000,
  },
});
