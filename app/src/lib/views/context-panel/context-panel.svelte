<script lang="ts">
  import type { Component } from "svelte";
  import FileText from "@lucide/svelte/icons/file-text";
  import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";

  import { clientModel, type ContextId, type ResourceRef } from "$model/client";
  import Outline from "$views/context-panel/components/outline.svelte";
  import Overview from "$views/context-panel/components/overview.svelte";
  import Rail from "$views/context-panel/components/rail.svelte";

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
   * sees one zone and this view owns how it divides.
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
    content: Component<{ resource: ResourceRef }>;
  };

  const CONTEXTS: Record<ContextId, ContextEntry> = {
    overview: { label: "Overview", icon: LayoutDashboard, content: Overview },
    outline: { label: "Outline", icon: FileText, content: Outline }
  };

  const { workbench } = clientModel();

  const Content = $derived(CONTEXTS[workbench.activeContext].content);
  const resource = $derived<ResourceRef>(workbench.active.resource);
</script>

<aside class="panel" aria-label="Context">
  <Rail
    contexts={CONTEXTS}
    available={workbench.availableContexts}
    active={workbench.activeContext}
    onselect={(id) => workbench.selectContext(id)}
  />

  <!--
    One scroll context per zone. Nesting scrollable regions inside a panel makes
    a scroll position unrecoverable — the rail never scrolls, so this is the
    only one here.
  -->
  <div class="content">
    <Content {resource} />
  </div>
</aside>

<style>
  .panel {
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
