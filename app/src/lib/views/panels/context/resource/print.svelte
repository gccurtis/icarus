<script lang="ts">
  import {
    Panel,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection,
    PanelSelect,
    PanelToggle
  } from "$authored-components/panel";
  import { printSetup, type PrintSetup } from "$capabilities/resource";

  /**
   * Getting a grid onto paper.
   *
   * `docs/screen-panel-views/context/resource/print.md` is the specification. A
   * grid has no natural page, so every setting here is a decision someone has to
   * make — which is why print is a view you can sit with rather than a dialog
   * sprung at the moment of printing.
   *
   * **The settings are read once and then edited in place.** There is nowhere to
   * write them back to yet, so a re-read on every change would throw the edit
   * away.
   *
   * **Paper and scale show what is stored rather than offering a choice.** The
   * model carries neither a set of papers nor a set of scales, and a free-text
   * field over "Letter" would be worse than a plain fact. Orientation has its two
   * values in the model, so it is a control.
   *
   * Every section is flush: fields, notes and the pairs inside them each carry
   * the panel's padding already, and a padded section would inset them twice.
   */
  let { spreadsheetId = "r-cost" }: { spreadsheetId?: string } = $props();

  // Capturing the initial value is the intent, not an oversight.
  // svelte-ignore state_referenced_locally
  const stored = printSetup(spreadsheetId).current;

  let orientation = $state<PrintSetup["orientation"]>(stored.orientation);
  let printArea = $state(stored.printArea);
  let repeatRows = $state(stored.repeatRows);
  let repeatColumns = $state(stored.repeatColumns);
  let gridlines = $state(stored.gridlines);
  let headings = $state(stored.headings);

  const ORIENTATIONS = [
    { value: "Portrait", label: "Portrait" },
    { value: "Landscape", label: "Landscape" }
  ] as const;
</script>

<Panel title="Print">
  <PanelSection title="Page setup" flush>
    <PanelFields>
      <PanelField label="Paper">{stored.paper}</PanelField>
      <PanelField label="Orientation">
        <PanelSelect
          label="Orientation"
          value={orientation}
          options={ORIENTATIONS}
          onchange={(next) => (orientation = next as PrintSetup["orientation"])}
        />
      </PanelField>
      <PanelField label="Scale">{stored.scale}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Area and repeats" flush>
    <!--
      Repeats are what keep a table readable past page one, which is why they sit
      beside the print area rather than under Show: all three answer "what goes on
      the paper", and only the two below answer "what it looks like".
    -->
    <PanelFields>
      <PanelField label="Print area">
        <PanelEditableText
          label="Print area"
          value={printArea}
          mono
          onchange={(next) => (printArea = next)}
        />
      </PanelField>
      <PanelField label="Repeat rows">
        <PanelEditableText
          label="Repeat rows"
          value={repeatRows}
          mono
          placeholder="None"
          onchange={(next) => (repeatRows = next)}
        />
      </PanelField>
      <PanelField label="Repeat columns">
        <PanelEditableText
          label="Repeat columns"
          value={repeatColumns}
          mono
          placeholder="None"
          onchange={(next) => (repeatColumns = next)}
        />
      </PanelField>
    </PanelFields>

    <PanelNote tone="gap">
      All three are ranges, and a range shifts when a row or a column is inserted.
      They belong in the structural-rebase contract with everything else that
      holds an address, and there is no such contract yet.
    </PanelNote>
  </PanelSection>

  <!-- Two flags qualifying the page rather than defining it, so it arrives shut. -->
  <PanelSection title="Show" open={false} flush>
    <PanelFields>
      <PanelField label="Gridlines">
        <PanelToggle label="Gridlines" checked={gridlines} onchange={(next) => (gridlines = next)} />
      </PanelField>
      <PanelField label="Headings">
        <PanelToggle label="Headings" checked={headings} onchange={(next) => (headings = next)} />
      </PanelField>
    </PanelFields>
  </PanelSection>
</Panel>
