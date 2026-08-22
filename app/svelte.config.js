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
      $convex: "src/convex",
      "$json-store": "src/lib/json-store",
      $model: "src/lib/model",
      $views: "src/lib/views",

      // The four panel trees, one per surface the specifications describe.
      // `docs/screen-panel-views` is their source of truth: a context view and an
      // inspector lens are vertical stacks of panel components, a workspace and a
      // modal are grids of screen components.
      $context: "src/lib/context",
      $inspector: "src/lib/inspector",
      $workspaces: "src/lib/workspaces",
      $modals: "src/lib/modals",

      // Stand-ins for the doors the panels read and the store does not answer
      // yet. Shaped like the real thing — the same `current` / `error` / `refresh`
      // handle `$json-store/client` returns — so replacing one is an import
      // change rather than a rewrite.
      //
      // There was a `$mock-models` beside this. It is gone: what a panel needed
      // from it is now `$model/client/view-state`, which is the real object.
      "$mock-capabilities": "src/lib/mock-capabilities",

      $access: "src/lib/capabilities/access",
      $content: "src/lib/capabilities/content",
      $messages: "src/lib/capabilities/messages",
      $revisions: "src/lib/capabilities/revisions",
      $settings: "src/lib/capabilities/settings",
      $shared: "src/lib/capabilities/shared",
    },
  },
};
