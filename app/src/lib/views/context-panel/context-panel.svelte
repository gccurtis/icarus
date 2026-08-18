<script lang="ts">
  import type { Component } from "svelte";
  import FileText from "@lucide/svelte/icons/file-text";
  import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";

  import { clientModel, screenKindOf, type Tab } from "$model/client";
  import { ResizeHandle } from "$lib/unique-components/resize-handle";
  import Outline from "$views/context-panel/components/outline.svelte";
  import Overview from "$views/context-panel/components/overview.svelte";
  import Rail from "$views/context-panel/components/rail.svelte";
  import { COLLAPSE_BELOW, MAX_WIDTH, MIN_WIDTH, RAIL_WIDTH } from "$views/context-panel/types";
  import {
    CONTEXTS_BY_SCREEN,
    resolveContext,
    type ContextId
  } from "$views/context-panel/procedures/resolve-context";

  /**
   * The context panel — the map. It answers "where am I and what else is here?"
   *
   * A context is a way of looking at what surrounds the active resource: its
   * outline, what it relates to, who commented on it. Never a mode of working —
   * a rail entry answers "what else is here?", not "what am I doing?", which is
   * why the model says context rather than activity.
   *
   * The rail is inside this panel rather than beside it in the frame's grid: it
   * is the panel's own navigation and has no meaning without it, so the frame
   * sees one zone and this view owns how it divides. It is also what makes
   * collapsing work — the panel narrows to the rail rather than disappearing, so
   * there is always something left to click.
   *
   * **The key map.** `ContextId` is a stable model key and never a component —
   * the model says so explicitly, because a model type naming a component drags
   * a DOM into every test of it. Resolving the key is this view's job, and the
   * map lives here rather than in a shared registry so that adding a context is
   * an edit to the surface that renders it.
   *
   * `Record<ContextId, …>` rather than a partial map, so a new context fails to
   * compile until it has a label, an icon, and something to show. The model
   * guarantees `activeContext` is one this resource kind offers, falling back to
   * the kind's default when a stored id no longer resolves, so there is no
   * unknown-key branch to write here.
   */
  type ContextEntry = {
    label: string;
    icon: Component;
    content: Component<{ tab: Tab }>;
  };

  const CONTEXTS: Record<ContextId, ContextEntry> = {
    overview: { label: "Overview", icon: LayoutDashboard, content: Overview },
    outline: { label: "Outline", icon: FileText, content: Outline }
  };

  const { workbench } = clientModel();

  const tab = $derived(workbench.active);
  const screen = $derived(screenKindOf(tab.target));
  const available = $derived(CONTEXTS_BY_SCREEN[screen]);
  const active = $derived(resolveContext(screen, tab.viewState.frame.contextId));
  const Content = $derived(CONTEXTS[active].content);

  /** The model stores content only; the handle works in painted pixels. */
  const visible = $derived(RAIL_WIDTH + workbench.frame.contextWidth);
  const collapsed = $derived(workbench.frame.contextCollapsed);

  /**
   * Selecting a context always opens the panel.
   *
   * That is the whole uncollapse affordance on this side, and it needs no arrow
   * of its own: the rail is visible while collapsed, and the thing a user wants
   * when they reach for an icon is to see what it holds. Choosing the context
   * that is already showing is left alone rather than treated as a toggle —
   * closing a panel by clicking into it is a surprise, and the edge already
   * closes it.
   */
  const select = (id: ContextId) => {
    workbench.selectContext(id);
    if (collapsed) workbench.resize({ contextCollapsed: false });
  };
</script>

<aside class="panel" aria-label="Context">
  <Rail
    contexts={CONTEXTS}
    {available}
    {active}
    {collapsed}
    onselect={select}
  />

  <!--
    One scroll context per zone. Nesting scrollable regions inside a panel makes
    a scroll position unrecoverable — the rail never scrolls, so this is the
    only one here.
  -->
  {#if !collapsed}
    <div class="content">
      <Content {tab} />
    </div>
  {/if}

  <ResizeHandle
    side="start"
    width={visible}
    {collapsed}
    min={MIN_WIDTH}
    max={MAX_WIDTH}
    collapseBelow={COLLAPSE_BELOW}
    label="the context panel"
    onchange={({ width, collapsed: next }) =>
      workbench.resize({ contextWidth: width - RAIL_WIDTH, contextCollapsed: next })}
  />
</aside>

<style>
  .panel {
    position: relative;
    height: 100%;
    display: flex;
    min-height: 0;
    background-color: var(--token-surface-panel);
    border-right: 1px solid var(--token-border-subtle);
  }

  .content {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: calc(var(--token-spacing-unit) * 3);
  }
</style>
