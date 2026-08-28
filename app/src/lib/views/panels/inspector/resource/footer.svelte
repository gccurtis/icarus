<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelSection
  } from "$authored-components/panel";
  import { documentFooter, documentRecord } from "$capabilities/resource";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * The footer band, and the page number in it.
   *
   * `docs/screen-panel-views/inspector/resource/footer.md` is the specification.
   *
   * **The content carries `{page}`, never a number.** The number is generated
   * from the numbering settings, so the editable content shows the placeholder
   * and is set in mono: it is a string you would retype exactly.
   *
   * **The numbering settings are read-only here.** They are owned by the Page
   * view, and two editable copies of one setting are two settings that will
   * disagree. This section mirrors them and routes to the one that writes.
   */
  let { documentId = "r-memo" }: { documentId?: string } = $props();

  const view = viewState();

  const doc = $derived(documentRecord(documentId).current);
  const footer = $derived(documentFooter(documentId).current);

  let content = $state<string | undefined>(undefined);
  const shownContent = $derived(content ?? footer.content);
</script>

<Panel title="Footer">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: doc.title, key: "resource.document" }, { label: "Footer" }]}
      onnavigate={(key) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "resource", id: documentId });
      }}
    />
  {/snippet}

  <PanelFields>
    <PanelField label="Content" stacked>
      <PanelEditableText
        label="Footer content"
        value={shownContent}
        mono
        onchange={(next) => (content = next)}
      />
    </PanelField>
  </PanelFields>

  <PanelNote>
    <code class="font-mono">{"{page}"}</code>
    is where the generated number falls. The number itself is never typed.
  </PanelNote>

  <PanelSection title="Page number" flush>
    <PanelFields>
      <PanelField label="Position">{footer.numberPosition}</PanelField>
      <PanelField label="Start at" mono>{footer.startAt}</PanelField>
      <PanelField label="Show on first">{footer.showOnFirst ? "on" : "off"}</PanelField>
    </PanelFields>

    <PanelNote tone="gap">
      Numbering is set in the
      <PanelLink
        label="Page view"
        title="Open the Page view"
        onselect={() => view.selectContext("resource.page")}
      />
      and mirrored here. Which of the two is authoritative is unsettled.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Spacing" open={false} flush>
    <PanelFields>
      <PanelField label="From bottom" mono>{footer.fromBottom}</PanelField>
    </PanelFields>
  </PanelSection>
</Panel>
