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
  },
};
