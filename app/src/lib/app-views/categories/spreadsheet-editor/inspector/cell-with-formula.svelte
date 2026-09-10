<script lang="ts">
  import {
    Panel,
    PanelButton,
    PanelControlGroup,
    PanelCrumbs,
    PanelEmpty,
    PanelRow,
    PanelSection,
    PanelSelect
  } from "$authored-components/panel";
  import CellComments from "$app-views/categories/spreadsheet-editor/components/cell-comments.svelte";
  import CellHead from "$app-views/categories/spreadsheet-editor/components/cell-head.svelte";
  import FormatBand from "$app-views/categories/spreadsheet-editor/components/format-band.svelte";
  import NumberFormat from "$app-views/categories/spreadsheet-editor/components/number-format.svelte";
  import { gridOf, labelOf, rectLabelOf, type CellRef } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { cellAt, type Edit } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import { factsOf, recalculating } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
  import { paintOf } from "$app-views/categories/spreadsheet-editor/procedures/formatting";
  import {
    dependentsOf,
    precedentsOf,
    referencesIn,
    sheetNamed,
    type Dependency,
    type Reference
  } from "$app-views/categories/spreadsheet-editor/procedures/references";
  import { selectedRef } from "$app-views/categories/spreadsheet-editor/procedures/selection-reading";
  import { cellSignal } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import { mergeOf, unmerged } from "$app-views/categories/spreadsheet-editor/procedures/merge-spans";
  import { spillOf } from "$app-views/categories/spreadsheet-editor/procedures/spill-spans";
  import { rowsOf, tableQuery } from "$app-views/categories/spreadsheet-editor/procedures/store";
  import { KIND_LABEL, displayOf, kindOf, type SheetCell } from "$app-views/categories/spreadsheet-editor/procedures/values";
  import { holdsTheRuntime } from "$app-views/categories/spreadsheet-editor/procedures/effects/holds-the-runtime.svelte";
  import { variableRegister } from "$app-views/categories/spreadsheet-editor/procedures/variables.svelte";
  import { isInspectorView, workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const register = variableRegister();

  const sheetId = view.active.resourceId;

  const attached = holdsTheRuntime();
  const runtime = $derived(attached.current);

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const ref = $derived(selectedRef(view.selection));
  const held = $derived(sheet === undefined || ref === undefined ? undefined : cellAt(sheet, ref));
  const label = $derived(ref === undefined ? "?" : labelOf(grid, ref));
  const paint = $derived(sheet === undefined || ref === undefined ? undefined : paintOf(sheet.body, grid, ref, held));
  const kind = $derived(kindOf(held?.value));
  const typeOptions = $derived([{ value: kind, label: `${KIND_LABEL[kind].replace(/^\w/, (letter) => letter.toUpperCase())} · formula` }]);
  const facts = $derived(factsOf(sheetId, sheet));
  const precedents = $derived(sheet === undefined || ref === undefined ? [] : precedentsOf(sheet, facts, ref));
  const dependents = $derived(sheet === undefined || ref === undefined ? [] : dependentsOf(sheet, facts, ref));
  const unresolved = $derived(
    referencesIn(facts, held).filter((reference) => reference.rect === undefined && reference.kind !== "external")
  );
  const merge = $derived(sheet === undefined || ref === undefined ? undefined : mergeOf(sheet, grid, ref));
  const spill = $derived(sheet === undefined || ref === undefined ? undefined : spillOf(sheet, grid, ref));

  const sheetRows = tableQuery("spreadsheets");
  const sheets = $derived(rowsOf(sheetRows, "spreadsheets"));

  const apply = (edit: Edit) => {
    if (edit.refused === undefined && edit.ops.length > 0 && sheet !== undefined) runtime?.apply(recalculating(register, sheetId, sheet, edit.ops));
  };

  const unmerge = () => {
    if (sheet === undefined || ref === undefined) return;
    apply(unmerged(sheet, ref));
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

  {#if sheet && ref && paint && held}
    <CellHead />

    <div class="head">
      {#if spill}
        <div class="span text-caption text-ink-secondary">
          <span>Spills into <span class="font-mono">{rectLabelOf(grid, spill.rect)}</span></span>
        </div>
      {/if}
      {#if merge}
        <div class="span text-caption text-ink-secondary">
          <span>Merged <span class="font-mono">{rectLabelOf(grid, merge.rect)}</span></span>
          <PanelButton label="Unmerge" tone="ghost" onclick={unmerge} />
        </div>
      {/if}
    </div>

    <PanelControlGroup>
      <PanelSelect label="Type" value={kind} options={typeOptions} disabled />
    </PanelControlGroup>

    <FormatBand />
    <NumberFormat />

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

    <PanelSection title="Dependents" count={dependents.length} open={false}>
      {#each dependents as dependency (`${dependency.ref.rowId}/${dependency.ref.columnId}`)}
        <PanelRow
          title={`${labelOf(grid, dependency.ref)} · ${shown(dependency.cell, dependency.ref)}`}
          sub={dependency.cell?.expression ?? "value"}
          onselect={() => go(dependency)}
        />
      {/each}
    </PanelSection>

    <CellComments />
  {:else}
    <PanelEmpty title="Select a formula cell on the grid" />
  {/if}
</Panel>

<style>
  .head {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1.5);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 2);
  }

  .span {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 2);
  }
</style>
