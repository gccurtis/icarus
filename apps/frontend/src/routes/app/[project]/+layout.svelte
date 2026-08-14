<script lang="ts">
  import type { Snippet } from "svelte";

  import { clientRuntime } from "$runtime/client";
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
   * The two panel widths come from preferences rather than being declared in
   * the stylesheet, so there is one source of truth per dimension. Reaching the
   * runtime here is safe because this route sets `ssr = false` — the accessor
   * throws outside the browser by design. See lib/runtime/client/client.md.
   */
  let { children }: { children: Snippet } = $props();

  const { preferences } = clientRuntime();
</script>

<div
  class="shell"
  style:--shell-context="calc(var(--shell-rail) + {preferences.panels.contextWidth}px)"
  style:--shell-inspector="{preferences.panels.inspectorWidth}px"
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
    --shell-topbar: calc(var(--spacing) * 11); /* 44px */
    --shell-tabstrip: calc(var(--spacing) * 9); /* 36px */
    /* Seeds only. Both are overridden inline from preferences above; these are
     * what paints if that ever fails, and they are why the grid never collapses
     * to zero on a first frame. */
    --shell-context: calc(var(--spacing) * 80); /* 44 rail + 276 content */
    --shell-inspector: calc(var(--spacing) * 80); /* 320px */
    --shell-rail: calc(var(--spacing) * 11); /* 44px — inside the context panel */
    --shell-status: calc(var(--spacing) * 6); /* 24px */

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
    background-color: var(--surface-canvas);
  }

  /* The work surface is sacred: it gets the generous plane, and it is the only
   * region the route controls. */
  .work {
    grid-area: work;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    background-color: var(--surface-work);
    color: var(--ink-primary);
  }
</style>
