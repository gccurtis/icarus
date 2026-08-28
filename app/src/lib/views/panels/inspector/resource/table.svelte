<script lang="ts">
  import Columns3 from "@lucide/svelte/icons/columns-3";
  import Rows3 from "@lucide/svelte/icons/rows-3";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import { Separator } from "$vendored-components/separator";
  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$authored-components/panel";
  import { documentRecord, documentTable } from "$capabilities/resource";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * A table in the document body.
   *
   * `docs/screen-panel-views/inspector/resource/table.md` is the specification.
   * A document table is content, not a grid: no addresses, no formulas, no
   * calculation — that is what a spreadsheet is for, and nothing here pretends
   * otherwise.
   *
   * **Insert appends.** Inserting relative to a selected cell needs cell
   * selection, and this lens does not have it, so the two Insert actions add at
   * the end and the panel says so rather than implying a position it cannot
   * know.
   *
   * **Delete is last and separated.** The two Insert actions are what the panel
   * offers and sit in the actions row; the one that destroys the table does not
   * sit beside them.
   */
  let { documentId = "r-memo", tableId = "b_8d4" }: { documentId?: string; tableId?: string } =
    $props();

  const view = viewState();

  const doc = $derived(documentRecord(documentId).current);
  const table = $derived(documentTable(tableId).current);

  let addedRows = $state(0);
  let addedColumns = $state(0);

  const rows = $derived(table.rows + addedRows);
  const columns = $derived(table.columns + addedColumns);
  const bodyRows = $derived(table.headerRow ? rows - 1 : rows);

  /**
   * Widths are proportional, so adding a column redistributes all of them. The
   * stored distribution describes the stored columns and no others.
   */
  const widths = $derived(
    addedColumns === 0
      ? table.columnWidths.join(" · ")
      : `Redistributed across ${columns} columns`
  );
</script>

<Panel title="Table">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: doc.title, key: "resource.document" }, { label: "Table" }]}
      onnavigate={(key) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "resource", id: documentId });
      }}
    />
  {/snippet}

  {#snippet actions()}
    <PanelButton
      label="Insert row"
      icon={Rows3}
      title="Add a row at the end"
      onclick={() => (addedRows += 1)}
    />
    <PanelButton
      label="Insert column"
      icon={Columns3}
      title="Add a column at the end"
      onclick={() => (addedColumns += 1)}
    />
  {/snippet}

  <PanelFields>
    <PanelField label="Rows" mono>
      {rows}{table.headerRow ? " (1 header)" : ""}
    </PanelField>
    <PanelField label="Columns" mono>{columns}</PanelField>
    <PanelField label="Column widths" stacked mono>{widths}</PanelField>
  </PanelFields>

  <PanelNote>
    Widths are proportional, so the table survives a change of paper or gutters.
  </PanelNote>

  <PanelSection title="Structure" open={false} flush>
    <PanelRow title="Header row" meta={table.headerRow ? "Present" : "None"} />
    <PanelRow title="Body rows" meta={`${bodyRows}`} />

    <PanelNote tone="gap">
      The body model has no header-row flag yet. Styling the first row
      differently is not the same as declaring it a header, and only a
      declaration survives a page break.
    </PanelNote>
  </PanelSection>

  <Separator />

  <PanelActions>
    <PanelButton
      label="Delete table"
      icon={Trash2}
      tone="danger"
      onclick={() => view.inspect("resource.document", { kind: "resource", id: documentId })}
    />
  </PanelActions>
</Panel>
