<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Copy from "@lucide/svelte/icons/copy";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { deckRecord, layout } from "$mock-capabilities/resource";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * A layout: what it is made of, what it inherits, and what editing it will do.
   *
   * `docs/screen-panel-views/inspector/resource/layout.md` is the specification.
   *
   * **Careful is a section rather than a dialog.** Editing a layout changes every
   * slide using it, and the count of those slides is said twice — once as a fact
   * in the identity band and once in prose beside the warning — because the thing
   * people get wrong about layouts is which of the two changed.
   */
  let {
    layoutId = "ly-two-panes",
    deckId = "r-board"
  }: { layoutId?: string; deckId?: string } = $props();

  const record = $derived(layout(layoutId).current);
  const deck = $derived(deckRecord(deckId).current);

  let renamed = $state<string | undefined>(undefined);
  const name = $derived(renamed ?? record.name);

  const slides = $derived(record.usedBy === 1 ? "1 slide" : `${record.usedBy} slides`);
</script>

<Panel title={name}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: deck.title, key: "resource.deck" }, { label: name }]}
      onnavigate={(key: string) => mockWorkbench.inspect(key, { kind: "deck", id: deckId })}
    />
  {/snippet}

  <PanelSection title="This layout">
    <PanelFields>
      <PanelField label="Name">
        <PanelEditableText
          label="Layout name"
          value={name}
          onchange={(next: string) => (renamed = next)}
        />
      </PanelField>
      <PanelField label="Placeholders" mono>{record.placeholders}</PanelField>
      <PanelField label="Locked content" mono>{record.locked}</PanelField>
      <PanelField label="Used by">{slides}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Background">
    <PanelFields>
      <PanelField label="Source">{record.backgroundSource}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Careful">
    <PanelNote tone="gap">
      Editing this layout changes every slide using it — {slides}.
    </PanelNote>
    <PanelNote>
      Slides keep their own copies of placeholder content. Only the frame, the
      locked content and the background come from here.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Actions">
    <PanelActions>
      <PanelButton
        label="Done"
        icon={Check}
        tone="primary"
        onclick={() => mockWorkbench.inspect("resource.deck", { kind: "deck", id: deckId })}
      />
      <PanelButton label="Duplicate" icon={Copy} />
    </PanelActions>
    <!-- Deliberately no delete: the Layouts view owns what happens to the slides. -->
    <PanelNote tone="gap">
      There is no delete here. A layout in use has slides pointing at it, and where
      they go is a decision the Layouts view makes.
    </PanelNote>
  </PanelSection>
</Panel>
