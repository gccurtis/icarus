<script lang="ts">
  import BookOpen from "@lucide/svelte/icons/book-open";

  import {
    Panel,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$authored-components/panel";
  import { behaviourOf, type BehaviourSection } from "$capabilities/agents";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * The five sections of the agent's definition.
   *
   * `docs/screen-panel-views/context/agents/behaviour.md` is the specification.
   * This is prompt material — text sent on every call — and it never shares a
   * panel with Context, which is material the agent goes and looks things up in.
   *
   * **The list is the five names, their purpose and their cost.** The text
   * itself belongs to the section lens: at 300px a panel holding five paragraphs
   * is a panel nobody can compare five things in, and the character count is
   * what a reader is actually comparing.
   *
   * **Empty is a state rather than an error**, so an unwritten section is a row
   * saying Empty and is not toned as a fault.
   */
  let { personaId = "grid-analyst" }: { personaId?: string } = $props();

  const sections = $derived(behaviourOf(personaId).current);

  const written = $derived(
    sections.filter((entry: BehaviourSection) => entry.text.trim().length > 0).length
  );
</script>

<Panel title="Behaviour">
  <PanelSection title="Sections" count="{written} of {sections.length} written" flush>
    {#each sections as entry (entry.id)}
      <PanelRow
        title={entry.name}
        sub={entry.purpose}
        meta={entry.characters === 0 ? "Empty" : `${entry.characters} characters`}
        icon={BookOpen}
        onselect={() =>
          view.inspect("agents.behaviour-section", { kind: "section", id: entry.id })}
      />
    {/each}

    <PanelNote>
      Every written section is sent on every call, which is what the character
      count measures. An empty one is left out of the prompt entirely — a persona
      with five empty sections and a scope is a legal persona.
    </PanelNote>
  </PanelSection>
</Panel>
