<script lang="ts">
  import type { Component } from "svelte";

  import { clientModel, type ResourceKind } from "$model/client";
  import ProjectOverview from "$views/workspace/components/project-overview.svelte";

  /**
   * The work surface — the generous plane, and what the active tab holds.
   *
   * It fills from the workbench rather than from the route. That is the whole
   * reason tabs can exist: switching tabs is not a navigation, so nothing about
   * what is open is expressible as a URL segment, and a work surface that took
   * route content could not follow a tab.
   *
   * **The key map.** `ResourceKind` is a stable model key and never a component.
   * Resolving it is this view's job, and the map lives here rather than in a
   * shared registry so that adding a resource kind is an edit to the surface
   * that renders it. The tab bar holds the other half — the label and icon for
   * the same key — because that is the surface that displays those.
   *
   * `Record<ResourceKind, …>` rather than a partial map, so a new kind fails to
   * compile until it has something to render. The model refuses a stored kind it
   * no longer recognises during restoration, so no unknown key reaches here.
   */
  const RESOURCES: Record<ResourceKind, Component> = {
    "project-overview": ProjectOverview
  };

  const { workbench } = clientModel();

  const Resource = $derived(RESOURCES[workbench.active.resource.kind]);
</script>

<!--
  Keyed on the tab rather than the kind, so switching between two tabs of the
  same kind remounts instead of reusing one component's state for both. Two open
  documents are not one document.
-->
{#key workbench.activeId}
  <Resource />
{/key}
