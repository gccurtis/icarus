<script lang="ts">
  import type { Component } from "svelte";

  import { clientModel, screenKindOf, type ScreenKind, type Tab } from "$model/client";
  import Analysis from "$views/workspace/components/analysis.svelte";
  import Automations from "$views/workspace/components/automations.svelte";
  import Context from "$views/workspace/components/context.svelte";
  import DocumentScreen from "$views/workspace/components/document.svelte";
  import NewTab from "$views/workspace/components/new-tab.svelte";
  import Personas from "$views/workspace/components/personas.svelte";
  import ProjectOverview from "$views/workspace/components/project-overview.svelte";
  import Research from "$views/workspace/components/research.svelte";
  import Slides from "$views/workspace/components/slides.svelte";
  import Spreadsheet from "$views/workspace/components/spreadsheet.svelte";
  import Templates from "$views/workspace/components/templates.svelte";

  /**
   * The work surface — the generous plane, and what the active tab holds.
   *
   * It fills from the workbench rather than from the route. That is the whole
   * reason tabs can exist: switching tabs is not a navigation, so nothing about
   * what is open is expressible as a URL segment, and a work surface that took
   * route content could not follow a tab.
   *
   * **The screens registry.** `ScreenKind` is a stable model key and never a
   * component. Resolving it is this view's job, and the map lives here rather
   * than in a shared registry so that adding a screen is an edit to the surface
   * that renders it. The tab bar holds the other half — the label and icon for
   * the same key — because that is the surface that displays those.
   *
   * `Record<ScreenKind, …>` rather than a partial map, so a new screen fails to
   * compile until it has something to render. That totality is why nine of these
   * are placeholders rather than absent: a screen with no capability behind it
   * still needs a root, and one that is visibly unbuilt is more honest than an
   * invented surface nobody can tell from the real thing.
   */
  const SCREENS: Record<ScreenKind, Component<{ tab: Tab }>> = {
    "project-overview": ProjectOverview,
    research: Research,
    analysis: Analysis,
    context: Context,
    templates: Templates,
    personas: Personas,
    automations: Automations,
    document: DocumentScreen,
    slides: Slides,
    spreadsheet: Spreadsheet,
    "new-tab": NewTab
  };

  const { workbench } = clientModel();

  const tab = $derived(workbench.active);
  const Screen = $derived(SCREENS[screenKindOf(tab.target)]);
</script>

<!--
  Keyed on the tab rather than the screen, so switching between two tabs of the
  same kind remounts instead of reusing one component's state for both. Two open
  documents are not one document.

  Everything a screen needs to survive that remount is either in `viewState`, or
  behind `workbench.runtimeFor(tab.id)` — which is exactly why runtime lifetime
  belongs to the workbench and not to a component's mount.
-->
{#key workbench.activeId}
  <Screen {tab} />
{/key}
