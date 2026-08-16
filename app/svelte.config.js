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
      $model: "src/lib/model",
      $views: "src/lib/views",
      $access: "src/lib/capabilities/access",
      $activity: "src/lib/capabilities/activity",
      $comments: "src/lib/capabilities/comments",
      $content: "src/lib/capabilities/content",
      "$derived-outputs": "src/lib/capabilities/derived-outputs",
      $documents: "src/lib/capabilities/documents",
      "$external-files": "src/lib/capabilities/external-files",
      $findings: "src/lib/capabilities/findings",
      $formula: "src/lib/capabilities/formula",
      $hypotheses: "src/lib/capabilities/hypotheses",
      $knowledge: "src/lib/capabilities/knowledge",
      $messages: "src/lib/capabilities/messages",
      "$name-manager": "src/lib/capabilities/name-manager",
      "$persona-threads": "src/lib/capabilities/persona-threads",
      $personas: "src/lib/capabilities/personas",
      $questions: "src/lib/capabilities/questions",
      "$research-links": "src/lib/capabilities/research-links",
      "$research-threads": "src/lib/capabilities/research-threads",
      "$resource-sets": "src/lib/capabilities/resource-sets",
      $revisions: "src/lib/capabilities/revisions",
      $settings: "src/lib/capabilities/settings",
      "$slide-decks": "src/lib/capabilities/slide-decks",
      $spreadsheets: "src/lib/capabilities/spreadsheets",
      $templates: "src/lib/capabilities/templates",
      $shared: "src/lib/capabilities/shared",
    },
  },
};
