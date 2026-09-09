<script lang="ts">
  import {
    Panel,
    PanelButton,
    PanelChip,
    PanelCrumbs,
    PanelEmpty,
    PanelRow,
    PanelSection
  } from "$authored-components/panel";
  import CellComments from "$app-views/categories/spreadsheet-editor/components/cell-comments.svelte";
  import CellHead from "$app-views/categories/spreadsheet-editor/components/cell-head.svelte";
  import { gridOf, labelOf, type CellRef } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { cellAt, cleared, type Edit } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import { factsOf, recalculating } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
  import { paintOf } from "$app-views/categories/spreadsheet-editor/procedures/formatting";
  import {
    explanationOf,
    precedentsOf,
    referencesIn,
    sheetNamed,
    type Dependency,
    type Reference
  } from "$app-views/categories/spreadsheet-editor/procedures/references";
  import { cellSignal, selectedRef } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import { rowsOf, tableQuery } from "$app-views/categories/spreadsheet-editor/procedures/store";
  import { ERROR_NAMES, displayOf, errorOf, type ErrorToken, type SheetCell } from "$app-views/categories/spreadsheet-editor/procedures/values";
  import { holdsTheRuntime } from "$app-views/categories/spreadsheet-editor/procedures/effects/holds-the-runtime.svelte";
  import { isInspectorView, workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();

  const sheetId = $derived(view.active.resourceId);

  const attached = holdsTheRuntime();
  const runtime = $derived(attached.current);

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const ref = $derived(selectedRef(view.selection));
  const held = $derived(sheet === undefined || ref === undefined ? undefined : cellAt(sheet, ref));
  const label = $derived(ref === undefined ? "?" : labelOf(grid, ref));
  const error = $derived(errorOf(held));
  const explanation = $derived(explanationOf(held));
  const facts = $derived(factsOf(sheetId, sheet));
  const precedents = $derived(sheet === undefined || ref === undefined ? [] : precedentsOf(sheet, facts, ref));
  const unresolved = $derived(
    referencesIn(facts, held).filter((reference) => reference.rect === undefined && reference.kind !== "external")
  );

  const sheetRows = tableQuery("spreadsheets");
  const sheets = $derived(rowsOf(sheetRows, "spreadsheets"));

  const apply = (edit: Edit) => {
    if (edit.refused === undefined && edit.ops.length > 0 && sheet !== undefined) runtime?.apply(recalculating(view.project, sheetId, sheet, edit.ops));
  };

  const shown = (cell: SheetCell | undefined, target: CellRef): string => {
    if (sheet === undefined || cell === undefined) return "empty";
    const text = displayOf(cell.value, paintOf(sheet.body, grid, target, cell).format.valueFormat);
    return text === "" ? (cell.expression ?? "empty") : text;
  };

  const go = (dependency: Dependency) => {
    if (sheet === undefined || runtime === undefined) return;
    runtime.scrollTo = dependency.ref;
    const signal = cellSignal(sheet, grid, dependency.ref);
    view.inspect(signal.key, signal.selection);
  };

  const targetOf = (reference: Reference) =>
    reference.sheet === undefined ? undefined : sheetNamed(sheets, reference.sheet);

  const subOf = (reference: Reference): string => {
    if (reference.kind === "broken") return "gone";
    const target = targetOf(reference);
    return target === undefined ? `no sheet called ${reference.sheet ?? "that"}` : target.title;
  };

  const goExternal = (reference: Reference) => {
    const target = targetOf(reference);
    if (target === undefined) return;
    view.open({ category: "spreadsheet-editor", resourceId: target._id, focus: reference.address?.split(":")[0] });
  };

  const navigate = (key: string) => {
    if (isInspectorView(key)) view.inspect(key);
  };
</script>

<Panel title={label}>
  {#snippet crumbs()}
    <PanelCrumbs trail={[{ label: "Spreadsheet", key: "spreadsheet-editor.spreadsheet" }, { label }]} onnavigate={navigate} />
  {/snippet}

  {#if sheet && ref && held && error}
    <CellHead />

    <div class="head">
      <div class="problem">
        <PanelChip tone="danger">{error}</PanelChip>
        <span class="text-caption text-ink-secondary">{ERROR_NAMES[error as ErrorToken] ?? "Error"} · {explanation}</span>
      </div>
    </div>

    <PanelSection title="Precedents" count={precedents.length + unresolved.length} open={false}>
      {#each precedents as dependency (`${dependency.ref.rowId}/${dependency.ref.columnId}`)}
        <PanelRow
          title={`${labelOf(grid, dependency.ref)} · ${shown(dependency.cell, dependency.ref)}`}
          sub={dependency.cell?.expression ?? "value"}
          onselect={() => go(dependency)}
        />
      {/each}
      {#each unresolved as reference (reference.text)}
        <PanelRow
          title={reference.text}
          sub={subOf(reference)}
          tone={reference.kind === "broken" ? "danger" : targetOf(reference) === undefined ? "attention" : undefined}
          onselect={targetOf(reference) === undefined ? undefined : () => goExternal(reference)}
        />
      {/each}
    </PanelSection>

    <CellComments />
  {:else}
    <PanelEmpty title="Select a broken cell on the grid" />
  {/if}
</Panel>

<style>
  .head {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1.5);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 2);
  }

  .problem {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
  }

</style>
