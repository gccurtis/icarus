<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import X from "@lucide/svelte/icons/x";

  import {
    Panel,
    PanelControlGroup,
    PanelControlRow,
    PanelEmpty,
    PanelField,
    PanelFields,
    PanelSection
  } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import { Input } from "$vendored-components/input";
  import { columnIndexOf, columnLabel, gridOf, rectLabelOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { withRecalculation } from "$app-views/categories/spreadsheet-editor/procedures/evaluate";
  import { problemsOf } from "$app-views/categories/spreadsheet-editor/procedures/references";
  import { selectedRects } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import { formulaCount, populatedCount, usedRect } from "$app-views/categories/spreadsheet-editor/procedures/stats";
  import {
    frozenColumnsSet,
    insertedColumns,
    insertedRows,
    removedColumns,
    removedRows
  } from "$app-views/categories/spreadsheet-editor/procedures/structure";
  import { workspaceState, type SpreadsheetRuntime } from "$model/client/workspace-state";

  const view = workspaceState();

  const sheetId = $derived(view.active.resourceId);

  let runtime = $state<SpreadsheetRuntime | undefined>(undefined);

  $effect(() => {
    runtime = sheetId === undefined ? undefined : view.spreadsheetRuntime(sheetId);
  });

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const used = $derived(sheet === undefined ? undefined : usedRect(sheet, grid));
  const values = $derived(sheet === undefined ? 0 : populatedCount(sheet, grid));
  const formulas = $derived(sheet === undefined ? 0 : formulaCount(sheet));
  const problems = $derived(sheet === undefined ? 0 : problemsOf(sheet, grid).length);
  const rects = $derived(selectedRects(grid, view.selection));
  const primary = $derived(rects[0]);
  const frozenColumns = $derived(sheet?.body.frozenColumns ?? 0);

  let columnDraft = $state("");

  $effect(() => {
    columnDraft = frozenColumns === 0 ? "" : columnLabel(frozenColumns - 1);
  });

  const apply = (ops: Parameters<SpreadsheetRuntime["apply"]>[0]) => {
    if (ops.length === 0 || sheet === undefined) return;
    runtime?.apply(withRecalculation(sheet, ops));
  };

  const addRow = (where: "above" | "below") => {
    if (primary === undefined) {
      apply(insertedRows(where === "above" ? null : (grid.rows.at(-1)?.id ?? null), 1).ops);
      return;
    }
    const after = where === "above" ? (primary.row === 0 ? null : grid.rows[primary.row - 1].id) : grid.rows[Math.min(primary.row + primary.rows, grid.rows.length) - 1].id;
    apply(insertedRows(after, 1).ops);
  };

  const addColumn = (where: "left" | "right") => {
    if (primary === undefined) {
      apply(insertedColumns(where === "left" ? null : (grid.columns.at(-1)?.id ?? null), 1).ops);
      return;
    }
    const after =
      where === "left"
        ? primary.column === 0
          ? null
          : grid.columns[primary.column - 1].id
        : grid.columns[Math.min(primary.column + primary.columns, grid.columns.length) - 1].id;
    apply(insertedColumns(after, 1).ops);
  };

  const removeRows = () => {
    if (sheet === undefined || primary === undefined) return;
    const ids = grid.rows.slice(primary.row, primary.row + primary.rows).map((row) => row.id);
    if (ids.length === 0 || ids.length >= grid.rows.length) return;
    apply(removedRows(sheet, grid, ids));
    view.clear();
  };

  const removeColumns = () => {
    if (sheet === undefined || primary === undefined) return;
    const ids = grid.columns.slice(primary.column, primary.column + primary.columns).map((column) => column.id);
    if (ids.length === 0 || ids.length >= grid.columns.length) return;
    apply(removedColumns(sheet, grid, ids));
    view.clear();
  };

  const freezeColumns = (raw: string) => {
    if (sheet === undefined) return;
    const trimmed = raw.trim().toUpperCase();
    const index = /^[A-Z]{1,3}$/.test(trimmed) ? columnIndexOf(trimmed) : undefined;
    const count =
      trimmed === "" || trimmed === "-" || trimmed === "–"
        ? 0
        : /^\d+$/.test(trimmed)
          ? Number(trimmed)
          : index === undefined
            ? undefined
            : index + 1;
    if (count === undefined) {
      columnDraft = frozenColumns === 0 ? "" : columnLabel(frozenColumns - 1);
      return;
    }
    const op = frozenColumnsSet(sheet.body, count);
    if (op !== undefined) apply([op]);
    else columnDraft = frozenColumns === 0 ? "" : columnLabel(frozenColumns - 1);
  };

  const rowWord = $derived(primary === undefined || primary.rows === 1 ? "row" : `${primary.rows} rows`);
  const columnWord = $derived(primary === undefined || primary.columns === 1 ? "column" : `${primary.columns} columns`);
</script>

<Panel title="Grid">
  {#if sheet}
    <PanelSection title="This grid">
      <PanelFields>
        <PanelField label="Content cells">{used === undefined ? "Empty" : rectLabelOf(grid, used)}</PanelField>
        <PanelField label="Rows">{grid.rows.length}</PanelField>
        <PanelField label="Cols">{grid.columns.length}</PanelField>
        <PanelField label="Values">{values}</PanelField>
        <PanelField label="Formulas">{formulas}</PanelField>
        <PanelField label="Problems">{problems === 0 ? "None" : problems}</PanelField>
      </PanelFields>
    </PanelSection>

    <PanelSection title="Rows and columns">
      <PanelControlGroup flush>
        <PanelControlRow label="Row">
          <Button variant="outline" size="icon-xs" aria-label={`Insert ${rowWord} above`} title={`Insert ${rowWord} above`} onclick={() => addRow("above")}>
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button variant="outline" size="icon-xs" aria-label={`Insert ${rowWord} below`} title={`Insert ${rowWord} below`} onclick={() => addRow("below")}>
            <ArrowDown aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            aria-label={`Remove ${rowWord}`}
            title={primary === undefined ? "Select a cell first" : `Remove ${rowWord}`}
            disabled={primary === undefined}
            onclick={removeRows}
          >
            <X aria-hidden="true" />
          </Button>
        </PanelControlRow>
        <PanelControlRow label="Col">
          <Button variant="outline" size="icon-xs" aria-label={`Insert ${columnWord} left`} title={`Insert ${columnWord} left`} onclick={() => addColumn("left")}>
            <ArrowLeft aria-hidden="true" />
          </Button>
          <Button variant="outline" size="icon-xs" aria-label={`Insert ${columnWord} right`} title={`Insert ${columnWord} right`} onclick={() => addColumn("right")}>
            <ArrowRight aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            aria-label={`Remove ${columnWord}`}
            title={primary === undefined ? "Select a cell first" : `Remove ${columnWord}`}
            disabled={primary === undefined}
            onclick={removeColumns}
          >
            <X aria-hidden="true" />
          </Button>
        </PanelControlRow>
      </PanelControlGroup>
    </PanelSection>

    <PanelSection title="Frozen">
      <PanelControlGroup flush>
        <PanelControlRow label="Row">
          <Input
            value=""
            placeholder="–"
            disabled
            aria-label="Frozen rows"
            title="Not yet: the grid draws frozen columns and trailing rows only, so a leading frozen row needs a second stacked canvas"
            class="text-body-sm h-7 tabular-nums"
          />
        </PanelControlRow>
        <PanelControlRow label="Col">
          <Input
            value={columnDraft}
            placeholder="–"
            aria-label="Frozen columns"
            class="text-body-sm h-7 uppercase"
            oninput={(event: Event & { currentTarget: EventTarget & HTMLInputElement }) => {
              columnDraft = event.currentTarget.value;
            }}
            onchange={(event: Event & { currentTarget: EventTarget & HTMLInputElement }) => freezeColumns(event.currentTarget.value)}
          />
        </PanelControlRow>
      </PanelControlGroup>
    </PanelSection>
  {:else}
    <PanelEmpty title="Open a spreadsheet to see its grid" />
  {/if}
</Panel>
