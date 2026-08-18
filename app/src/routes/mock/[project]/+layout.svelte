<script lang="ts">
  import type { Snippet } from "svelte";

  import { setupConvex } from "convex-svelte";
  import { PUBLIC_CONVEX_URL } from "$env/static/public";
  import { page } from "$app/state";

  import { initClientModel } from "$model/client";

  /**
   * Mocks — surfaces that exercise one thing without the application frame
   * around it.
   *
   * This is a second client instance root, and the only one besides
   * `/app/[project]`. It stands up exactly what a client instance needs — a
   * Convex client and a client model keyed to the route's project — and renders
   * whatever page asked for it, with no frame, no tabs, and no panels.
   *
   * The duplication with the application layout is the point rather than an
   * oversight. A mock that reached into `/app` to borrow its instance would stop
   * being able to run on its own, which is the one property it exists to have;
   * and standing a graph up from a second place is a live check that
   * `buildClientModel` depends on nothing but its input.
   *
   * The project token comes from the route, so a mock reads and writes the same
   * project — and the same browser store — as the application does. That is
   * deliberate: a value set here is visible at `/app/[project]` on reload.
   */
  let { children }: { children: Snippet } = $props();

  /**
   * The mock's own settings, as a literal rather than from a server load.
   *
   * Deliberate, and the same argument the duplication above rests on: a mock
   * that reached for the application's published configuration would stop being
   * able to run on its own. Fixed values also make a mock deterministic, which
   * is most of what a mock is for.
   *
   * These need to hold every key a client object requires at construction. When
   * one is missing, `requiredNumber` says which and names where it comes from.
   */
  const configuration = {
    revisions: { changeSets: { flushAfterOps: 50, flushAfterMs: 2000 } }
  };

  setupConvex(PUBLIC_CONVEX_URL);

  initClientModel({ project: page.params.project ?? "", configuration });
</script>

{@render children()}
