<script lang="ts">
  import type { Component } from "svelte";
  import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";

  import { clientModel, type ActivityId } from "$model/client";
  import Overview from "$views/activity-panel/components/overview.svelte";
  import Rail from "$views/activity-panel/components/rail.svelte";

  /**
   * The activity panel — the map. It answers "where am I and what else is here?"
   *
   * The rail is inside this panel rather than beside it in the frame's grid: it
   * is the panel's own navigation and has no meaning without it, so the frame
   * sees one zone and this view owns how it divides.
   *
   * **The key map.** `ActivityId` is a stable model key and never a component —
   * the model says so explicitly, because a model type naming a component drags
   * a DOM into every test of it. Resolving the key is this view's job, and the
   * map lives here rather than in a shared registry so that adding an activity
   * is an edit to the surface that renders it.
   *
   * `Record<ActivityId, …>` rather than a partial map, so a new activity fails
   * to compile until it has a label, an icon, and something to show. The model
   * guarantees `activeActivity` is one this kind offers, falling back to the
   * kind's default when a stored id no longer resolves, so there is no
   * unknown-key branch to write here.
   */
  const ACTIVITIES: Record<ActivityId, { label: string; icon: Component; content: Component }> = {
    overview: { label: "Overview", icon: LayoutDashboard, content: Overview }
  };

  const { workbench } = clientModel();

  const Content = $derived(ACTIVITIES[workbench.activeActivity].content);
</script>

<aside class="panel" aria-label="Activities">
  <Rail
    activities={ACTIVITIES}
    available={workbench.availableActivities}
    active={workbench.activeActivity}
    onselect={(id) => workbench.selectActivity(id)}
  />

  <!--
    One scroll context per zone. Nesting scrollable regions inside a panel makes
    a scroll position unrecoverable — the rail never scrolls, so this is the
    only one here.
  -->
  <div class="content">
    <Content />
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
