import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/**
 * Svelte 5. `vitePreprocess` is what lets `<script lang="ts">` work inside
 * components — it hands the block to Vite's esbuild transform, which strips
 * types without checking them. Type *checking* is `pnpm typecheck`
 * (svelte-check), not the build.
 */
export default {
  preprocess: vitePreprocess(),
};
