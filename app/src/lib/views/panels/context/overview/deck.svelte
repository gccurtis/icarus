<script lang="ts">
  import {
    Panel,
    PanelActions,
    PanelActor,
    PanelButton,
    PanelChip,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection,
    PanelSelect
  } from "$authored-components/panel";
  import { VIEWER } from "$capabilities/cast";
  import { members } from "$capabilities/collaboration";
  import { deckDraft } from "$capabilities/library";
  import { deckRecord } from "$capabilities/resource";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * The deck as a whole.
   *
   * `docs/screen-panel-views/context/overview/deck.md` is the specification.
   * Second in the rail rather than first, because on a deck the slide list is
   * what orients you — which is also why aspect ratio is here rather than on the
   * canvas: it does not change while you work, so it never earned permanent
   * width.
   *
   * **Changing the aspect ratio asks first.** It re-frames every element on
   * every slide, so the choice is staged and the panel says what it is about to
   * do before it does it.
   */
  let { deckId = "r-board" }: { deckId?: string } = $props();

  const it = $derived(deckRecord(deckId).current);
  const everyone = $derived(members().current);

  /** The aspect ratios a deck can be, from the same door the new-deck tab uses. */
  const ratios = $derived(
    deckDraft().current.aspects.map((aspect: string) => ({ value: aspect, label: aspect }))
  );

  let titleDraft = $state("");
  let ratioDraft = $state("");
  let pending = $state("");

  const ratio = $derived(ratioDraft || it.aspectRatio);

  const editors = $derived(everyone.filter((person) => person.at === it.title));
</script>

<Panel title="Overview">
  <PanelFields>
    <PanelField label="Title" stacked>
      <PanelEditableText
        value={titleDraft || it.title}
        label="Deck title"
        onchange={(next: string) => (titleDraft = next)}
      />
    </PanelField>
    <PanelField label="Slides" mono>{it.slides}</PanelField>
    <PanelField label="Aspect ratio" stacked>
      <PanelSelect
        value={ratio}
        label="Aspect ratio"
        options={ratios}
        onchange={(next: string) => (pending = next === ratio ? "" : next)}
      />
    </PanelField>
  </PanelFields>

  {#if pending}
    <PanelNote tone="gap">
      Moving to {pending} re-frames every element on all {it.slides} slides.
    </PanelNote>
    <PanelActions>
      <PanelButton
        label="Re-frame to {pending}"
        tone="primary"
        onclick={() => {
          ratioDraft = pending;
          pending = "";
        }}
      />
      <PanelButton label="Keep {ratio}" tone="ghost" onclick={() => (pending = "")} />
    </PanelActions>
  {/if}

  <PanelSection title="Editing now" count={editors.length}>
    {#each editors as person (person.id)}
      <PanelActor
        name={person.name}
        kind="person"
        role={person.id === VIEWER.id ? "you" : person.role}
        onselect={() =>
          view.inspect("collaboration.person", { kind: "person", id: person.id })}
      />
    {/each}

    {#if editors.length === 0}
      <PanelNote>Nobody else has this open.</PanelNote>
    {/if}

    <PanelNote tone="gap">
      Presence names the resource someone is in, not which slide they are on.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Saved">
    <PanelChip tone="success">{it.saved}</PanelChip>
  </PanelSection>

  <PanelSection title="From template" open={false}>
    <PanelNote tone="gap">
      A deck records no template origin, so where this came from cannot be shown.
    </PanelNote>
  </PanelSection>
</Panel>
