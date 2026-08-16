<script lang="ts">
  import { clientModel } from "$model/client";
  import ContextPanel from "$views/context-panel/context-panel.svelte";
  import { RAIL_WIDTH } from "$views/context-panel/types";
  import Inspector from "$views/inspector/inspector.svelte";
  import StatusBar from "$views/app/components/status-bar.svelte";
  import TabBar from "$views/tab-bar/tab-bar.svelte";
  import TopBar from "$views/app/components/top-bar.svelte";
  import Workspace from "$views/workspace/workspace.svelte";

  /**
   * The application frame. Six zones, one grid, and nothing else.
   *
   * It takes no `children`. Tabs are workbench state rather than route state, so
   * there is no route-supplied content to thread through the middle — the
   * workspace fills from the active tab, and the route's whole job is to render
   * this view once the client instance exists.
   *
   * Four of the zones are sibling views because each reads the client model:
   * that is the promotion test's first clause, and it is what "a view knows this
   * application exists" means. The top bar and the status bar read nothing and
   * stay components here until they do.
   *
   * **Placement belongs to this view, not to the zones.** Each zone sits inside
   * a wrapper that carries the `grid-area`, so no zone view hardcodes its
   * position in a grid it does not own. A view that declared `grid-area:
   * inspector` on its own root could not be rendered anywhere else — including
   * in a test — which would undo the reason for promoting it.
   *
   * The two flank widths come from the active tab rather than from this
   * stylesheet, so there is one source of truth per dimension and each tab keeps
   * the geometry its user dragged.
   */
  const { workbench } = clientModel();

  /**
   * The model stores the context panel's **content** width; the rail is
   * structural and deliberately excluded. Adding it back is the frame's job, and
   * `RAIL_WIDTH` is the panel's own constant rather than a number repeated here
   * — see `$views/context-panel/types`.
   */
  const contextWidth = $derived(RAIL_WIDTH + workbench.panels.contextWidth);
</script>

<div
  class="app"
  style:--app-context="{contextWidth}px"
  style:--app-inspector="{workbench.panels.inspectorWidth}px"
>
  <div class="zone top-bar"><TopBar /></div>
  <div class="zone tab-bar"><TabBar /></div>
  <div class="zone context"><ContextPanel /></div>
  <main class="zone work"><Workspace /></main>
  <div class="zone inspector"><Inspector /></div>
  <div class="zone status"><StatusBar /></div>
</div>

<style>
  /**
   * Frame geometry. These are the numbers the design system used to carry as
   * --spacing-topbar and friends; they were removed from it for naming an
   * application rather than a dimension. This view IS that application, so it
   * owns them — declared off the one unit the system provides.
   *
   * The two flanks had one shared token once, on the reasoning that two names
   * for a single dimension is what lets them drift. That was right about the
   * risk and wrong about the dimension: the context panel is rail + content and
   * the inspector is its whole width, so 320 was two numbers that happened to
   * coincide by arithmetic. They diverge the moment either is dragged.
   */
  .app {
    --app-top-bar: calc(var(--token-spacing-unit) * 11); /* 44px */
    --app-tab-bar: calc(var(--token-spacing-unit) * 9); /* 36px */
    --app-status: calc(var(--token-spacing-unit) * 6); /* 24px */
    /* Seeds only. Both flanks are overridden inline from the workbench above;
     * these are what paints if that ever fails, and they are why the grid never
     * collapses to zero on a first frame. */
    --app-context: calc(var(--token-spacing-unit) * 80); /* 44 rail + 276 content */
    --app-inspector: calc(var(--token-spacing-unit) * 80); /* 320px */

    display: grid;
    grid-template-rows:
      var(--app-top-bar)
      var(--app-tab-bar)
      1fr
      var(--app-status);
    grid-template-columns: var(--app-context) 1fr var(--app-inspector);
    grid-template-areas:
      "top-bar top-bar top-bar"
      "tab-bar tab-bar tab-bar"
      "context work    inspector"
      "status  status  status";

    /* The frame owns the viewport; each zone scrolls within itself rather than
     * the page scrolling as a whole. */
    height: 100vh;
    overflow: hidden;
    background-color: var(--token-surface-canvas);
  }

  /* Placement and containment only. Everything a zone looks like is the zone's
   * own business; the `min-*: 0` pair is what stops a grid item refusing to
   * shrink below its content and taking the scroll with it. */
  .zone {
    min-width: 0;
    min-height: 0;
  }

  .top-bar {
    grid-area: top-bar;
  }

  .tab-bar {
    grid-area: tab-bar;
  }

  .context {
    grid-area: context;
  }

  /* The work surface is sacred: it gets the generous plane. */
  .work {
    grid-area: work;
    overflow-y: auto;
    background-color: var(--token-surface-work);
    color: var(--token-ink-primary);
  }

  .inspector {
    grid-area: inspector;
  }

  .status {
    grid-area: status;
  }
</style>
