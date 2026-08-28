<script lang="ts">
  import FileText from "@lucide/svelte/icons/file-text";
  import Layers from "@lucide/svelte/icons/layers";
  import SquareArrowOutUpRight from "@lucide/svelte/icons/square-arrow-out-up-right";

  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$authored-components/panel";
  import { lookupScopeOf } from "$capabilities/agents";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * What this agent can look up.
   *
   * `docs/screen-panel-views/context/agents/context-persona.md` is the
   * specification. Retrievable material, as opposed to the prompt material in
   * Behaviour — the two never share a panel.
   *
   * **The count is resolved now, not stored.** A Context is a rule, so what the
   * agent will find today is not what it found when the persona was saved, and
   * the sample below is here so a scope that has drifted is visible from the
   * profile rather than only from the Context screen.
   *
   * **Open Context screen is in the actions row.** `Panel` has no footer, and
   * the way out of a panel should not sit under a list of unbounded length.
   */
  let { personaId = "grid-analyst", onopen }: { personaId?: string; onopen?: () => void } =
    $props();

  const scope = $derived(lookupScopeOf(personaId).current);
</script>

<Panel title="Context">
  {#snippet actions()}
    <PanelButton
      label="Open Context screen"
      icon={SquareArrowOutUpRight}
      disabled={onopen === undefined}
      title="The Context this persona looks things up in, on its own screen"
      onclick={onopen}
    />
  {/snippet}

  <PanelSection title="It can look up" flush>
    <PanelRow
      title={scope.name}
      sub="{scope.contains} resources · {scope.searchable} searchable"
      icon={Layers}
      tone={scope.contains === 0 ? "attention" : "default"}
      onselect={() =>
        view.inspect("agents.what-it-can-look-up", { kind: "scope", id: scope.id })}
    />

    <!--
      Searchable is always the smaller number, and the gap is what decides what
      the agent will actually find. Two numbers rather than a percentage, because
      a percentage hides which of the two a reader is looking at.
    -->
    {#if scope.contains === 0}
      <PanelNote tone="gap">
        This scope matches nothing, and an empty scope is not yet distinguishable
        from no scope at all — an agent set up to see almost nothing would
        silently see the whole project.
      </PanelNote>
    {/if}
  </PanelSection>

  <PanelSection
    title="Contents"
    count="{scope.sample.length} of {scope.contains}"
    flush
  >
    {#each scope.sample as name (name)}
      <PanelRow
        title={name}
        icon={FileText}
        onselect={() =>
          view.inspect("scope.resolved-resource", { kind: "resource", id: name })}
      />
    {/each}

    <PanelNote>A bounded sample, resolved now. It is not the whole scope.</PanelNote>
  </PanelSection>
</Panel>
