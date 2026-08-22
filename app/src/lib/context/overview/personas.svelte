<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import Search from "@lucide/svelte/icons/search";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";

  import {
    Panel,
    PanelActor,
    PanelButton,
    PanelChip,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import {
    behaviourOf,
    lookupScopeOf,
    persona,
    toolsFor,
    type BehaviourSection,
    type ToolPermission
  } from "$mock-capabilities/agents";
  import { PEOPLE } from "$mock-capabilities/cast";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * This persona: who it is, what it has done, how it is set up.
   *
   * `docs/screen-panel-views/context/overview/personas.md` is the
   * specification.
   *
   * **Record leads the configuration**, because a record is what tells you
   * whether to trust an agent — and *Failed* is in it deliberately, since a
   * record that only counts successes is not a record.
   *
   * **Set up summarises the three configuration views rather than repeating
   * them.** Each row is the way into the view that owns it, so the state of all
   * three is visible without visiting any.
   */
  let {
    personaId = "grid-analyst",
    onback
  }: { personaId?: string; onback?: () => void } = $props();

  const it = $derived(persona(personaId).current);
  const behaviour = $derived(behaviourOf(personaId).current);
  const lookup = $derived(lookupScopeOf(personaId).current);
  const tools = $derived(toolsFor(personaId).current);

  const written = $derived(
    behaviour.filter((entry: BehaviourSection) => entry.text.trim().length > 0).length
  );
  const allowed = $derived(tools.filter((tool: ToolPermission) => tool.allowed).length);

  const author = $derived(PEOPLE.find((person) => person.name === it.createdBy));
</script>

<Panel title="Overview">
  {#snippet actions()}
    <PanelButton label="Back to library" icon={ArrowLeft} onclick={onback} />
  {/snippet}

  <!-- The subject of the panel, so the face carries no way to navigate to itself. -->
  <PanelActor name={it.name} kind="agent" size="head" />

  <PanelFields>
    <PanelField label="Does" stacked>{it.describes}</PanelField>
    <PanelField label="Available in">{it.scope}</PanelField>
  </PanelFields>

  <PanelSection title="Record">
    <PanelFields>
      <PanelField label="Tasks" mono>{it.record.tasks}</PanelField>
      <PanelField label="Running" mono>{it.record.running}</PanelField>
      <PanelField label="Failed" mono>{it.record.failed}</PanelField>
      <PanelField label="Findings" mono>{it.record.findings}</PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      No per-persona aggregate exists. Task counts and a findings-accepted tally
      both need one before these numbers can be real.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Set up" flush>
    <PanelRow
      title="Behaviour"
      sub="{written} of {behaviour.length} written"
      icon={BookOpen}
      onselect={() => view.selectContext("agents.behaviour")}
    />
    <PanelRow
      title="Can look up"
      sub={lookup.name}
      meta={String(lookup.contains)}
      icon={Search}
      onselect={() => view.selectContext("agents.context-persona")}
    />
    <PanelRow
      title="May use"
      sub="{allowed} of {tools.length} tools"
      icon={ShieldCheck}
      onselect={() => view.selectContext("agents.tools")}
    />
  </PanelSection>

  <PanelSection title="Saved">
    <PanelChip tone="success">Saved · revision {it.revision}</PanelChip>
  </PanelSection>

  <PanelSection title="Attribution" open={false}>
    <PanelFields>
      <PanelField label="Created by">
        {#if author}
          <PanelLink
            label={it.createdBy}
            title="{it.createdBy} — person"
            onselect={() =>
              view.inspect("collaboration.person", { kind: "person", id: author.id })}
          />
        {:else}
          {it.createdBy}
        {/if}
      </PanelField>
      <PanelField label="Updated" mono>{it.updated}</PanelField>
    </PanelFields>
  </PanelSection>
</Panel>
