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
  } from "$components/authored/panel";
  import { cell, sheetStyle, spillAt, spreadsheetRecord } from "$capabilities/resource";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * A cell holding a literal value: its address, what it draws, what is stored in
   * it, and how it is formatted.
   *
   * `docs/screen-panel-views/inspector/resource/cell.md` is the specification.
   *
   * **A cell's identity is its A1 address**, so the address is the title. Rows and
   * columns are not identified model objects, which is why there is no row lens
   * and no column lens anywhere on this screen.
   *
   * **Value and Content are two different readings of the same cell.** Value is
   * what the grid paints with the format applied; Content is the string that is
   * stored, and it is the one that is editable — there is no formula bar, so this
   * is where a cell is written from outside the grid.
   */
  let {
    spreadsheetId = "r-cost",
    address = "C3"
  }: { spreadsheetId?: string; address?: string } = $props();

  const view = viewState();

  const sheet = $derived(spreadsheetRecord(spreadsheetId).current);
  const row = $derived(cell(spreadsheetId, address).current);
  const style = $derived(row?.styleId === undefined ? undefined : sheetStyle(row.styleId).current);
  const spill = $derived(spillAt(spreadsheetId, address).current);

  /** The edit, until there is a grid to write it to. */
  let edited = $state<string | undefined>(undefined);
  const content = $derived(edited ?? row?.content ?? "");

  const ALIGNMENT = { left: "Left", center: "Center", right: "Right" } as const;
</script>

<Panel title={address}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: sheet.title, key: "resource.spreadsheet" }, { label: address }]}
      onnavigate={(key) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  {#if row === undefined}
    <!--
      An empty coordinate, not a failure. The grid is sparse: nothing is persisted
      here, so there is no content, no format and nothing for a section to hold.
    -->
    <PanelNote>
      Nothing is stored at {address}. Type into it on the grid and it becomes a cell.
    </PanelNote>
  {:else}
    <!-- The head of the lens has no heading: the title already names the cell. -->
    <PanelFields>
      <PanelField label="Address" mono>{row.address}</PanelField>
      <PanelField label="Value" mono>{row.shows}</PanelField>
      <PanelField label="Type">{row.type}</PanelField>
    </PanelFields>

    <PanelSection title="Content">
      <PanelFields>
        <PanelField label="Stored" stacked>
          <PanelEditableText
            label="Cell content"
            value={content}
            mono
            onchange={(next) => (edited = next)}
          />
        </PanelField>
      </PanelFields>
      {#if row.content !== row.shows}
        <PanelNote>Stored unformatted: {row.content}, not {row.shows}.</PanelNote>
      {/if}
    </PanelSection>

    <PanelSection title="Format">
      <PanelFields>
        <PanelField label="Style">
          {#if style === undefined}
            None
          {:else}
            <PanelLink
              label={style.name}
              title="Open the {style.name} style"
              onselect={() =>
                view.inspect("resource.named-style-sheet", {
                  kind: "cell-style",
                  id: style.id
                })}
            />
          {/if}
        </PanelField>
        <PanelField label="Alignment">{ALIGNMENT[row.alignment]}</PanelField>
        <PanelField label="Value format" mono>
          {row.valueFormat ?? style?.valueFormat ?? "None"}
        </PanelField>
      </PanelFields>
    </PanelSection>

    <!-- Neither membership is why the cell was opened, so the band arrives shut. -->
    <PanelSection title="Merge and spill" open={false}>
      {#if spill === undefined}
        <PanelNote>{address} is not part of a merge or spill range.</PanelNote>
      {:else}
        <PanelFields>
          <PanelField label="Spill origin" mono>
            {#if spill.origin === address}
              {spill.origin}
            {:else}
              <PanelLink
                label={spill.origin}
                title="Open the formula that spilled here"
                onselect={() =>
                  view.inspect("resource.cell-with-formula", {
                    kind: "cell",
                    id: spill.origin
                  })}
              />
            {/if}
          </PanelField>
          <PanelField label="Occupied" mono>{spill.occupied}</PanelField>
          <PanelField label="Status">{spill.status}</PanelField>
        </PanelFields>
      {/if}
      <PanelNote tone="gap">
        Merge membership is not in the model, so this band can answer spill and not merge.
      </PanelNote>
    </PanelSection>
  {/if}
</Panel>
