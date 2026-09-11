<script lang="ts">
  import AlignCenter from "@lucide/svelte/icons/align-center";
  import AlignJustify from "@lucide/svelte/icons/align-justify";
  import AlignLeft from "@lucide/svelte/icons/align-left";
  import AlignRight from "@lucide/svelte/icons/align-right";
  import Minus from "@lucide/svelte/icons/minus";
  import Plus from "@lucide/svelte/icons/plus";

  import { Panel, PanelButton, PanelChoice, PanelColor, PanelCrumbs, PanelEmpty, PanelNumber, PanelSection, PanelSelect } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import TextStyle from "$app-views/categories/presentation-editor/components/text-style.svelte";
  import type { TextBlock } from "$app-views/categories/presentation-editor/procedures/presentation-types";
  import { slideHolding } from "$app-views/categories/presentation-editor/procedures/presentation-slide-holding";
  import { elementIn } from "$app-views/categories/presentation-editor/procedures/presentation-reading";
  import { slideIndexOf } from "$app-views/categories/presentation-editor/procedures/presentation-slides";
  import { withSet, withSets } from "$app-views/categories/presentation-editor/procedures/presentation-values";
  import { cellsSignal, elementsSignal, selectedCells, selectedIds, slideSignal } from "$app-views/categories/presentation-editor/procedures/selecting";
  import {
    columnsOf,
    gridOf,
    isRectangular,
    withColumnInserted,
    withColumnRemoved,
    withMergedCells,
    withRowInserted,
    withRowRemoved,
    withSplitCell,
    type GridCell
  } from "$app-views/categories/presentation-editor/procedures/tables";
  import { workspaceState, type PresentationRuntime } from "$model/client/workspace-state";

  const ALIGN = [
    { value: "start", label: "Align left", icon: AlignLeft },
    { value: "center", label: "Center", icon: AlignCenter },
    { value: "end", label: "Align right", icon: AlignRight },
    { value: "justify", label: "Justify", icon: AlignJustify }
  ];

  const DASHES = [
    { value: "solid", label: "Solid" },
    { value: "dashed", label: "Dashed" },
    { value: "dotted", label: "Dotted" }
  ];

  const view = workspaceState();
  const presentationId = view.active.resourceId;
  let runtime = $state<PresentationRuntime | undefined>(undefined);

  $effect(() => {
    runtime = presentationId === undefined ? undefined : view.presentationRuntime(presentationId);
  });

  const body = $derived(runtime?.body);
  const tableId = $derived(selectedIds(view.selection)[0]);
  const element = $derived(body === undefined || tableId === undefined ? undefined : elementIn(body, tableId));
  const slide = $derived(body === undefined || tableId === undefined ? undefined : slideHolding(body, tableId));
  const position = $derived(body === undefined || slide === undefined ? 0 : slideIndexOf(body, slide.id) + 1);
  const table = $derived(element?.content.type === "table" ? element.content.block : undefined);
  const rowHeights = $derived(element?.content.type === "table" ? element.content.rowHeights : undefined);
  const grid = $derived(table === undefined ? [] : gridOf(table));
  const columns = $derived(columnsOf(grid));
  const picked = $derived(selectedCells(view.selection));
  const chosen = $derived(picked.flatMap((held) => grid.filter((candidate) => candidate.cell.id === held)));
  const first = $derived(chosen[0]);
  const single = $derived(chosen.length === 1);
  const block = $derived(single ? first.cell.blocks.find((held): held is TextBlock => held.type === "text") : undefined);

  const textOfCell = (cell: GridCell) => cell.cell.blocks.find((held): held is TextBlock => held.type === "text");

  const same = <T,>(values: readonly T[]): T | undefined =>
    values.length > 0 && values.every((value) => value === values[0]) ? values[0] : undefined;

  const sharedFill = $derived(same(chosen.map((held) => held.cell.format?.background ?? "")));
  const sharedAlign = $derived(same(chosen.map((held) => textOfCell(held)?.format?.horizontalAlignment ?? "start")));
  const sharedBorderColor = $derived(same(chosen.map((held) => held.cell.format?.border?.color ?? "")));
  const sharedBorderWidth = $derived(same(chosen.map((held) => held.cell.format?.border?.width ?? 0)));
  const sharedBorderStyle = $derived(same(chosen.map((held) => held.cell.format?.border?.style ?? "solid")));
  const canMerge = $derived(chosen.length > 1 && isRectangular(grid, picked));
  const canSplit = $derived(single && (first.rowSpan > 1 || first.columnSpan > 1));

  const widths = $derived(table === undefined ? [] : (table.columnWidths?.length === columns ? table.columnWidths : Array.from({ length: columns }, () => 1 / Math.max(1, columns))));
  const heights = $derived(table === undefined ? [] : (rowHeights?.length === table.rows.length ? rowHeights : Array.from({ length: table.rows.length }, () => 1 / Math.max(1, table.rows.length))));
  const share = (sizes: readonly number[], at: number) => {
    const total = sizes.reduce((sum, held) => sum + held, 0);
    return total === 0 ? 0 : Math.round(((sizes[at] ?? 0) / total) * 1000) / 10;
  };

  const apply = (ops: Parameters<PresentationRuntime["apply"]>[0]) => {
    if (ops.length > 0) runtime?.apply(ops);
  };

  const each = (make: (held: GridCell) => { path: string; value: unknown }[]) => {
    if (body === undefined) return;
    apply(withSets(
      body,
      chosen.flatMap(make).map((set) => ({ target: "block", ...set }))
    ).ops);
  };

  const setFill = (value: string) => each((held) => [{ path: `${held.cell.id}/format/background`, value: value === "" ? null : value }]);

  const setAlign = (value: string) =>
    each((held) => {
      const text = textOfCell(held);
      return text === undefined ? [] : [{ path: `${text.id}/format/horizontalAlignment`, value }];
    });

  const setBorderColor = (value: string) =>
    each((held) =>
      value === ""
        ? [{ path: `${held.cell.id}/format/border`, value: null }]
        : [
            { path: `${held.cell.id}/format/border/color`, value },
            { path: `${held.cell.id}/format/border/width`, value: held.cell.format?.border?.width ?? 1 },
            { path: `${held.cell.id}/format/border/style`, value: held.cell.format?.border?.style ?? "solid" }
          ]
    );

  const setBorderWidth = (width: number) =>
    each((held) =>
      width === 0
        ? [{ path: `${held.cell.id}/format/border`, value: null }]
        : [
            { path: `${held.cell.id}/format/border/color`, value: held.cell.format?.border?.color ?? (body?.theme.colors.text ?? "") },
            { path: `${held.cell.id}/format/border/width`, value: width },
            { path: `${held.cell.id}/format/border/style`, value: held.cell.format?.border?.style ?? "solid" }
          ]
    );

  const setBorderStyle = (style: string) =>
    each((held) => (held.cell.format?.border === undefined ? [] : [{ path: `${held.cell.id}/format/border/style`, value: style }]));

  const setWidth = (percent: number) => {
    if (body === undefined || table === undefined || first === undefined) return;
    const total = widths.reduce((sum, held) => sum + held, 0) || 1;
    const next = widths.map((held, index) => (index === first.column ? (percent / 100) * total : held));
    apply(withSet(body, "block", `${table.id}/columnWidths`, next).ops);
  };

  const setHeight = (percent: number) => {
    if (body === undefined || element === undefined || first === undefined) return;
    const total = heights.reduce((sum, held) => sum + held, 0) || 1;
    const next = heights.map((held, index) => (index === first.row ? (percent / 100) * total : held));
    apply(withSet(body, "element", `${element.id}/content/rowHeights`, next).ops);
  };

  const merge = () => {
    if (body === undefined || table === undefined || element === undefined) return;
    const edit = withMergedCells(body, table, picked);
    if (edit.ops.length === 0) return;
    runtime?.apply(edit.ops);
    const signal = cellsSignal(element.id, [picked[0]]);
    view.inspect(signal.key, signal.selection);
  };

  const split = () => {
    if (body === undefined || table === undefined || element === undefined || first === undefined) return;
    const edit = withSplitCell(body, table, first.cell.id);
    if (edit.ops.length === 0) return;
    runtime?.apply(edit.ops);
    const signal = cellsSignal(element.id, [first.cell.id]);
    view.inspect(signal.key, signal.selection);
  };

  const backToTable = () => {
    if (element === undefined) return;
    const signal = elementsSignal([element]);
    if (signal) view.inspect(signal.key, signal.selection);
  };

  const restructure = (edit: { ops: readonly Parameters<PresentationRuntime["apply"]>[0][number][] }, keep: boolean) => {
    if (edit.ops.length === 0) return;
    runtime?.apply(edit.ops);
    if (!keep) backToTable();
  };
</script>

<Panel title={single ? "Cell" : `${chosen.length} cells`}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: `Slide ${position}`, key: "presentation-editor.slide" }, { label: "Table", key: "presentation-editor.table" }, { label: single ? "Cell" : "Cells" }]}
      onnavigate={(key) => {
        if (key === "presentation-editor.slide" && slide) view.inspect("presentation-editor.slide", slideSignal(slide.id).selection);
        if (key === "presentation-editor.table") backToTable();
      }}
    />
  {/snippet}
  {#snippet actions()}
    {#if chosen.length > 0}
      <PanelButton label="Merge" disabled={!canMerge} title={canMerge ? "Merge into one cell, keeping the first one picked" : "Pick a rectangle of cells to merge"} onclick={merge} />
      <PanelButton label="Split" disabled={!canSplit} title={canSplit ? "Split back into single cells" : "Pick one merged cell to split"} onclick={split} />
    {/if}
  {/snippet}

  {#if body && element && table && first !== undefined}
    {#if block}
      <TextStyle blockId={block.id} whole />
    {:else}
      <PanelSection title="Text">
        <PanelChoice label="Alignment" value={sharedAlign ?? "start"} mixed={sharedAlign === undefined} options={ALIGN} flush fill onchange={setAlign} />
        <div class="grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-x-2 gap-y-2">
          <span class="text-caption text-ink-muted">Background</span>
          <PanelColor picker clearable label="Cell background" value={sharedFill ?? ""} mixed={sharedFill === undefined} flush onchange={setFill} />
        </div>
      </PanelSection>
    {/if}

    <PanelSection title="Border">
      <div class="grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-x-2 gap-y-2">
        <span class="text-caption text-ink-muted">Border</span>
        <div class="flex min-w-0 items-center gap-1.5">
          <PanelColor picker clearable label="Cell border colour" value={sharedBorderColor ?? ""} mixed={sharedBorderColor === undefined} flush onchange={setBorderColor} />
          <div class="w-16 shrink-0"><PanelNumber label="Cell border width" value={sharedBorderWidth ?? 0} unit="px" min={0} max={20} step={1} flush onchange={setBorderWidth} /></div>
        </div>
        <span class="text-caption text-ink-muted">Dash</span>
        <PanelSelect label="Cell border dash" value={sharedBorderStyle ?? "solid"} mixed={sharedBorderStyle === undefined} options={DASHES} disabled={(sharedBorderWidth ?? 0) === 0} onchange={setBorderStyle} />
      </div>
    </PanelSection>

    <PanelSection title="Size">
      <div class="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-1.5 gap-y-1.5">
        <span class="text-caption text-ink-muted">W</span>
        <PanelNumber label="Column width" value={share(widths, first.column)} unit="%" min={1} max={100} step={1} flush onchange={setWidth} />
        <span class="text-caption text-ink-muted ps-1">H</span>
        <PanelNumber label="Row height" value={share(heights, first.row)} unit="%" min={1} max={100} step={1} flush onchange={setHeight} />
      </div>
    </PanelSection>

    <PanelSection title="Rows and columns">
      <div class="grid grid-cols-[3.5rem_1fr_1fr] items-center gap-1.5">
        <span class="text-caption text-ink-muted">Row</span>
        <Button variant="outline" size="xs" class="w-full" title="Add a row below this one" onclick={() => restructure(withRowInserted(body, element, first.row + first.rowSpan - 1), true)}><Plus aria-hidden="true" />Insert</Button>
        <Button variant="outline" size="xs" class="w-full" disabled={table.rows.length < 2} title="Remove this row" onclick={() => restructure(withRowRemoved(body, element, first.row), false)}><Minus aria-hidden="true" />Delete</Button>
        <span class="text-caption text-ink-muted">Column</span>
        <Button variant="outline" size="xs" class="w-full" title="Add a column to the right of this one" onclick={() => restructure(withColumnInserted(body, element, first.column + first.columnSpan - 1), true)}><Plus aria-hidden="true" />Insert</Button>
        <Button variant="outline" size="xs" class="w-full" disabled={columns < 2} title="Remove this column" onclick={() => restructure(withColumnRemoved(body, element, first.column), false)}><Minus aria-hidden="true" />Delete</Button>
      </div>
    </PanelSection>
  {:else}
    <PanelEmpty title="Pick a cell of a table on the slide" />
  {/if}
</Panel>
