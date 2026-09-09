<script lang="ts">
  import {
    Panel,
    PanelButton,
    PanelControlGroup,
    PanelCrumbs,
    PanelEmpty,
    PanelRow,
    PanelSection
  } from "$authored-components/panel";
  import CellComments from "$app-views/categories/spreadsheet-editor/components/cell-comments.svelte";
  import CellHead from "$app-views/categories/spreadsheet-editor/components/cell-head.svelte";
  import FormatBand from "$app-views/categories/spreadsheet-editor/components/format-band.svelte";
  import NumberFormat from "$app-views/categories/spreadsheet-editor/components/number-format.svelte";
  import { gridOf, labelOf, rectLabelOf, type CellRef } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { cellAt, type Edit } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import { factsOf, recalculating } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
  import { paintOf } from "$app-views/categories/spreadsheet-editor/procedures/formatting";
  import { dependentsOf, type Dependency } from "$app-views/categories/spreadsheet-editor/procedures/references";
  import { runsOf } from "$app-views/categories/spreadsheet-editor/procedures/scene";
  import { cellSignal, selectedRef, textSignal } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import { mergeOf, spillOf, unmerged } from "$app-views/categories/spreadsheet-editor/procedures/spans";
  import { displayOf, kindOf, type SheetCell } from "$app-views/categories/spreadsheet-editor/procedures/values";
  import { isInspectorView, workspaceState, type SpreadsheetRuntime } from "$model/client/workspace-state";

  const view = workspaceState();

  const sheetId = $derived(view.active.resourceId);

  let runtime = $state<SpreadsheetRuntime | undefined>(undefined);

  $effect(() => {
    runtime = sheetId === undefined ? undefined : view.spreadsheetRuntime(sheetId);
  });

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const ref = $derived(selectedRef(view.selection));
  const held = $derived(sheet === undefined || ref === undefined ? undefined : cellAt(sheet, ref));
  const label = $derived(ref === undefined ? "?" : labelOf(grid, ref));
  const paint = $derived(sheet === undefined || ref === undefined ? undefined : paintOf(sheet.body, grid, ref, held));
  const shows = $derived(displayOf(held?.value, paint?.format.valueFormat));
  const kind = $derived(kindOf(held?.value));
  const merge = $derived(sheet === undefined || ref === undefined ? undefined : mergeOf(sheet, grid, ref));
  const spill = $derived(sheet === undefined || ref === undefined ? undefined : spillOf(sheet, grid, ref));
  const facts = $derived(factsOf(sheetId, sheet));
  const dependents = $derived(sheet === undefined || ref === undefined ? [] : dependentsOf(sheet, facts, ref));
  const runs = $derived(
    held !== undefined && kind === "text" && held.expression === undefined && shows !== "" ? runsOf(shows, held.marks ?? []) : []
  );

  let quote = $state<HTMLParagraphElement | null>(null);
  let refusal = $state<string | undefined>(undefined);
  let refusalTimer: ReturnType<typeof setTimeout> | undefined;

  const apply = (edit: Edit) => {
    if (edit.refused !== undefined) {
      refusal = edit.refused;
      if (refusalTimer !== undefined) clearTimeout(refusalTimer);
      refusalTimer = setTimeout(() => (refusal = undefined), 5000);
      return;
    }
    if (edit.ops.length > 0 && sheet !== undefined) runtime?.apply(recalculating(view.project, sheetId, sheet, edit.ops));
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

  const navigate = (key: string) => {
    if (isInspectorView(key)) view.inspect(key);
  };

  const offsetIn = (element: HTMLElement, node: Node, offset: number): number => {
    if (node === element) {
      let total = 0;
      for (let index = 0; index < offset; index += 1) total += element.childNodes[index]?.textContent?.length ?? 0;
      return total;
    }
    let total = 0;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current !== null) {
      if (current === node) return total + offset;
      total += current.textContent?.length ?? 0;
      current = walker.nextNode();
    }
    return total;
  };

  const pickText = () => {
    const element = quote;
    const chosen = window.getSelection();
    if (element === null || ref === undefined || chosen === null || chosen.rangeCount === 0) return;
    if (!element.isConnected) return;
    const range = chosen.getRangeAt(0);
    if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return;
    const from = offsetIn(element, range.startContainer, range.startOffset);
    const to = offsetIn(element, range.endContainer, range.endOffset);
    if (from === to) return;
    const signal = textSignal(ref, Math.min(from, to), Math.max(from, to));
    view.inspect(signal.key, signal.selection);
  };

  $effect(() => {
    const element = quote;
    if (element === null) return;
    element.addEventListener("mouseup", pickText);
    return () => element.removeEventListener("mouseup", pickText);
  });
</script>

<Panel title={label}>
  {#snippet crumbs()}
    <PanelCrumbs trail={[{ label: "Spreadsheet", key: "spreadsheet-editor.spreadsheet" }, { label }]} onnavigate={navigate} />
  {/snippet}

  {#if sheet && ref && paint}
    <CellHead />

    <div class="head">
      {#if merge}
        <div class="span text-caption text-ink-secondary">
          <span>Merged <span class="font-mono">{rectLabelOf(grid, merge.rect)}</span></span>
          <PanelButton label="Unmerge" tone="ghost" onclick={unmerge} />
        </div>
      {/if}
      {#if spill}
        <div class="span text-caption text-ink-secondary">
          <span>Spills into <span class="font-mono">{rectLabelOf(grid, spill.rect)}</span></span>
        </div>
      {/if}
      {#if runs.length > 0}
        <p bind:this={quote} class="text text-body-sm text-ink-secondary">
          {#each runs as run, index (index)}
            <span
              class:bold={run.bold}
              class:italic={run.italic}
              class:underline={run.underline}
              class:strike={run.strike}
              class:code={run.code}
              style:color={run.color === undefined ? undefined : `var(${run.color})`}>{run.text}</span
            >
          {/each}
        </p>
      {/if}
    </div>

    {#if refusal}
      <PanelControlGroup>
        <span class="text-caption text-danger-text">{refusal}</span>
      </PanelControlGroup>
    {/if}

    <FormatBand />
    {#if held === undefined || kind === "number"}
      <NumberFormat />
    {/if}

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
    <PanelEmpty title="Select a cell on the grid" />
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

  .text {
    margin: 0;
    cursor: text;
    user-select: text;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .bold {
    font-weight: 600;
  }

  .italic {
    font-style: italic;
  }

  .underline {
    text-decoration: underline;
  }

  .strike {
    text-decoration: line-through;
  }

  .underline.strike {
    text-decoration: underline line-through;
  }

  .code {
    font-family: var(--token-font-mono);
  }
</style>
