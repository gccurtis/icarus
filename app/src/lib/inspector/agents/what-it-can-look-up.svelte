<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { lookupScopeOf, persona } from "$mock-capabilities/agents";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * The agent's scope: what it may look things up in, and how that combines with
   * whatever a request adds.
   *
   * `docs/screen-panel-views/inspector/agents/what-it-can-look-up.md` is the
   * specification. Both counts are shown because the gap between them is the one
   * that decides what the agent will actually find — a scope containing 96
   * resources of which 88 are searchable is a different scope from one where all
   * 96 are.
   *
   * **Retrievable material, never prompt material.** Nothing in the Context is
   * pasted into a call; it is what the retrieval tools are bounded by.
   */
  let { personaId = "grid-analyst" }: { personaId?: string } = $props();

  const profile = $derived(persona(personaId).current);
  const scope = $derived(lookupScopeOf(personaId).current);
</script>

<Panel title="What it can look up">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: profile.name, key: "agents.persona" },
        { label: "Context" },
        { label: "What it can look up" }
      ]}
      onnavigate={(key: string) =>
        mockWorkbench.inspect(key, { kind: "persona", id: personaId })}
    />
  {/snippet}

  <PanelSection title="Can look up" flush>
    <PanelFields>
      <PanelField label="Context">
        <PanelLink
          label={scope.name}
          title="Open the Context"
          onselect={() =>
            mockWorkbench.inspect("scope.context", { kind: "context", id: scope.id })}
        />
      </PanelField>
      <PanelField label="Contains" mono>{scope.contains} resources</PanelField>
      <PanelField label="Searchable" mono>{scope.searchable} of them</PanelField>
    </PanelFields>
    <PanelNote>
      The gap between the two decides what the agent will actually find. What is
      contained but not searchable cannot be retrieved from at all.
    </PanelNote>
  </PanelSection>

  <PanelSection title="How it combines" flush>
    <PanelFields>
      <PanelField label="Rule" stacked>
        {scope.name}, plus whatever the request adds.
      </PanelField>
    </PanelFields>
    <PanelNote>
      Project membership is enforced after the union rather than being one of the
      parts of it. Changing what this agent can look up means editing the persona,
      not switching it off for one turn.
    </PanelNote>
  </PanelSection>

  <!-- Only a question for a persona that runs elsewhere, so it arrives shut. -->
  <PanelSection title="Portability" open={false} flush>
    <PanelFields>
      <PanelField label="Available in">{profile.scope}</PanelField>
      <PanelField label="Travels">{scope.travels ? "Yes" : "No"}</PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      A rule like "everything in this project" resolves wherever a persona runs,
      but named resources and named project Contexts do not travel. The editor
      blocks them until cross-project binding exists, which makes a persona
      available everywhere materially more limited than one that is not.
    </PanelNote>
  </PanelSection>
</Panel>
