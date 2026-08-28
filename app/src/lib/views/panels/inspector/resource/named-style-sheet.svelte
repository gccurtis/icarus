<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection,
    PanelSelect
  } from "$authored-components/panel";
  import { sheetStyle, spreadsheetRecord } from "$capabilities/resource";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * One named cell style, edited once for every cell using it.
   *
   * `docs/screen-panel-views/inspector/resource/named-style-sheet.md` is the
   * specification.
   *
   * **The identity fields are the edit.** A style is not a description of cells
   * that already look this way — changing a field here changes every cell wearing
   * the style, which is why Usage carries a count rather than a list.
   *
   * **Value format and border are shown where the style carries them.** The
   * specification asks whether they belong to the style or to the cell, and the
   * record answers the first half: it holds both. Fill is the half still
   * unanswered, and the band says so rather than drawing a control for it.
   */
  let {
    spreadsheetId = "r-cost",
    styleId = "cs-header"
  }: { spreadsheetId?: string; styleId?: string } = $props();

  const view = viewState();

  const sheet = $derived(spreadsheetRecord(spreadsheetId).current);
  const style = $derived(sheetStyle(styleId).current);

  /** The edits, until there is a `StyleSet` to write them to. */
  let renamed = $state<string | undefined>(undefined);
  let reweighted = $state<string | undefined>(undefined);
  let realigned = $state<string | undefined>(undefined);
  let reformatted = $state<string | undefined>(undefined);

  const name = $derived(renamed ?? style.name);
  const weight = $derived(reweighted ?? String(style.weight));
  const alignment = $derived(realigned ?? style.alignment);
  const valueFormat = $derived(reformatted ?? style.valueFormat ?? "");

  const WEIGHTS = [
    { value: "400", label: "400 · Regular" },
    { value: "500", label: "500 · Medium" },
    { value: "600", label: "600 · Semibold" },
    { value: "700", label: "700 · Bold" }
  ] as const;

  const ALIGNMENTS = [
    { value: "left", label: "Left" },
    { value: "center", label: "Center" },
    { value: "right", label: "Right" }
  ] as const;

  const usage = $derived(
    style.usedByCells === 0
      ? "No cell uses this style."
      : `Applied to ${style.usedByCells} ${style.usedByCells === 1 ? "cell" : "cells"}.`
  );
</script>

<Panel title={name}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: sheet.title, key: "resource.spreadsheet" }, { label: name }]}
      onnavigate={(key) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <!-- The head of the lens has no heading: the title already names the style. -->
  <PanelFields>
    <PanelField label="Name" stacked>
      <PanelEditableText label="Style name" value={name} onchange={(next) => (renamed = next)} />
    </PanelField>
    <PanelField label="Weight" stacked>
      <PanelSelect
        label="Weight"
        value={weight}
        options={WEIGHTS}
        onchange={(next) => (reweighted = next)}
      />
    </PanelField>
    <PanelField label="Alignment" stacked>
      <PanelSelect
        label="Alignment"
        value={alignment}
        options={ALIGNMENTS}
        onchange={(next) => (realigned = next)}
      />
    </PanelField>
    {#if style.valueFormat !== undefined}
      <PanelField label="Value format" stacked>
        <PanelEditableText
          label="Value format"
          value={valueFormat}
          mono
          placeholder="General"
          onchange={(next) => (reformatted = next)}
        />
      </PanelField>
    {/if}
    {#if style.border !== undefined}
      <PanelField label="Border">{style.border}</PanelField>
    {/if}
  </PanelFields>
  <PanelNote tone="gap">
    Fill is on neither the style nor the cell, and a border is a string rather than something a
    control can set. Until both are modelled, a style is typography, a value format and a rule.
  </PanelNote>

  <!-- How many cells wear it is context, not the reason the style was opened. -->
  <PanelSection title="Usage" count={style.usedByCells} open={false}>
    <PanelNote>{usage}</PanelNote>
    <PanelNote>Every field above is edited here once and applies to all of them.</PanelNote>
  </PanelSection>
</Panel>
