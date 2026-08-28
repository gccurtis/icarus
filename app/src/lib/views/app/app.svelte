<script lang="ts">
  import { clientModel } from "$runtime/client/start";
  import { provideViewState } from "$model/client/view-state";
  import CommandBar from "$views/command-bar/command-bar.svelte";
  import { dispatchCommands } from "$views/app/effects/dispatch-commands.svelte";
  import ContextPanel from "$views/context-panel/context-panel.svelte";
  import { RAIL_WIDTH } from "$views/context-panel/types";
  import Inspector from "$views/inspector/inspector.svelte";
  import { COLLAPSED_WIDTH } from "$views/inspector/types";
  import StatusBar from "$views/status-bar/status-bar.svelte";
  import TabBar from "$views/tab-bar/tab-bar.svelte";
  import TopBar from "$views/top-bar/top-bar.svelte";
  import Workspace from "$views/workspace/workspace.svelte";

  /**
   * The application frame. Six zones, one grid, and nothing else.
   *
   * It takes no `children`. Tabs are view state rather than route state, so
   * there is no route-supplied content to thread through the middle — the
   * workspace fills from the active tab, and the route's whole job is to render
   * this view once the client instance exists.
   *
   * Every zone is a sibling view, and each one meets the promotion test on its
   * own terms: five read the client model, which is what "a view knows this
   * application exists" means, and the top bar carries a concern directory for
   * the theme it applies to the document root.
   *
   * **Placement belongs to this view, not to the zones.** Each zone sits inside
   * a wrapper that carries the `grid-area`, so no zone view hardcodes its
   * position in a grid it does not own. A view that declared `grid-area:
   * inspector` on its own root could not be rendered anywhere else — including
   * in a test — and being renderable anywhere is the whole point of a zone being
   * a view of its own.
   *
   * The two flank widths come from the active tab rather than from this
   * stylesheet, so there is one source of truth per dimension and each tab keeps
   * the geometry its user dragged.
   */
  /**
   * The frame is where the instance is handed down.
   *
   * The client graph built it; every panel below reads it out of context rather
   * than out of `clientModel()`, which is what keeps every one of them renderable
   * on its own. One provider, at the top, because a second one underneath would
   * silently shadow it for everything below.
   */
  const { viewState, commands } = clientModel();
  provideViewState(viewState);

  /**
   * One keydown listener for the whole application, mounted with the frame and
   * removed with it. It sits here rather than in the command bar because a
   * shortcut has to work while the bar is closed — including the one that opens
   * it.
   */
  dispatchCommands(commands);

  /**
   * The model stores the context panel's **content** width; the rail is
   * structural and deliberately excluded. Adding it back is the frame's job, and
   * `RAIL_WIDTH` is the panel's own constant rather than a number repeated here
   * — see `$views/context-panel/types`.
   *
   * A collapsed flank is still a column, just a narrow one. Each panel collapses
   * to a rail rather than to nothing, so the grid keeps three columns in every
   * state and the work surface never has to reflow between two and three.
   */
  const contextWidth = $derived(
    viewState.frame.contextCollapsed ? RAIL_WIDTH : RAIL_WIDTH + viewState.frame.contextWidth
  );

  const inspectorWidth = $derived(
    viewState.frame.inspectorCollapsed ? COLLAPSED_WIDTH : viewState.frame.inspectorWidth
  );
</script>

<div
  class="app"
  style:--app-context="{contextWidth}px"
  style:--app-inspector="{inspectorWidth}px"
>
  <div class="zone top-bar"><TopBar /></div>
  <div class="zone tab-bar"><TabBar /></div>
  <div class="zone context"><ContextPanel /></div>
  <main class="zone work">
    <div class="surface"><Workspace /></div>
  </main>
  <div class="zone inspector"><Inspector /></div>
  <div class="zone status"><StatusBar /></div>
</div>

<!--
  Outside the grid, and deliberately. The bar belongs to no zone — it dims all of
  them — so giving it a `grid-area` would mean inventing a seventh region that is
  empty in every state but one, and the six-zone rule would stop being true.
-->
<CommandBar />

<style>
  /**
   * Frame geometry, declared here rather than in the design system. A zone
   * height names an application, not a design dimension, and this view IS that
   * application — so it owns the numbers, each one declared off the single
   * spacing unit the system provides.
   *
   * **A flank each, not one shared width.** Two names for a single dimension is
   * what lets them drift, but these are not one dimension: the context panel is
   * rail + content and the inspector is its whole width, so a shared 320 would
   * be two numbers coinciding by arithmetic. They diverge the moment either is
   * dragged.
   */
  .app {
    --app-top-bar: calc(var(--token-spacing-unit) * 11); /* 44px */
    --app-tab-bar: calc(var(--token-spacing-unit) * 9); /* 36px */
    /* 32px, because the bar holds the Copilot's composer. A 24px row fits a
     * sentence; it does not fit an input. */
    --app-status: calc(var(--token-spacing-unit) * 8);
    /* Seeds only. Both flanks are overridden inline from view state above;
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
    position: relative;
    overflow: hidden;
    background-color: var(--token-surface-work);
    color: var(--token-ink-primary);
  }

  .surface {
    height: 100%;
    overflow-y: auto;
  }

  .inspector {
    grid-area: inspector;
  }

  .status {
    grid-area: status;
  }
</style>
