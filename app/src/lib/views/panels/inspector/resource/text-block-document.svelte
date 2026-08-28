<script lang="ts">
  import {
    Panel,
    PanelChoice,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelQuote,
    PanelSection
  } from "$authored-components/panel";
  import { documentRecord, textBlock, type TextBlock } from "$capabilities/resource";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * A whole block of the document body — a paragraph, a heading, a list.
   *
   * `docs/screen-panel-views/inspector/resource/text-block-document.md` is the
   * specification. Selecting the block rather than text inside it: marks belong
   * to a range and live in the text-selection lens, while variant and spacing
   * belong to the block and live here.
   *
   * **The variant and alignment sets are read off the block's own types.** There
   * is no door listing what the body model supports, and a list invented in this
   * file would be sample content; taking the union from `TextBlock` keeps the
   * control and the model in step.
   *
   * **An edit is local.** Every door here is a read, so a change is held in this
   * component until there is a capability to write it back.
   */
  let {
    documentId = "r-memo",
    blockId = "b_3d7"
  }: { documentId?: string; blockId?: string } = $props();

  const view = viewState();

  const doc = $derived(documentRecord(documentId).current);
  const block = $derived(textBlock(blockId).current);

  const VARIANTS: readonly { value: TextBlock["variant"]; label: string }[] = [
    { value: "Body", label: "Body" },
    { value: "Heading 1", label: "Heading 1" },
    { value: "Heading 2", label: "Heading 2" },
    { value: "Quote", label: "Quote" },
    { value: "Code", label: "Code" }
  ];

  const ALIGNMENTS: readonly { value: TextBlock["alignment"]; label: string }[] = [
    { value: "Left", label: "Left" },
    { value: "Center", label: "Center" },
    { value: "Right", label: "Right" }
  ];

  let variant = $state<string | undefined>(undefined);
  let alignment = $state<string | undefined>(undefined);
  let spaceBefore = $state<string | undefined>(undefined);
  let spaceAfter = $state<string | undefined>(undefined);

  const shown = $derived({
    variant: variant ?? block.variant,
    alignment: alignment ?? block.alignment,
    spaceBefore: spaceBefore ?? block.spaceBefore,
    spaceAfter: spaceAfter ?? block.spaceAfter
  });
</script>

<Panel title="Text block">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: doc.title, key: "resource.document" }, { label: "Text block" }]}
      onnavigate={(key) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "resource", id: documentId });
      }}
    />
  {/snippet}

  <!-- The content, quoted, so a reader can tell which of six paragraphs they have. -->
  <PanelQuote>{block.text}</PanelQuote>

  <PanelSection title="Variant" flush>
    <PanelChoice
      label="Variant"
      value={shown.variant}
      options={VARIANTS}
      onchange={(next) => (variant = next)}
    />
    <PanelNote>Changing this changes what the block means, not how it looks.</PanelNote>
  </PanelSection>

  <!--
    Alignment and the space around the block. Line spacing is deliberately not
    here: it is set on the named style, which is what makes it the same
    everywhere the style is used.
  -->
  <PanelSection title="Block format" flush>
    <PanelChoice
      label="Alignment"
      value={shown.alignment}
      options={ALIGNMENTS}
      onchange={(next) => (alignment = next)}
    />

    <PanelFields>
      <PanelField label="Space before">
        <PanelEditableText
          label="Space before"
          value={shown.spaceBefore}
          mono
          onchange={(next) => (spaceBefore = next)}
        />
      </PanelField>
      <PanelField label="Space after">
        <PanelEditableText
          label="Space after"
          value={shown.spaceAfter}
          mono
          onchange={(next) => (spaceAfter = next)}
        />
      </PanelField>
    </PanelFields>

    <PanelNote tone="gap">
      Space after is carried by the named style as well as by the block. Which
      wins, and whether the block value should be marked as an override, is
      unsettled.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Placement" open={false} flush>
    <PanelFields>
      <PanelField label="Row">{block.rowPosition}</PanelField>
      <PanelField label="Page">{block.page} (computed)</PanelField>
    </PanelFields>

    <PanelNote>
      The page is a label for where this block currently falls, not an address —
      it moves when paper or gutters change.
    </PanelNote>
  </PanelSection>
</Panel>
