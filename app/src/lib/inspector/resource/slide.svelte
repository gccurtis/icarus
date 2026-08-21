<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import Plus from "@lucide/svelte/icons/plus";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import SquarePen from "@lucide/svelte/icons/square-pen";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import { Separator } from "$lib/simple-components/separator";
  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelSection,
    PanelToggle
  } from "$lib/unique-components/panel";
  import { deckRecord, notesFor, slide } from "$mock-capabilities/resource";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * A slide, selected in the Slides panel rather than something on it.
   *
   * `docs/screen-panel-views/inspector/resource/slide.md` is the specification.
   *
   * **Speaker notes come first and are read-only here.** They belong to the slide
   * and this is where a person looks for them now that they are off the canvas,
   * but the notes lens is the editor — two writable copies of the same paragraph
   * is how one of them quietly wins.
   *
   * **Duplicate and New after carry no handler.** Both mint ids for the slide and
   * every identified descendant, which is the real model's job; Delete clears the
   * selection, because that much is true at the selection level.
   */
  let { slideId = "sl-4", deckId = "r-board" }: { slideId?: string; deckId?: string } = $props();

  const record = $derived(slide(slideId).current);
  const notes = $derived(notesFor(slideId).current);
  const deck = $derived(deckRecord(deckId).current);

  /** Undefined until someone flips it, so the door stays the answer until then. */
  let hiddenOverride = $state<boolean | undefined>(undefined);
  const hidden = $derived(hiddenOverride ?? record.hidden);
</script>

<Panel title={record.title}>
  {#snippet crumbs()}
    <!-- The section has no lens of its own, so it names the place without a key. -->
    <PanelCrumbs
      trail={[
        { label: deck.title, key: "resource.deck" },
        { label: record.sectionName },
        { label: `Slide ${record.index}` }
      ]}
      onnavigate={(key: string) => mockWorkbench.inspect(key, { kind: "deck", id: deckId })}
    />
  {/snippet}

  <PanelSection title="Speaker notes">
    <PanelEditableText label="Speaker notes" value={notes.content} placeholder="No notes" multiline />
    <PanelActions>
      <PanelButton
        label="Edit notes"
        icon={SquarePen}
        onclick={() =>
          mockWorkbench.inspect("resource.speaker-notes", { kind: "notes", id: slideId })}
      />
    </PanelActions>
  </PanelSection>

  <PanelSection title="Slide">
    <PanelFields>
      <PanelField label="Layout">
        <PanelLink
          label={record.layoutName}
          title="Open the layout"
          onselect={() =>
            mockWorkbench.inspect("resource.layout", { kind: "layout", id: record.layoutId })}
        />
      </PanelField>
      <PanelField label="Section">{record.sectionName}</PanelField>
      <PanelField label="Background">{record.background}</PanelField>
    </PanelFields>

    <!-- A switch is a control rather than a fact, so it sits outside the field list. -->
    <PanelToggle label="Hidden" checked={hidden} onchange={(next: boolean) => (hiddenOverride = next)} />
  </PanelSection>

  <Separator />

  <PanelSection title="Actions">
    <PanelActions>
      <PanelButton label="Duplicate" icon={Copy} />
      <PanelButton label="New after" icon={Plus} />
      <PanelButton label="Delete" icon={Trash2} tone="danger" onclick={() => mockWorkbench.clear()} />
    </PanelActions>
  </PanelSection>

  <PanelSection title="Reset" open={false}>
    <PanelActions>
      <PanelButton
        label="Reset to layout"
        icon={RotateCcw}
        disabled
        title="Two placeholders share this role, so there is no single frame to reset to."
      />
    </PanelActions>
    <PanelNote tone="gap">
      Reset is available only where the element's placeholder resolves to exactly
      one role. Placeholders have no stable key, so a layout with two of the same
      role cannot promise which one a slide came from.
    </PanelNote>
  </PanelSection>
</Panel>
