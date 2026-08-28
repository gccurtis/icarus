<script lang="ts">
  import {
    Panel,
    PanelActor,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelSection
  } from "$authored-components/panel";
  import { PEOPLE } from "$capabilities/cast";
  import { documentRecord, pageSetup } from "$capabilities/resource";
  import { viewState } from "$model/client/view-state";

  /**
   * The document itself — the lens the inspector shows when nothing is selected.
   *
   * `docs/screen-panel-views/inspector/resource/document.md` is the
   * specification. Four bands: what this document is, what to do next, how the
   * page is set up, and who made it.
   *
   * **The middle band is the compensation for having no toolbar.** An editor
   * with no toolbar and an empty inspector gives a reader no instruction at all,
   * so nothing selected is a state that says what to do next rather than a blank
   * panel.
   *
   * **No breadcrumb.** A trail is furniture on every other lens because every
   * other lens is inside something. This is the outermost thing there is, and a
   * one-entry trail with nowhere to go says nothing.
   */
  let { documentId = "r-memo" }: { documentId?: string } = $props();

  const view = viewState();

  const doc = $derived(documentRecord(documentId).current);
  const setup = $derived(pageSetup(documentId).current);

  /** The creator is stored as a name, so the face is a target only where the name resolves to someone. */
  const creator = $derived(PEOPLE.find((person) => person.name === doc.createdBy));

  /** Top, bottom, inside, outside on one line, with the unit said once. */
  const gutters = $derived(
    `${[setup.margins.top, setup.margins.bottom, setup.margins.inside, setup.margins.outside]
      .map((margin) => margin.replace(" in", ""))
      .join(" / ")} in`
  );
</script>

<Panel title={doc.title}>
  <PanelFields>
    <PanelField label="Title">{doc.title}</PanelField>
    <PanelField label="Pages" mono>{doc.pages}</PanelField>
    <PanelField label="Words" mono>{doc.words.toLocaleString("en-US")}</PanelField>
    <PanelField label="Saved">{doc.saved}</PanelField>
  </PanelFields>

  <!--
    The one sentence that replaces the toolbar. It names the four things worth
    clicking and where new content comes from, because none of that is visible
    on an empty page.
  -->
  <PanelNote>
    Click a block, a formula, the header or the footer to change it. To add
    something,
    <PanelLink
      label="Insert"
      title="Open the Insert view"
      onselect={() => view.selectContext("resource.insert-document")}
    />
    is in the context panel.
  </PanelNote>

  <PanelSection title="Page setup" open={false} flush>
    <PanelFields>
      <PanelField label="Paper">{setup.paper} · {setup.orientation}</PanelField>
      <PanelField label="Gutters" mono>{gutters}</PanelField>
    </PanelFields>

    <PanelNote>
      A summary. Paper, gutters and numbering are edited in the
      <PanelLink
        label="Page view"
        title="Open the Page view"
        onselect={() => view.selectContext("resource.page")}
      />.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Attribution" open={false} flush>
    <PanelFields>
      <PanelField label="Created by">
        {#if creator}
          <PanelActor
            name={creator.name}
            kind="person"
            onselect={() =>
              view.inspect("collaboration.person", { kind: "person", id: creator.id })}
          />
        {:else}
          {doc.createdBy}
        {/if}
      </PanelField>
      <PanelField label="Updated">{doc.updated}</PanelField>
    </PanelFields>
  </PanelSection>
</Panel>
