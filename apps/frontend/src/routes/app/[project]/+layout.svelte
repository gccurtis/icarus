<script lang="ts">
  import type { Snippet } from "svelte";

  import { page } from "$app/state";

  import { initClientModel } from "$model/client";
  import ContextPanel from "$lib/shell/context/context-panel.svelte";
  import Inspector from "$lib/shell/inspector.svelte";
  import Status from "$lib/shell/status.svelte";
  import Tabstrip from "$lib/shell/tabstrip.svelte";
  import Topbar from "$lib/shell/topbar.svelte";

  /**
   * The application shell. Everything under /app renders inside it.
   *
   * A layout at this depth persists across navigation between its children —
   * it does not remount — which is the whole reason the app lives beneath a
   * route rather than at the origin. Tab state, panel sizing, and selection
   * will need somewhere to survive a route change, and this is it.
   *
   * The frame is static for now: zones exist and hold their geometry, but
   * nothing resizes, collapses, or responds to selection yet — the panel
   * components will own the drag and its bounds when they are wired.
   *
   * This layout owns the client instance, so it is the one place that calls
   * `initClientModel`. The project comes from the route: a client instance acts
   * on exactly one project for its whole life, and switching projects is a full
   * page load rather than a client-side navigation — this script would not
   * re-run otherwise, and the model would go on serving the previous project's
   * workbench.
   *
   * That makes `data-sveltekit-reload` on every project link load-bearing rather
   * than cautious: it is the only thing that runs this script again, so a link
   * that omits it produces a shell pointed at one project and a model still
   * holding another. See lib/model/client/client.md.
   *
   * The two panel widths come from the active tab rather than being declared in
   * the stylesheet, so there is one source of truth per dimension.
   */
  let { children }: { children: Snippet } = $props();

  const { workbench } = initClientModel({ project: page.params.project ?? "" });
</script>

<div
  class="shell"
  style:--shell-context="calc(var(--shell-rail) + {workbench.panels.contextWidth}px)"
  style:--shell-inspector="{workbench.panels.inspectorWidth}px"
>
  <Topbar />
  <Tabstrip />
  <ContextPanel />
  <main class="work">
    {@render children()}
  </main>
  <Inspector />
  <Status />
</div>

<style>
  /**
   * Shell geometry. These are the numbers the design system used to carry as
   * --spacing-topbar and friends; they were removed from it for naming an
   * application rather than a dimension. The shell IS that application, so it
   * owns them — declared here off the one unit the system provides, and
   * inherited by every zone component through the DOM.
   *
   * Context and inspector had one shared token, on the reasoning that two names
   * for a single dimension is what lets them drift. That was right about the
   * risk and wrong about the dimension: the context panel is rail + content and
   * the inspector is its whole width, so 320 was two numbers that happened to
   * coincide by arithmetic. They diverge the moment either is dragged.
   */
  .shell {
    --shell-topbar: calc(var(--token-spacing-unit) * 11); /* 44px */
    --shell-tabstrip: calc(var(--token-spacing-unit) * 9); /* 36px */
    /* Seeds only. Both are overridden inline from the workbench above; these are
     * what paints if that ever fails, and they are why the grid never collapses
     * to zero on a first frame. */
    --shell-context: calc(var(--token-spacing-unit) * 80); /* 44 rail + 276 content */
    --shell-inspector: calc(var(--token-spacing-unit) * 80); /* 320px */
    --shell-rail: calc(var(--token-spacing-unit) * 11); /* 44px — inside the context panel */
    --shell-status: calc(var(--token-spacing-unit) * 6); /* 24px */

    display: grid;
    grid-template-rows:
      var(--shell-topbar)
      var(--shell-tabstrip)
      1fr
      var(--shell-status);
    grid-template-columns: var(--shell-context) 1fr var(--shell-inspector);
    grid-template-areas:
      "topbar   topbar topbar"
      "tabstrip tabstrip tabstrip"
      "context  work   inspector"
      "status   status status";

    /* The shell owns the viewport; each zone scrolls within itself rather than
     * the page scrolling as a whole. */
    height: 100vh;
    overflow: hidden;
    background-color: var(--token-surface-canvas);
  }

  /* The work surface is sacred: it gets the generous plane, and it is the only
   * region the route controls. */
  .work {
    grid-area: work;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    background-color: var(--token-surface-work);
    color: var(--token-ink-primary);
  }
</style>
