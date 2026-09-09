<script lang="ts">
  import {
    Panel,
    PanelButton,
    PanelCrumbs,
    PanelEmpty,
    PanelField,
    PanelFields,
    PanelSection,
    PanelStat,
    PanelStats
  } from "$authored-components/panel";
  import FormatBand from "$app-views/categories/spreadsheet-editor/components/format-band.svelte";
  import NumberFormat from "$app-views/categories/spreadsheet-editor/components/number-format.svelte";
  import { gridOf, rectLabelOf, refsIn, type Rect } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { cleared, populatedIn, type Edit } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import { recalculating } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
  import { selectedRects } from "$app-views/categories/spreadsheet-editor/procedures/selection-reading";
  import { merged } from "$app-views/categories/spreadsheet-editor/procedures/spans";
  import { aggregateOf, figure } from "$app-views/categories/spreadsheet-editor/procedures/stats";
  import { rulesOverRects } from "$app-views/categories/spreadsheet-editor/procedures/styles";
  import { holdsTheRuntime } from "$app-views/categories/spreadsheet-editor/procedures/effects/holds-the-runtime.svelte";
  import { variableRegister } from "$app-views/categories/spreadsheet-editor/procedures/variables.svelte";
  import { isInspectorView, workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const register = variableRegister();

  const sheetId = $derived(view.active.resourceId);

  const attached = holdsTheRuntime();
  const runtime = $derived(attached.current);

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const rects = $derived(selectedRects(grid, view.selection));
  const primary = $derived(rects[0]);
  const label = $derived(
    primary === undefined ? "Range" : rects.length === 1 ? rectLabelOf(grid, primary) : `${rectLabelOf(grid, primary)} +${rects.length - 1}`
  );
  const total = $derived(sheet === undefined ? undefined : aggregateOf(sheet, grid, rects));
  const rules = $derived(sheet === undefined ? [] : rulesOverRects(sheet.body, grid, rects));
  const populated = $derived(sheet === undefined ? [] : rects.flatMap((rect) => populatedIn(sheet, grid, rect)));

  const apply = (ops: Edit["ops"]) => {
    if (ops.length === 0 || sheet === undefined) return;
    runtime?.apply(recalculating(register, sheetId, sheet, ops));
  };

  const mergeable = $derived(rects.length === 1 && primary !== undefined && primary.rows * primary.columns > 1);
  const willClear = $derived(primary === undefined || sheet === undefined ? 0 : Math.max(0, populatedIn(sheet, grid, primary).length - 1));

  const merge = () => {
    if (sheet === undefined || primary === undefined) return;
    if (willClear > 0 && !window.confirm(`${willClear} ${willClear === 1 ? "cell" : "cells"} will be cleared; ${rectLabelOf(grid, { ...primary, rows: 1, columns: 1 })} keeps its value.`)) return;
    const edit = merged(sheet, grid, primary);
    if (edit.refused === undefined) apply(edit.ops);
  };

  const clear = () => {
    if (sheet === undefined || populated.length === 0) return;
    if (!window.confirm(`Clear ${populated.length} ${populated.length === 1 ? "cell" : "cells"}?`)) return;
    apply(cleared(sheet, grid, rects.flatMap((rect: Rect) => refsIn(grid, rect))).ops);
  };

  const navigate = (key: string) => {
    if (isInspectorView(key)) view.inspect(key);
  };
</script>

<Panel title={label}>
  {#snippet crumbs()}
    <PanelCrumbs trail={[{ label: "Spreadsheet", key: "spreadsheet-editor.spreadsheet" }, { label }]} onnavigate={navigate} />
  {/snippet}

  {#if sheet && primary && total}
    <PanelStats label="Selection">
      <PanelStat value={String(total.cells)} label={total.cells === 1 ? "cell" : "cells"} />
      <PanelStat value={String(total.filled)} label="with content" />
      <PanelStat value={String(rules.length)} label={rules.length === 1 ? "rule" : "rules"} />
    </PanelStats>

    <div class="actions">
      <PanelButton
        label="Merge"
        disabled={!mergeable}
        title={rects.length > 1 ? "Merge needs one rectangle" : mergeable ? undefined : "Merge needs more than one cell"}
        onclick={merge}
      />
      <PanelButton label="Clear" tone="danger" disabled={populated.length === 0} onclick={clear} />
    </div>

    <FormatBand />
    <NumberFormat />

    {#if total.numbers > 0}
      <PanelSection title="Statistics" open={false}>
        <PanelFields>
          <PanelField label="Values">{total.numbers}</PanelField>
          <PanelField label="Sum">{figure(total.sum)}</PanelField>
          <PanelField label="Average">{total.average === undefined ? "" : figure(total.average)}</PanelField>
          <PanelField label="Std dev">{total.deviation === undefined ? "" : figure(total.deviation)}</PanelField>
          <PanelField label="Min">{total.min === undefined ? "" : figure(total.min)}</PanelField>
          <PanelField label="Max">{total.max === undefined ? "" : figure(total.max)}</PanelField>
        </PanelFields>
      </PanelSection>
    {/if}
  {:else}
    <PanelEmpty title="Select a range on the grid" />
  {/if}
</Panel>

<style>
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--token-spacing-unit) * 1.5);
    padding: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 2);
  }
</style>
