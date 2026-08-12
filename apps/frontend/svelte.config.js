import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/**
 * Svelte 5 + SvelteKit. `vitePreprocess` is what lets `<script lang="ts">` work
 * inside components — it hands the block to Vite's esbuild transform, which
 * strips types without checking them. Type *checking* is `pnpm typecheck`
 * (svelte-check), not the build.
 *
 * No `kit.alias` entries: `$lib` is built in and points at `src/lib`, which is
 * the only alias the frontend needs today. Anything added here generates its
 * own TypeScript path in `.svelte-kit/tsconfig.json`, so the aliases can no
 * longer drift out of step with the compiler the way the hand-written pair in
 * vite.config.ts and tsconfig.json could.
 */
export default {
  preprocess: vitePreprocess(),

  kit: {
    // `fallback` is what makes this a SPA rather than a prerendered site: every
    // unmatched path is served index.html and resolved on the client, so a deep
    // link survives a refresh with no server rewrite rule.
    adapter: adapter({ fallback: "index.html" }),
  },
};
