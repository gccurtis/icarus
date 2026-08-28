<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$authored-components/panel";
  import { documentRecord, documentStyle } from "$capabilities/resource";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * One named text style: its typography and spacing, edited once for everywhere
   * it is used.
   *
   * `docs/screen-panel-views/inspector/resource/named-style-document.md` is the
   * specification. Editing a style changes every block using it — that is the
   * point of a style and the risk of one.
   *
   * **The usage count sits on the Usage header, so it is legible while the
   * section is shut.** The specification leaves open whether the count belongs
   * at the top of the lens; putting the number in the header answers the part
   * that mattered — how much this affects is visible *before* an edit — without
   * a second band competing with identity.
   *
   * **The trail mixes two destinations on purpose.** A style is reached from the
   * Styles context view, so that crumb selects a context; the document crumb
   * inspects. The trail says where the style sits, and where it sits is in both.
   */
  let {
    documentId = "r-memo",
    styleId = "ds-body"
  }: { documentId?: string; styleId?: string } = $props();

  const view = viewState();

  const doc = $derived(documentRecord(documentId).current);
  const style = $derived(documentStyle(styleId).current);

  type Draft = {
    name?: string;
    family?: string;
    size?: string;
    lineHeight?: string;
    weight?: string;
    spaceAfter?: string;
    indent?: string;
  };

  /** Every door here is a read, so an edit is held locally until there is one that writes. */
  let draft = $state<Draft>({});

  const shown = $derived({
    name: draft.name ?? style.name,
    family: draft.family ?? style.family,
    size: draft.size ?? style.size,
    lineHeight: draft.lineHeight ?? style.lineHeight,
    weight: draft.weight ?? String(style.weight),
    spaceAfter: draft.spaceAfter ?? style.spaceAfter,
    indent: draft.indent ?? style.indent
  });

  const navigate = (key: string) => {
    if (key === "resource.styles-document") view.selectContext(key);
    else if (isInspectionKey(key)) view.inspect(key, { kind: "resource", id: documentId });
  };
</script>

<Panel title={shown.name}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: doc.title, key: "resource.document" },
        { label: "Styles", key: "resource.styles-document" },
        { label: shown.name }
      ]}
      onnavigate={navigate}
    />
  {/snippet}

  <PanelFields>
    <PanelField label="Name">
      <PanelEditableText
        label="Style name"
        value={shown.name}
        onchange={(next) => (draft.name = next)}
      />
    </PanelField>
    <PanelField label="Based on">{style.basedOn}</PanelField>
  </PanelFields>

  <PanelSection title="Typography" flush>
    <PanelFields>
      <PanelField label="Family">
        <PanelEditableText
          label="Family"
          value={shown.family}
          onchange={(next) => (draft.family = next)}
        />
      </PanelField>
      <PanelField label="Size">
        <PanelEditableText
          label="Size"
          value={shown.size}
          mono
          onchange={(next) => (draft.size = next)}
        />
      </PanelField>
      <PanelField label="Line height">
        <PanelEditableText
          label="Line height"
          value={shown.lineHeight}
          mono
          onchange={(next) => (draft.lineHeight = next)}
        />
      </PanelField>
      <PanelField label="Weight">
        <PanelEditableText
          label="Weight"
          value={shown.weight}
          mono
          onchange={(next) => (draft.weight = next)}
        />
      </PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Spacing" open={false} flush>
    <PanelFields>
      <PanelField label="Space after">
        <PanelEditableText
          label="Space after"
          value={shown.spaceAfter}
          mono
          onchange={(next) => (draft.spaceAfter = next)}
        />
      </PanelField>
      <PanelField label="Indent">
        <PanelEditableText
          label="Indent"
          value={shown.indent}
          mono
          onchange={(next) => (draft.indent = next)}
        />
      </PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Usage" count={style.usedByBlocks} open={false} flush>
    <PanelNote>
      Applied to {style.usedByBlocks} blocks in this document. An edit above changes
      all of them.
    </PanelNote>
  </PanelSection>
</Panel>
