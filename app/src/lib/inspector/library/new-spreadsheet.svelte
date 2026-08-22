<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";

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
  import { spreadsheetDraft } from "$mock-capabilities/library";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * What a spreadsheet will be, before it exists.
   *
   * `docs/screen-panel-views/inspector/library/new-spreadsheet.md` is the
   * specification. The shortest of the three launchers: a spreadsheet has
   * nothing to decide up front — no paper, no aspect ratio, no sheets to name.
   *
   * **There is no Workbook section, deliberately.** The design deck still shows
   * one asking for a first sheet name, left over from before a spreadsheet
   * became one grid rather than a workbook of sheets. Create is inert for the
   * same reason as its siblings: minting the resource is a model step no door
   * here has.
   */
  const view = viewState();

  const draft = $derived(spreadsheetDraft().current);

  /** Undefined until touched, so an untouched field still reads from the door. */
  let title = $state<string>();
</script>

<Panel title="Spreadsheet">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "New tab" }, { label: "Create" }, { label: "Spreadsheet" }]}
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
          placeholder="Untitled spreadsheet"
          onchange={(next: string) => (title = next)}
        />
      </PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Create" flush>
    <PanelActions>
      <PanelButton label="Create spreadsheet" icon={Plus} tone="primary" />
    </PanelActions>
    <PanelNote>This tab becomes the spreadsheet. It does not open a second one.</PanelNote>
  </PanelSection>
</Panel>
