<script lang="ts">
  import {
    Panel,
    PanelActor,
    PanelChip,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelSection
  } from "$components/authored/panel";
  import { PEOPLE, VIEWER } from "$capabilities/cast";
  import { members } from "$capabilities/collaboration";
  import { kindLabel } from "$capabilities/library";
  import { documentRecord } from "$capabilities/resource";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * The document as a whole — what it is, who is in it, whether it is safe.
   *
   * `docs/screen-panel-views/context/overview/document.md` is the specification.
   * The first rail entry, and where the document's identity lives: the editor
   * carries no header bar across its top, so the page is the page.
   *
   * **The identity band is not a section**, for the same reason the title is not
   * behind a disclosure anywhere else: hiding the name of the thing you are
   * editing is not a state worth offering.
   *
   * **Saved is a chip, not a control.** The editor owns saving; this reports it
   * in the shell's shared save language so the word means the same thing on
   * every screen.
   */
  let { documentId = "r-memo" }: { documentId?: string } = $props();

  const it = $derived(documentRecord(documentId).current);
  const everyone = $derived(members().current);

  let titleDraft = $state("");

  /**
   * Presence carries the resource someone is in, so who has this open is the
   * people whose presence names this document.
   */
  const editors = $derived(everyone.filter((person) => person.at === it.title));

  const author = $derived(PEOPLE.find((person) => person.name === it.createdBy));
</script>

<Panel title="Overview">
  <PanelFields>
    <PanelField label="Title" stacked>
      <PanelEditableText
        value={titleDraft || it.title}
        label="Document title"
        onchange={(next: string) => (titleDraft = next)}
      />
    </PanelField>
    <PanelField label="Kind">{kindLabel("document")}</PanelField>
    <PanelField label="Pages" mono>{it.pages}</PanelField>
    <PanelField label="Words" mono>{it.words.toLocaleString()}</PanelField>
  </PanelFields>

  <PanelNote>
    Pages are a property of the current layout rather than something stored — the
    count moves with paper and gutters.
  </PanelNote>

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
      Presence names the resource someone is in, not where inside it. Page
      positions are not modelled.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Saved">
    <PanelChip tone="success">{it.saved}</PanelChip>
  </PanelSection>

  <!--
    Provenance only. Later edits to a template never reach a document made from
    it, so there is nothing here to follow or refresh.
  -->
  <PanelSection title="From template" open={false}>
    <PanelNote tone="gap">
      A document records no template origin, so where this came from cannot be
      shown.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Attribution" open={false}>
    <PanelFields>
      <PanelField label="Created by">
        {#if author}
          <PanelLink
            label={it.createdBy}
            title="{it.createdBy} — person"
            onselect={() =>
              view.inspect("collaboration.person", { kind: "person", id: author.id })}
          />
        {:else}
          {it.createdBy}
        {/if}
      </PanelField>
      <!-- No creation timestamp on the record, so Created is absent rather than guessed. -->
      <PanelField label="Updated" mono>{it.updated}</PanelField>
    </PanelFields>
  </PanelSection>
</Panel>
