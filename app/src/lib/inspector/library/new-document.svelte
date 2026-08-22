<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChoice,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { documentDraft } from "$mock-capabilities/library";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * What a document will be, before it exists.
   *
   * `docs/screen-panel-views/inspector/library/new-document.md` is the
   * specification. Everything here is draft state the launcher tab holds: the
   * door hands back the defaults the editor will open with, an edit stays local,
   * and nothing is written until **Create**.
   *
   * **Create sits at the end of the body rather than in `actions`.** A panel has
   * no footer for the usual reason — controls get buried under content of
   * unbounded length — but this is a bounded form, and the last thing in a
   * three-field form is its commit. It is inert: minting the resource and
   * rebinding the tab to it is a model step no door here has.
   */
  const view = viewState();

  const draft = $derived(documentDraft().current);

  /** Undefined until touched, so an untouched field still reads from the door. */
  let title = $state<string>();
  let paper = $state<string>();
  let orientation = $state<string>();

  const options = (names: readonly string[]) =>
    names.map((name: string) => ({ value: name, label: name }));
</script>

<Panel title="Document">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "New tab" }, { label: "Create" }, { label: "Document" }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <PanelSection title="Identity" flush>
    <PanelFields>
      <PanelField label="Title" stacked>
        <PanelEditableText
          label="Title"
          value={title ?? draft.title}
          placeholder="Untitled document"
          onchange={(next: string) => (title = next)}
        />
      </PanelField>
    </PanelFields>
  </PanelSection>

  <!--
    Paper and orientation are asked now because changing either later reflows a
    document that already has content in it.
  -->
  <PanelSection title="Page" flush>
    <PanelFields>
      <PanelField label="Paper" stacked>
        <PanelChoice
          label="Paper"
          value={paper ?? draft.paper}
          options={options(draft.papers)}
          flush
          onchange={(next: string) => (paper = next)}
        />
      </PanelField>
      <PanelField label="Orientation" stacked>
        <PanelChoice
          label="Orientation"
          value={orientation ?? draft.orientation}
          options={options(draft.orientations)}
          flush
          onchange={(next: string) => (orientation = next)}
        />
      </PanelField>
      <PanelField label="Margins">{draft.margins}</PanelField>
    </PanelFields>

    <PanelNote tone="gap">
      There is no modeled project or user default to pre-select, so the default is
      hard-coded. Whether it should be a project setting is unsettled.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Create" flush>
    <PanelActions>
      <PanelButton label="Create document" icon={Plus} tone="primary" />
    </PanelActions>
    <PanelNote>This tab becomes the document. It does not open a second one.</PanelNote>
  </PanelSection>
</Panel>
