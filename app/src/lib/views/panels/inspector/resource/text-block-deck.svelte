<script lang="ts">
  import SquareFunction from "@lucide/svelte/icons/square-function";

  import {
    Panel,
    PanelChoice,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelLink,
    PanelMarks,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$components/authored/panel";
  import { deckTextBlock, element, marksFor } from "$capabilities/resource";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * The text inside an element: the ordinary content object, the same kind of
   * thing the document editor edits.
   *
   * `docs/screen-panel-views/inspector/resource/text-block-deck.md` is the
   * specification.
   *
   * **The element around it is a separate lens, and the separation is the point.**
   * Frame, rotation and overflow belong to the box; text, style and marks belong
   * to the block. Nothing spatial appears here, which is why Ancestry exists at
   * the bottom to say so once rather than leaving a reader to wonder where the
   * width went.
   */
  let {
    blockId = "b_2c8",
    elementId = "el-body-4"
  }: { blockId?: string; elementId?: string } = $props();

  const view = viewState();

  const block = $derived(deckTextBlock(blockId).current);
  const box = $derived(element(elementId).current);
  const marks = $derived(marksFor("slides").current);

  let draft = $state<string | undefined>(undefined);
  const text = $derived(draft ?? block.text);

  const ALIGNMENT = [
    { value: "Left", label: "Left" },
    { value: "Center", label: "Center" },
    { value: "Right", label: "Right" }
  ] as const;

  let alignmentOverride = $state<string | undefined>(undefined);
  const alignment = $derived(alignmentOverride ?? block.alignment);

  /** Marks are independent of one another, so several can be on at once. */
  let marksOverride = $state<string[] | undefined>(undefined);
  const active = $derived(
    marksOverride ?? marks.filter((mark) => mark.active).map((mark) => mark.id)
  );
</script>

<Panel title="Text">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: box.name, key: "resource.element" }, { label: "Text" }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "element", id: elementId });
      }}
    />
  {/snippet}

  <PanelSection title="Text">
    <PanelEditableText
      label="Text"
      value={text}
      multiline
      onchange={(next: string) => (draft = next)}
    />
  </PanelSection>

  <PanelSection title="Style">
    <PanelFields>
      <PanelField label="Named style">
        <PanelLink
          label={block.styleName}
          title="Open the named style"
          onselect={() =>
            view.inspect("resource.named-style-deck", {
              kind: "style",
              id: block.styleId
            })}
        />
      </PanelField>
    </PanelFields>
    <PanelChoice
      label="Alignment"
      value={alignment}
      options={ALIGNMENT}
      onchange={(next: string) => (alignmentOverride = next)}
    />
  </PanelSection>

  <PanelSection title="Marks">
    <PanelMarks
      label="Marks"
      value={active}
      options={marks.map((mark) => ({ value: mark.id, label: mark.label }))}
      onchange={(next: string[]) => (marksOverride = next)}
    />
  </PanelSection>

  <PanelSection title="Inline formula" count={block.formulas.length} flush>
    {#each block.formulas as formula (formula.id)}
      <PanelRow
        title={formula.expression}
        sub="{formula.shows} · {formula.readsWhen}"
        icon={SquareFunction}
        onselect={() =>
          view.inspect("analysis.variable", { kind: "variable", id: formula.id })}
      >
        <!-- An expression is retyped, so it is set in mono even inside a row. -->
        <span title={formula.expression} class="text-body-sm truncate font-mono">
          {formula.expression}
        </span>
      </PanelRow>
    {/each}
  </PanelSection>

  <PanelSection title="Ancestry" open={false}>
    <PanelNote>
      The element is the spatial container; this block is the ordinary content
      object inside it. The element's frame, rotation and overflow never reach the
      content, which is why there are two lenses here rather than one.
    </PanelNote>
  </PanelSection>
</Panel>
