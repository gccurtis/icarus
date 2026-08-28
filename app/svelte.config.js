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

    // Remote functions are how a view reaches a capability. A `<function>.remote.ts`
    // exports `query`/`command`/`form`, kit generates the client stub and the
    // endpoint, and the view calls what looks like a plain async function. Without
    // this flag those exports compile to nothing and the call fails at runtime, so
    // it has to be on before the first capability arrives rather than with it.
    //
    // Still flagged experimental upstream, which is a statement about the API's
    // stability, not its correctness. The blast radius is the `.remote.ts` files
    // themselves — a change there does not reach `api/`, because a remote wrapper
    // holds no logic.
    experimental: {
      remoteFunctions: true,
    },

    // One alias per tree that code reaches across; `$lib` is built in.
    // Per-capability aliases arrive with their capabilities — an alias map full
    // of forward declarations pointing at nothing is exactly the rot the lint's
    // resolve check exists to prevent.
    //
    // SvelteKit generates .svelte-kit/tsconfig.json paths from this, so the
    // compiler and the bundler cannot drift. There is no second map to keep in
    // step, which is a rule the backend needed and this does not.
    alias: {
      $capabilities: "src/lib/capabilities",
      $components: "src/lib/components",
      $model: "src/lib/model",
      $representation: "src/lib/representation",
      $runtime: "src/lib/runtime",
      $views: "src/lib/views",

      // Three trees inside views/ that are reached by name rather than through
      // `$views`, because a panel is not a view: it knows only its doors, which
      // is what lets it render in a gallery, in a test, or on a screen it was
      // not written for. `docs/screen-panel-views` is their source of truth.
      $panels: "src/lib/views/panels",
      $workspaces: "src/lib/views/workspaces",
      $modals: "src/lib/views/modals",

      // No `$development`. Nothing may import a development surface, so an
      // alias pointing at one would be an invitation.
      //
      // No alias for the vendored components either: `components.json` points
      // the shadcn CLI at `$lib/components/vendor`, and it rewrites those
      // imports in its own files on every regeneration. That spelling is the
      // one documented exception rather than a tree we forgot.
    },
  },
};
