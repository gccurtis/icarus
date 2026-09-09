<script lang="ts">
  import { untrack } from "svelte";

  import { createConfiguration } from "$model/client/configuration";
  import { createTabList } from "$model/client/tab-list";
  import { createTabViews } from "$model/client/tab-views";
  import {
    createWorkspaceState,
    provideWorkspaceState,
    type Category,
    type ContentView,
    type ContextView,
    type InspectorView
  } from "$model/client/workspace-state";
  import { clientModel } from "$runtime/client/start";
  import Content from "$surfaces/content/content.svelte";
  import ContextPanel from "$surfaces/context/context.svelte";
  import { RAIL_WIDTH } from "$surfaces/context/types";
  import Inspector from "$surfaces/inspector/inspector.svelte";
  import { COLLAPSED_WIDTH } from "$surfaces/inspector/types";
  import Stage from "$development-views/agents-reference/components/stage.svelte";

  let {
    label,
    geometry = "rail 44px · panel 248px · centre ≥ 704px · inspector 320px",
    height = "44rem",
    panes = "all",
    category = "agents",
    content,
    focus,
    context,
    inspect,
    selection
  }: {
    label: string;
    geometry?: string;
    height?: string;
    panes?: "all" | "context" | "inspector";
    category?: Category;
    content?: ContentView;
    focus?: string;
    context?: ContextView;
    inspect?: InspectorView;
    selection?: { readonly kind: string; readonly id: string; readonly at?: string };
  } = $props();

  const app = clientModel();
  const unpersisted = createConfiguration({
    workspace: { changeSets: { flushAfterOps: 0, flushAfterMs: 0 } }
  });
  const view = createWorkspaceState(
    app.project,
    createTabList(),
    createTabViews(),
    unpersisted,
    app.documentRuntimes,
    app.slideDeckRuntimes
  );

  untrack(() => {
    view.open({ category });
  });
  untrack(() => {
    if (content !== undefined) view.showContent(content, focus);
    if (context !== undefined) view.selectContext(context);
    if (inspect !== undefined && selection !== undefined) view.inspect(inspect, selection);
    view.resize({ contextWidth: 248, inspectorWidth: 320 });
  });
  provideWorkspaceState(view);

  const contextWidth = $derived(
    view.frame.contextCollapsed ? RAIL_WIDTH : RAIL_WIDTH + view.frame.contextWidth
  );
  const inspectorWidth = $derived(
    view.frame.inspectorCollapsed ? COLLAPSED_WIDTH : view.frame.inspectorWidth
  );
</script>

<Stage {label} {geometry} width={panes === "all" ? "full" : "flank"}>
  {#if panes === "context"}
    <div class="flank" style:height><ContextPanel /></div>
  {:else if panes === "inspector"}
    <div class="flank lens" style:height><Inspector /></div>
  {:else}
    <div class="viewport">
      <div
        class="workbench"
        style:height
        style:--reference-context="{contextWidth}px"
        style:--reference-inspector="{inspectorWidth}px"
      >
        <div class="context"><ContextPanel /></div>
        <div class="content"><Content /></div>
        <div class="inspector"><Inspector /></div>
      </div>
    </div>
  {/if}
</Stage>

<style>
  .viewport {
    overflow-x: auto;
    background: var(--token-surface-work);
    scrollbar-width: thin;
  }

  .workbench {
    display: grid;
    grid-template-columns:
      var(--reference-context)
      minmax(44rem, 1fr)
      var(--reference-inspector);
    grid-template-areas: "context content inspector";
    min-width: 82rem;
    overflow: hidden;
  }

  .context,
  .content,
  .inspector,
  .flank {
    min-width: 0;
    min-height: 0;
  }

  .context {
    grid-area: context;
  }

  .content {
    grid-area: content;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--token-surface-work);
  }

  .content > :global(*) {
    min-height: 0;
    flex: 1;
  }

  .inspector {
    grid-area: inspector;
  }

  .flank {
    display: flex;
    width: 100%;
  }

  .flank > :global(*) {
    min-width: 0;
    flex: 1;
  }
</style>
