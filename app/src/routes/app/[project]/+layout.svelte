<script lang="ts">
  import type { Snippet } from "svelte";

  import { setupConvex } from "convex-svelte";
  import { PUBLIC_CONVEX_URL } from "$env/static/public";
  import { page } from "$app/state";

  import { initClientModel } from "$model/client";
  import type { LayoutServerData } from "./$types";

  /**
   * The client instance. Everything under /app runs inside the one this builds.
   *
   * A layout at this depth persists across navigation between its children — it
   * does not remount — which is the whole reason the application lives beneath a
   * route rather than at the origin. Tab state, panel sizing, and selection need
   * somewhere to survive a route change, and this is it.
   *
   * This layout owns the instance, so it is the one place that calls
   * `initClientModel`. The project comes from the route: a client instance acts
   * on exactly one project for its whole life, and switching projects is a full
   * page load rather than a client-side navigation — this script would not
   * re-run otherwise, and the model would go on serving the previous project's
   * workbench.
   *
   * That makes `data-sveltekit-reload` on every project link load-bearing rather
   * than cautious: it is the only thing that runs this script again, so a link
   * that omits it produces a frame pointed at one project and a model still
   * holding another. See lib/model/client/client.md.
   *
   * `setupConvex` belongs here rather than in the root layout for the same
   * reason `initClientModel` does: both build something that lives as long as
   * one client instance, and this route is the only one that has one. It also
   * keeps the Convex client out of server rendering entirely — `+layout.ts` sets
   * `ssr = false` — so `/` and `/demo` are untouched by it.
   *
   * It renders nothing itself. The frame is `$views/app`, composed by the page
   * below, and this file holds no markup and no CSS so that lifetime and
   * appearance stay separable.
   */
  let { children, data }: { children: Snippet; data: LayoutServerData } = $props();

  setupConvex(PUBLIC_CONVEX_URL);

  // `data.configuration` is the allowlisted slice of the YAML, from
  // `+layout.server.ts`. It is handed in rather than fetched because the objects
  // below read their tuned values while they are being constructed.
  //
  // Reading the initial value is exactly right here, which is what the ignore
  // says: this script runs once per client instance, and a later `data` would
  // mean a project switch — which is a full page load, not a reactive update.
  // svelte-ignore state_referenced_locally
  const model = initClientModel({
    project: page.params.project ?? "",
    configuration: data.configuration
  });

  /**
   * The instance ends with the layout that owns it.
   *
   * This is the release hook `client.md` names: nothing between the root and a
   * leaf decides when an object ends, and `close()` releases in reverse
   * construction order. Today that means every open resource submits what it has
   * buffered on the way out — disposal is never a silent discard.
   */
  $effect(() => () => model.close());
</script>

{@render children()}
