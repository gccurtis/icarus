<script lang="ts">
  import { Panel, PanelCode, PanelCrumbs, PanelEmpty, PanelLink, PanelSection } from "$authored-components/panel";
  import CellComments from "$app-views/categories/spreadsheet-editor/components/cell-comments.svelte";
  import { gridOf, indexOf, labelOf, rectLabelOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { cellAt } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import { paintOf } from "$app-views/categories/spreadsheet-editor/procedures/formatting";
  import { selectedRef } from "$app-views/categories/spreadsheet-editor/procedures/selection-reading";
  import { cellSignal } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import { spillChildOf } from "$app-views/categories/spreadsheet-editor/procedures/spill-spans";
  import { displayOf } from "$app-views/categories/spreadsheet-editor/procedures/values";
  import { holdsTheRuntime } from "$app-views/categories/spreadsheet-editor/procedures/effects/holds-the-runtime.svelte";
  import { isInspectorView, workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();

  const sheetId = view.active.resourceId;

  const attached = holdsTheRuntime();
  const runtime = $derived(attached.current);

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const ref = $derived(selectedRef(view.selection));
  const held = $derived(sheet === undefined || ref === undefined ? undefined : cellAt(sheet, ref));
  const label = $derived(ref === undefined ? "?" : labelOf(grid, ref));
  const span = $derived(sheet === undefined || ref === undefined ? undefined : spillChildOf(sheet, grid, ref));
  const origin = $derived(sheet === undefined || span === undefined ? undefined : cellAt(sheet, span.anchor));
  const shows = $derived(
    sheet === undefined || ref === undefined ? "" : displayOf(held?.value, paintOf(sheet.body, grid, ref, held).format.valueFormat)
  );
  const position = $derived.by(() => {
    if (span === undefined || ref === undefined) return "";
    const at = indexOf(grid, ref);
    return at === undefined ? "" : `${at.row - span.rect.row + 1} of ${span.rect.rows}`;
  });

  const openOrigin = () => {
    if (sheet === undefined || span === undefined || runtime === undefined) return;
    runtime.scrollTo = span.anchor;
    const signal = cellSignal(sheet, grid, span.anchor);
    view.inspect(signal.key, signal.selection);
  };

  const navigate = (key: string) => {
    if (isInspectorView(key)) view.inspect(key);
  };
</script>

<Panel title={label}>
  {#snippet crumbs()}
    <PanelCrumbs trail={[{ label: "Spreadsheet", key: "spreadsheet-editor.spreadsheet" }, { label }]} onnavigate={navigate} />
  {/snippet}

  {#if sheet && ref && span}
    <div class="head">
      <div class="shows text-body text-ink-primary tabular-nums">{shows === "" ? "Empty" : shows}</div>
      <div class="span text-caption text-ink-secondary">
        <span>
          Spilled from <PanelLink label={labelOf(grid, span.anchor)} onselect={openOrigin} /> ·
          <span class="font-mono">{rectLabelOf(grid, span.rect)}</span> · {position}
        </span>
      </div>
    </div>

    {#if origin?.expression !== undefined}
      <PanelSection title="Origin">
        <PanelCode>{origin.expression}</PanelCode>
      </PanelSection>
    {/if}

    <CellComments />
  {:else}
    <PanelEmpty title="Select a spilled cell on the grid" />
  {/if}
</Panel>

<style>
  .head {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1.5);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 2);
  }

  .shows {
    font-weight: 500;
  }

  .span {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1);
  }
</style>
