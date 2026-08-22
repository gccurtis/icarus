<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { behaviourOf, persona, type BehaviourSection } from "$mock-capabilities/agents";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * One of the five sections of a persona's definition: what it is for, what it
   * says, and what it costs.
   *
   * `docs/screen-panel-views/inspector/agents/behaviour-section.md` is the
   * specification. The purpose line is static and is the whole reason the lens
   * has a first band — Focus is not Approach and Approach is not Output, and
   * nothing about the five names makes that obvious.
   *
   * **The cost is measured from the text on screen**, not read from the record,
   * so an edit and what it costs cannot disagree while the edit is uncommitted.
   */
  let {
    personaId = "grid-analyst",
    sectionId = "grid-analyst-focus"
  }: { personaId?: string; sectionId?: string } = $props();

  const view = viewState();

  const profile = $derived(persona(personaId).current);
  const sections = $derived(behaviourOf(personaId).current);
  const section = $derived(
    sections.find((entry: BehaviourSection) => entry.id === sectionId) ?? sections[0]
  );

  /** Held locally: the door is a read, and a write that vanished on the next read
   * would be worse than one that is plainly local. */
  let edited = $state<string | undefined>(undefined);

  const text = $derived(edited ?? section.text);
  const characters = $derived(text.length);
</script>

<Panel title={section.name}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: profile.name, key: "agents.persona" },
        { label: "Behaviour" },
        { label: section.name }
      ]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "persona", id: personaId });
      }}
    />
  {/snippet}

  <PanelSection title="What this is for" flush>
    <PanelNote>{section.purpose}</PanelNote>
  </PanelSection>

  <PanelSection title="Text" flush>
    <PanelFields>
      <PanelField label={section.name} stacked>
        <PanelEditableText
          label={section.name}
          value={text}
          placeholder="Empty"
          multiline
          onchange={(next: string) => (edited = next)}
        />
      </PanelField>
    </PanelFields>

    {#if text.trim() === ""}
      <!-- Empty is a state, not an error: the section is simply left out. -->
      <PanelNote>
        Empty. This section is left out of the prompt entirely, and a persona with
        five empty ones and a scope is legal.
      </PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Cost" flush>
    <PanelFields>
      <PanelField label="Characters" mono>{characters}</PanelField>
    </PanelFields>
    <PanelNote>Sent on every call this Persona makes.</PanelNote>
    <PanelNote tone="gap">
      Characters are a proxy for tokens, and a bad one for anything not written in
      Latin script. Showing tokens instead needs a tokeniser in the client.
    </PanelNote>
  </PanelSection>
</Panel>
