<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection,
    PanelToggle
  } from "$authored-components/panel";
  import { documentHeader, documentRecord } from "$capabilities/resource";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * The header band, on any page.
   *
   * `docs/screen-panel-views/inspector/resource/header.md` is the specification.
   *
   * **Height is a fact, not a field.** It is measured from the content rather
   * than authored, so it is rendered as a value with no way to type into it —
   * an editable height here would be a control that silently loses what you set.
   *
   * **The first-page body only appears when the first page differs.** A second
   * header shown beside a switch that is off is a value with no effect, and a
   * reader cannot tell which of the two is on the page.
   */
  let { documentId = "r-memo" }: { documentId?: string } = $props();

  const view = viewState();

  const doc = $derived(documentRecord(documentId).current);
  const header = $derived(documentHeader(documentId).current);

  let content = $state<string | undefined>(undefined);
  let fromTop = $state<string | undefined>(undefined);
  let differs = $state<boolean | undefined>(undefined);

  const shown = $derived({
    content: content ?? header.content,
    fromTop: fromTop ?? header.fromTop,
    differs: differs ?? header.firstPageDiffers
  });
</script>

<Panel title="Header">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: doc.title, key: "resource.document" }, { label: "Header" }]}
      onnavigate={(key) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "resource", id: documentId });
      }}
    />
  {/snippet}

  <PanelFields>
    <PanelField label="Content" stacked>
      <PanelEditableText
        label="Header content"
        value={shown.content}
        onchange={(next) => (content = next)}
      />
    </PanelField>
  </PanelFields>

  <PanelSection title="Spacing" flush>
    <PanelFields>
      <PanelField label="From top">
        <PanelEditableText
          label="From top"
          value={shown.fromTop}
          mono
          onchange={(next) => (fromTop = next)}
        />
      </PanelField>
      <PanelField label="Height" mono>{header.height}</PanelField>
    </PanelFields>

    <PanelNote>Height is measured from the content rather than set.</PanelNote>
  </PanelSection>

  <PanelSection title="First page" flush>
    <PanelFields>
      <PanelField label="Differs">
        <PanelToggle
          label="First page differs"
          checked={shown.differs}
          onchange={(next) => (differs = next)}
        />
      </PanelField>

      {#if shown.differs}
        <PanelField label="First-page header">{header.firstPageContent}</PanelField>
      {/if}
    </PanelFields>
  </PanelSection>

  <!--
    Said in the panel because the header is visibly repeated, and repetition
    suggests independent copies. A footnote rather than a section: it is what the
    lens wants to say after its contents, not a thing the lens holds.
  -->
  <PanelNote>
    There is one header. What appears on every page is a read-only projection of
    that one state — you are never editing the header on page 3.
  </PanelNote>
</Panel>
