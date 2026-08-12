import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // tailwindcss() before sveltekit(): the CSS plugin needs to see .svelte files
  // as content sources, which requires it to be registered first.
  plugins: [tailwindcss(), sveltekit()],

  server: {
    port: 3000,
  },
});
