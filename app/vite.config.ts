import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
// `defineConfig` from vitest/config rather than vite: the `test` block below
// is vitest's, and Vite's own config type does not know about it.
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tailwindcss() before sveltekit(): the CSS plugin needs to see .svelte files
  // as content sources, which requires it to be registered first.
  plugins: [tailwindcss(), sveltekit()],

  server: {
    port: 3000,
    // The represented store persists runtime writes beside the app in
    // `data/*.json`. Those writes are application state, not source changes;
    // watching them reloads the whole workspace in the middle of commands such
    // as Create resource or Add comment.
    watch: {
      ignored: ["**/data/**"],
    },
  },

  // Tests reuse this config, which is the whole reason they run under vitest
  // rather than `node --test`: `$model` and `$lib` resolve here and nowhere
  // else. Node resolves package.json "imports", whose keys must begin with `#`.
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",

    // SvelteKit's server-only guard blocks any import of a `*.server.ts` file
    // from client-reachable code, and checks for exactly this variable to stand
    // down. Without it a test importing a server module trips the guard.
    env: {
      TEST: "true",
    },
  },
});
