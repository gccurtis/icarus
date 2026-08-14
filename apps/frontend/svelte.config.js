import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/**
 * Svelte 5 + SvelteKit. `vitePreprocess` is what lets `<script lang="ts">` work
 * inside components — it hands the block to Vite's esbuild transform, which
 * strips types without checking them. Type *checking* is `pnpm typecheck`
 * (svelte-check), not the build.
 *
 * `adapter-node` rather than `adapter-static`: a static build cannot run server
 * code at all, and everything from Phase 3 onward runs on the server. The build
 * output is a Node server at `build/index.js`.
 */
export default {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter(),

    // One alias per tree that code reaches across; `$lib` is built in.
    // Per-capability aliases arrive with their capabilities — an alias map full
    // of forward declarations pointing at nothing is exactly the rot the lint's
    // resolve check exists to prevent.
    //
    // SvelteKit generates .svelte-kit/tsconfig.json paths from this, so the
    // compiler and the bundler cannot drift. There is no second map to keep in
    // step, which is a rule the backend needed and this does not.
    alias: {
      $runtime: "src/lib/runtime",
    },
  },
};
