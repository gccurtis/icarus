<script lang="ts">
  import Circle from "@lucide/svelte/icons/circle";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";

  import { createTabList } from "$model/client/tab-list";
  import { createTabViews } from "$model/client/tab-views";
  import {
    createWorkspaceState,
    provideWorkspaceState
  } from "$model/client/workspace-state";
  import { clientModel } from "$runtime/client/start";
  import Content from "$surfaces/content/content.svelte";
  import ContextPanel from "$surfaces/context/context.svelte";
  import { RAIL_WIDTH } from "$surfaces/context/types";
  import Inspector from "$surfaces/inspector/inspector.svelte";
  import { COLLAPSED_WIDTH } from "$surfaces/inspector/types";

  /**
   * A real Templates workbench with a disposable *view* state.
   *
   * The project and editor runtime registers come from the app client created
   * by `/app/[project]`. Tabs and panel state do not: the demo gets a fresh
   * coordinator with zero persistence thresholds, never restores it, and never
   * flushes it. That is what lets the real content/context/inspector registries
   * run without this reference page changing the reader's saved arrangement.
   *
   * Data is not replaced or intercepted here. Whatever the Templates views
   * read through their procedures and capabilities is exactly what appears on
   * this stage.
   */
  const app = clientModel();
  const view = createWorkspaceState(
    app.project,
    createTabList(),
    createTabViews(),
    { afterOps: 0, afterMs: 0 },
    app.documentRuntimes,
    app.presentationRuntimes
  );

  view.activate("templates");
  provideWorkspaceState(view);

  const contextWidth = $derived(
    view.frame.contextCollapsed ? RAIL_WIDTH : RAIL_WIDTH + view.frame.contextWidth
  );
  const inspectorWidth = $derived(
    view.frame.inspectorCollapsed ? COLLAPSED_WIDTH : view.frame.inspectorWidth
  );
  const inspecting = $derived(view.inspected !== "empty");
  const showingLibrary = $derived(view.active.category === "templates");

  const returnToLibrary = () => {
    const templateTab = view.tabs.find((tab) => tab.category === "templates");
    if (templateTab !== undefined) view.activate(templateTab.id);
  };
</script>

<div class="stage-frame">
  <header class="stage-bar">
    <div class="stage-identity">
      <span class="stage-lights" aria-hidden="true">
        <Circle size={8} fill="currentColor" />
        <Circle size={8} fill="currentColor" />
        <Circle size={8} fill="currentColor" />
      </span>
      <strong>LIVE PRODUCT SURFACE</strong>
      <span>isolated workspace view · project-scoped call · owner-only templates</span>
    </div>
    <div class="stage-status">
      {#if !showingLibrary}
        <button type="button" onclick={returnToLibrary}>
          <RotateCcw size={13} aria-hidden="true" /> Return to library
        </button>
      {/if}
      <p class:ready={inspecting} aria-live="polite">
        {#if inspecting}
          <CircleCheck size={13} aria-hidden="true" /> Inspector follows the selected template
        {:else}
          Select a shelf card or table row to open its inspector
        {/if}
      </p>
    </div>
  </header>

  <div class="viewport">
    <div
      class="workbench"
      style:--reference-context="{contextWidth}px"
      style:--reference-inspector="{inspectorWidth}px"
    >
      <div class="context"><ContextPanel /></div>
      <div class="content"><Content /></div>
      <div class="inspector"><Inspector /></div>
    </div>
  </div>

  <footer class="stage-foot">
    <span>Actual filesystem registries</span>
    <span aria-hidden="true">→</span>
    <span>actual Template views</span>
    <span aria-hidden="true">→</span>
    <span>actual read/write seam</span>
  </footer>
</div>

<style>
  .stage-frame {
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
    box-shadow: var(--token-shadow-panel);
  }

  .stage-bar,
  .stage-foot,
  .stage-identity,
  .stage-lights,
  .stage-bar p,
  .stage-status,
  .stage-status button {
    display: flex;
    align-items: center;
  }

  .stage-bar {
    min-height: calc(var(--token-spacing-unit) * 11);
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 4);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
    border-bottom: 1px solid var(--token-border-subtle);
    background: var(--token-surface-elevated);
  }

  .stage-identity {
    min-width: 0;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .stage-identity strong,
  .stage-identity > span:last-child,
  .stage-bar p,
  .stage-foot {
    font-family: var(--token-font-mono);
    font-size: 0.75rem;
    line-height: 1.4;
  }

  .stage-identity strong {
    color: var(--token-color-active-text);
    letter-spacing: 0.08em;
  }

  .stage-identity > span:last-child,
  .stage-bar p,
  .stage-foot {
    color: var(--token-ink-muted);
  }

  .stage-lights {
    gap: calc(var(--token-spacing-unit) * 1);
    color: var(--token-border-strong);
  }

  .stage-lights :global(svg:first-child) {
    color: var(--token-color-danger-border);
  }

  .stage-lights :global(svg:nth-child(2)) {
    color: var(--token-color-attention-border);
  }

  .stage-lights :global(svg:last-child) {
    color: var(--token-color-success-border);
  }

  .stage-bar p {
    flex: none;
    gap: calc(var(--token-spacing-unit) * 1.5);
    margin: 0;
  }

  .stage-status {
    justify-content: flex-end;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .stage-status button {
    gap: calc(var(--token-spacing-unit) * 1);
    padding: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 2);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel);
    color: var(--token-ink-secondary);
    cursor: pointer;
    font-family: var(--token-font-mono);
    font-size: 0.75rem;
  }

  .stage-status button:hover {
    border-color: var(--token-color-interactive-border);
    background: var(--token-surface-panel-hover);
  }

  .stage-bar p.ready {
    color: var(--token-color-success-text);
  }

  .viewport {
    overflow-x: auto;
    background:
      linear-gradient(var(--token-surface-work), var(--token-surface-work)) padding-box,
      var(--token-surface-canvas);
    scrollbar-color: var(--token-border-strong) transparent;
    scrollbar-width: thin;
  }

  .workbench {
    display: grid;
    grid-template-columns:
      var(--reference-context)
      minmax(44rem, 1fr)
      var(--reference-inspector);
    grid-template-areas: "context content inspector";
    min-width: 72rem;
    height: min(70vh, 45rem);
    min-height: 38rem;
    overflow: hidden;
  }

  .context,
  .content,
  .inspector {
    min-width: 0;
    min-height: 0;
  }

  .context {
    grid-area: context;
  }

  .content {
    grid-area: content;
    overflow: hidden;
    background: var(--token-surface-work);
  }

  .inspector {
    grid-area: inspector;
  }

  .stage-foot {
    flex-wrap: wrap;
    justify-content: center;
    gap: calc(var(--token-spacing-unit) * 2);
    min-height: calc(var(--token-spacing-unit) * 9);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
    border-top: 1px solid var(--token-border-subtle);
    background: var(--token-surface-elevated);
  }

  .stage-foot span:nth-child(even) {
    color: var(--token-color-active-text);
  }

  @media (max-width: 48rem) {
    .stage-bar {
      align-items: flex-start;
      flex-direction: column;
    }

    .stage-identity > span:last-child {
      display: none;
    }

    .workbench {
      height: 39rem;
    }
  }
</style>
