<script lang="ts">
  import { untrack } from "svelte";

  import Minus from "@lucide/svelte/icons/minus";
  import Plus from "@lucide/svelte/icons/plus";
  import Redo2 from "@lucide/svelte/icons/redo-2";
  import Undo2 from "@lucide/svelte/icons/undo-2";

  import { read } from "$capabilities/store/index.remote";
  import {
    SheetSurface,
    type SurfaceApi,
    type SurfaceEdit,
    type SurfaceFill,
    type SurfaceHighlight,
    type SurfaceHit,
    type SurfacePaste,
    type SurfaceSelection
  } from "$authored-components/sheet-surface";
  import { Button } from "$vendored-components/button";
  import * as ContextMenu from "$vendored-components/context-menu";
  import {
    columnLabel,
    gridOf,
    indexOf,
    keyOf,
    labelOf,
    parseRef,
    rectLabelOf,
    refAt,
    refsIn,
    sameRect,
    type Rect
  } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { cleared, typed, type Edit } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import { pasted } from "$app-views/categories/spreadsheet-editor/procedures/clipboard";
  import { anchorOf, pinsOf, threadsOf } from "$app-views/categories/spreadsheet-editor/procedures/comments";
  import { filled } from "$app-views/categories/spreadsheet-editor/procedures/fill";
  import { armed, beginWriting, drafted, pick } from "$app-views/categories/spreadsheet-editor/procedures/picking.svelte";
  import {
    AROUND,
    factsOf,
    recalculated,
    recalculating,
    sourceFor,
    storedOf,
    type SheetCell
  } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
  import {
    loadVariables,
    variablesLoaded,
    variablesRevision
  } from "$app-views/categories/spreadsheet-editor/procedures/variables.svelte";
  import { dependentsOf, referencesIn } from "$app-views/categories/spreadsheet-editor/procedures/references";
  import { sceneOf } from "$app-views/categories/spreadsheet-editor/procedures/scene";
  import {
    cellSignal,
    columnSignal,
    highlightedRefs,
    rangeSignal,
    rowSignal,
    sameSelection,
    selectedColumnIds,
    selectedRects,
    selectedRef,
    selectedRowIds,
    surfaceSelectionOf,
    type Signal
  } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import { merged, mergeOf, mergeSpans, spillChildOf, spillOf, unmerged } from "$app-views/categories/spreadsheet-editor/procedures/spans";
  import { usedRect } from "$app-views/categories/spreadsheet-editor/procedures/stats";
  import { rowsOf, tableQuery } from "$app-views/categories/spreadsheet-editor/procedures/store";
  import {
    APPEND_COLUMNS,
    APPEND_ROWS,
    frozenColumnsSet,
    insertedColumns,
    insertedRows,
    movedColumn,
    movedRow,
    removedColumns,
    removedRows,
    resizedColumn,
    resizedRow
  } from "$app-views/categories/spreadsheet-editor/procedures/structure";
  import { workspaceState, type SpreadsheetRuntime, type SyncState } from "$model/client/workspace-state";

  const SYNC_LABEL: Record<SyncState, string> = {
    loading: "Loading",
    saved: "Saved",
    saving: "Saving",
    rebasing: "Rebasing",
    "needs-review": "Needs review",
    offline: "Offline",
    error: "Not saved"
  };

  const WHEEL_NOTCH = 120;
  const PERCENT_PER_NOTCH = 2;
  const ZOOM_STEP = 10;
  const ZOOM_MIN = 50;
  const ZOOM_MAX = 200;

  const view = workspaceState();

  const sheetId = $derived(view.active.resourceId);

  const title = $derived.by(() => {
    if (sheetId === undefined) return undefined;
    const answer = read({ path: `spreadsheets.${sheetId}.title` });
    if (!answer.ready) return undefined;
    const found = answer.current;
    return found?.kind === "field" && typeof found.value === "string" ? found.value : undefined;
  });

  let runtime = $state<SpreadsheetRuntime | undefined>(undefined);

  $effect(() => {
    runtime = sheetId === undefined ? undefined : view.spreadsheetRuntime(sheetId);
  });

  $effect(() => {
    if (!variablesLoaded()) void loadVariables();
  });

  $effect(() => {
    void variablesRevision();
    untrack(() => {
      const open = sheet;
      if (open === undefined || sheetId === undefined) return;
      const ops = recalculated(sourceFor(sheetId, open), AROUND);
      if (ops.length > 0) runtime?.apply(ops);
    });
  });

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const facts = $derived(factsOf(sheetId, sheet, title ?? ""));

  const threadRows = tableQuery("commentThreads");
  const allThreads = $derived(rowsOf(threadRows, "commentThreads"));
  const threads = $derived(sheetId === undefined ? [] : threadsOf(allThreads, sheetId));
  const currentThread = $derived(view.inspected === "general.comment" ? view.selection?.id : undefined);
  const pins = $derived(
    sheet === undefined
      ? new Map()
      : pinsOf(threads, sheet, grid, currentThread, view.selection?.kind === "cell" ? view.selection.id : undefined)
  );

  const scene = $derived(sheet === undefined ? undefined : sceneOf(sheet, grid, pins, facts));
  const selection = $derived.by((): SurfaceSelection | undefined => {
    const held = view.selection;
    if (held?.kind !== "comment") return surfaceSelectionOf(grid, held);
    const thread = allThreads.find((candidate) => candidate._id === held.id);
    const anchor = thread === undefined ? undefined : anchorOf(thread);
    return anchor === undefined ? undefined : surfaceSelectionOf(grid, { kind: "cell", id: keyOf(anchor) });
  });
  const zoom = $derived(view.zoom ?? 100);

  const highlights = $derived.by((): SurfaceHighlight[] => {
    if (sheet === undefined) return [];
    const found: SurfaceHighlight[] = [];
    for (const hit of highlightedRefs(view.selection)) {
      const at = indexOf(grid, hit);
      if (at !== undefined) found.push({ rect: { row: at.row, column: at.column, rows: 1, columns: 1 }, tone: "hit" });
    }
    const ref = selectedRef(view.selection);
    if (ref === undefined) return found;
    const held = sheet.cells[`${ref.rowId}/${ref.columnId}`];

    const writing = drafted();
    const draft = writing === undefined ? undefined : storedOf(facts, writing);
    const reading: SheetCell | undefined =
      draft === undefined
        ? held
        : {
            rowId: ref.rowId,
            columnId: ref.columnId,
            value: { kind: "empty" },
            expression: draft.formula,
            anchors: [...draft.anchors]
          };

    if (reading?.expression !== undefined) {
      for (const reference of referencesIn(facts, reading)) {
        if (reference.rect !== undefined) found.push({ rect: reference.rect, tone: "reads" });
      }
    }
    for (const feed of dependentsOf(sheet, facts, ref)) {
      const at = indexOf(grid, feed.ref);
      if (at !== undefined) found.push({ rect: { row: at.row, column: at.column, rows: 1, columns: 1 }, tone: "feeds" });
    }
    const spill = spillOf(sheet, grid, ref) ?? spillChildOf(sheet, grid, ref);
    if (spill !== undefined) found.push({ rect: spill.rect, tone: "spill" });
    return found;
  });

  let api = $state<SurfaceApi | undefined>(undefined);
  let wrapper = $state<HTMLDivElement>();
  let notice = $state<string | undefined>(undefined);
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  let scrollTarget = $state<{ row: number; column: number; token: number } | undefined>(undefined);
  let scrolls = 0;
  let hit = $state<SurfaceHit | undefined>(undefined);

  const say = (text: string) => {
    notice = text;
    if (noticeTimer !== undefined) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (notice = undefined), 6000);
  };

  const apply = (ops: Edit["ops"]) => {
    if (ops.length === 0 || sheet === undefined) return;
    runtime?.apply(recalculating(sheetId, sheet, ops));
  };

  const perform = (edit: Edit): boolean => {
    if (edit.refused !== undefined) {
      say(edit.refused);
      return false;
    }
    apply(edit.ops);
    if (edit.skipped !== undefined && edit.skipped > 0) {
      say(`${edit.skipped} ${edit.skipped === 1 ? "cell under a spill or a merge was" : "cells under a spill or a merge were"} left alone.`);
    }
    return true;
  };

  const WHOLE = "spreadsheet-editor.spreadsheet";

  const show = (signal: Signal | undefined) => {
    if (signal === undefined) {
      if (view.selection !== undefined || view.inspected !== WHOLE) view.inspect(WHOLE);
      return;
    }
    if (sameSelection(view.selection, signal.selection) && view.inspected === signal.key) return;
    view.inspect(signal.key, signal.selection);
  };

  $effect(() => {
    if (sheet !== undefined && view.inspected === "empty" && view.selection === undefined) view.inspect(WHOLE);
  });

  const everything = (): Signal | undefined => {
    if (sheet === undefined || grid.rows.length === 0 || grid.columns.length === 0) return undefined;
    const rect = usedRect(sheet, grid) ?? { row: 0, column: 0, rows: 1, columns: 1 };
    if (rect.rows === 1 && rect.columns === 1) {
      const ref = refAt(grid, rect.row, rect.column);
      return ref === undefined ? undefined : cellSignal(sheet, grid, ref);
    }
    return rangeSignal(grid, [rect]);
  };

  const wholeGrid = (rect: Rect): boolean =>
    rect.row === 0 && rect.column === 0 && rect.rows >= grid.rows.length && rect.columns >= grid.columns.length;

  const signalOf = (next: SurfaceSelection): Signal | undefined => {
    if (sheet === undefined) return undefined;
    if (next.rows.length > 1 && next.rows.length >= grid.rows.length) return everything();
    if (next.rows.length > 0) return rowSignal(grid, next.rows);
    if (next.columns.length > 0) return columnSignal(grid, next.columns);
    const [only] = next.ranges;
    if (only !== undefined && next.ranges.length === 1) {
      if (wholeGrid(only)) return everything();
      const span = mergeSpans(sheet, grid).find((held) => sameRect(held.rect, only));
      if (span !== undefined) return cellSignal(sheet, grid, span.anchor);
      if (only.rows === 1 && only.columns === 1) {
        const ref = refAt(grid, only.row, only.column);
        return ref === undefined ? undefined : cellSignal(sheet, grid, ref);
      }
    }
    return next.ranges.length > 0 ? rangeSignal(grid, next.ranges, next.cell) : undefined;
  };

  const picked = (next: SurfaceSelection): boolean => {
    if (!armed()) return false;
    const at = next.cell;
    const [rect] = next.ranges;
    if (at === undefined || rect === undefined || next.ranges.length > 1) return false;
    const ref = refAt(grid, at[1], at[0]);
    if (ref === undefined) return false;
    return pick(rect.rows === 1 && rect.columns === 1 ? labelOf(grid, ref) : rectLabelOf(grid, rect), keyOf(ref));
  };

  const select = (next: SurfaceSelection) => {
    if (picked(next)) return;
    show(signalOf(next));
  };

  const edited = (edits: readonly SurfaceEdit[]) => {
    if (sheet === undefined) return;
    for (const edit of edits) {
      const ref = refAt(grid, edit.row, edit.column);
      if (ref !== undefined) perform(typed(sheet, grid, ref, edit.text, facts));
    }
  };

  const rectsOf = (held: SurfaceSelection): Rect[] => [
    ...held.ranges,
    ...held.rows.map((row) => ({ row, column: 0, rows: 1, columns: grid.columns.length })),
    ...held.columns.map((column) => ({ row: 0, column, rows: grid.rows.length, columns: 1 }))
  ];

  const deleted = (held: SurfaceSelection) => {
    if (sheet === undefined) return;
    const refs = rectsOf(held).flatMap((rect) => refsIn(grid, rect));
    perform(cleared(sheet, grid, refs));
  };

  const fill = (wanted: SurfaceFill) => {
    if (sheet === undefined) return;
    const edit = filled(sheet, grid, wanted.source, wanted.target);
    if (perform(edit) && edit.summary !== undefined) say(edit.summary);
  };

  const paste = (wanted: SurfacePaste) => {
    if (sheet === undefined) return;
    const [rect] = selectedRects(grid, view.selection);
    const edit = pasted(sheet, grid, wanted, wanted.values, facts, rect);
    if (perform(edit) && edit.summary !== undefined) say(edit.summary);
  };

  const resize = (column: number, size: number) => {
    const id = grid.columns[column]?.id;
    if (id === undefined) return;
    const op = resizedColumn(grid, id, size);
    if (op !== undefined) apply([op]);
  };

  const resizeRow = (row: number, size: number) => {
    const id = grid.rows[row]?.id;
    if (id === undefined) return;
    const op = resizedRow(grid, id, size);
    if (op !== undefined) apply([op]);
  };

  const moveColumn = (from: number, to: number) => {
    const op = movedColumn(grid, from, to);
    if (op !== undefined) apply([op]);
  };

  const moveRow = (from: number, to: number) => {
    const op = movedRow(grid, from, to);
    if (op !== undefined) apply([op]);
  };

  const append = () => {
    apply(insertedRows(grid.rows.at(-1)?.id ?? null, APPEND_ROWS).ops);
  };

  const appendColumn = () => {
    apply(insertedColumns(grid.columns.at(-1)?.id ?? null, APPEND_COLUMNS).ops);
  };

  const pointed = (next: SurfaceHit) => {
    hit = next;
    if (sheet === undefined) return;
    if (next.kind === "cell") {
      const inside = selectedRects(grid, view.selection).some(
        (rect) => next.row >= rect.row && next.row < rect.row + rect.rows && next.column >= rect.column && next.column < rect.column + rect.columns
      );
      const ref = refAt(grid, next.row, next.column);
      if (!inside && ref !== undefined) show(cellSignal(sheet, grid, ref));
    } else if (next.kind === "row" && !selectedRowIds(view.selection).includes(grid.rows[next.row]?.id ?? "")) {
      show(rowSignal(grid, [next.row]));
    } else if (next.kind === "column" && !selectedColumnIds(view.selection).includes(grid.columns[next.column]?.id ?? "")) {
      show(columnSignal(grid, [next.column]));
    }
  };

  const hitRows = $derived.by((): number[] => {
    const held = hit;
    if (held === undefined || held.kind === "corner" || held.kind === "column") return [];
    const chosen = selectedRowIds(view.selection).flatMap((id) => {
      const index = grid.rowAt.get(id);
      return index === undefined ? [] : [index];
    });
    return chosen.includes(held.row) ? chosen : [held.row];
  });

  const hitColumns = $derived.by((): number[] => {
    const held = hit;
    if (held === undefined || held.kind === "corner" || held.kind === "row") return [];
    const chosen = selectedColumnIds(view.selection).flatMap((id) => {
      const index = grid.columnAt.get(id);
      return index === undefined ? [] : [index];
    });
    return chosen.includes(held.column) ? chosen : [held.column];
  });

  const hitRect = $derived.by((): Rect | undefined => {
    const rects = selectedRects(grid, view.selection);
    return rects.length === 1 && view.selection?.kind === "range" ? rects[0] : undefined;
  });

  const hitAnchor = $derived.by(() => {
    const held = hit;
    if (sheet === undefined || held === undefined || held.kind !== "cell") return undefined;
    const ref = refAt(grid, held.row, held.column);
    return ref === undefined ? undefined : mergeOf(sheet, grid, ref);
  });

  const rowWord = (indices: readonly number[]): string =>
    indices.length === 1 ? `row ${indices[0] + 1}` : `${indices.length} rows`;

  const columnWord = (indices: readonly number[]): string =>
    indices.length === 1 ? `column ${columnLabel(indices[0])}` : `${indices.length} columns`;

  const insertRows = (where: "above" | "below") => {
    const rows = hitRows;
    if (rows.length === 0) return;
    const sorted = [...rows].sort((a, b) => a - b);
    const after = where === "above" ? (sorted[0] === 0 ? null : grid.rows[sorted[0] - 1].id) : grid.rows[sorted[sorted.length - 1]].id;
    apply(insertedRows(after, sorted.length).ops);
  };

  const insertColumns = (where: "left" | "right") => {
    const columns = hitColumns;
    if (columns.length === 0) return;
    const sorted = [...columns].sort((a, b) => a - b);
    const after = where === "left" ? (sorted[0] === 0 ? null : grid.columns[sorted[0] - 1].id) : grid.columns[sorted[sorted.length - 1]].id;
    apply(insertedColumns(after, sorted.length).ops);
  };

  const removeRows = () => {
    if (sheet === undefined || hitRows.length === 0) return;
    if (hitRows.length >= grid.rows.length) {
      say("A sheet keeps at least one row.");
      return;
    }
    apply(removedRows(sheet, grid, hitRows.map((index) => grid.rows[index].id)));
    view.clear();
  };

  const removeColumns = () => {
    if (sheet === undefined || hitColumns.length === 0) return;
    if (hitColumns.length >= grid.columns.length) {
      say("A sheet keeps at least one column.");
      return;
    }
    apply(removedColumns(sheet, grid, hitColumns.map((index) => grid.columns[index].id)));
    view.clear();
  };

  const clearSelection = () => {
    if (selection !== undefined) deleted(selection);
  };

  const merge = () => {
    if (sheet === undefined || hitRect === undefined) return;
    const edit = merged(sheet, grid, hitRect);
    if (perform(edit) && edit.cleared !== undefined && edit.cleared > 0) {
      say(`${edit.cleared} ${edit.cleared === 1 ? "cell was" : "cells were"} cleared; ${rectLabelOf(grid, { ...hitRect, rows: 1, columns: 1 })} keeps its value.`);
    }
  };

  const unmerge = () => {
    if (sheet === undefined || hitAnchor === undefined) return;
    perform(unmerged(sheet, hitAnchor.anchor));
  };

  const freezeUpTo = () => {
    if (sheet === undefined || hitColumns.length === 0) return;
    const index = Math.max(...hitColumns) + 1;
    const frozen = sheet.body.frozenColumns ?? 0;
    const op = frozenColumnsSet(sheet.body, frozen === index ? 0 : index);
    if (op !== undefined) apply([op]);
  };

  const selectAll = () => show(everything());

  const openLens = (signal: Signal | undefined) => {
    if (signal !== undefined) view.inspect(signal.key, signal.selection);
  };

  const clampZoom = (value: number): number => Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)));

  const pinch = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    view.setZoom(clampZoom(zoom - (event.deltaY / WHEEL_NOTCH) * PERCENT_PER_NOTCH));
  };

  const keydown = (event: KeyboardEvent) => {
    const element = wrapper;
    if (element === undefined || !(event.target instanceof Node) || !element.contains(event.target)) return;
    if (!(event.metaKey || event.ctrlKey)) return;
    const key = event.key.toLowerCase();
    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      runtime?.undo();
    } else if ((key === "z" && event.shiftKey) || key === "y") {
      event.preventDefault();
      runtime?.redo();
    }
  };

  $effect(() => {
    const target = runtime?.scrollTo;
    if (target === undefined || runtime === undefined) return;
    const at = indexOf(grid, target);
    if (at !== undefined) {
      scrolls += 1;
      scrollTarget = { row: at.row, column: at.column, token: scrolls };
    }
    runtime.scrollTo = undefined;
  });

  let landed = $state<string | undefined>(undefined);

  $effect(() => {
    const focus = view.active.focus;
    const held = runtime;
    if (sheet === undefined || held === undefined || focus === undefined || focus === landed) return;
    const ref = parseRef(grid, focus);
    if (ref === undefined) return;
    landed = focus;
    held.scrollTo = ref;
    show(cellSignal(sheet, grid, ref));
  });

</script>

<svelte:window onkeydown={keydown} />

<div class="sheet-editor" bind:this={wrapper}>
  <header class="area-title bg-surface-panel border-border-subtle border-b">
    <h1 class="text-body-sm text-ink-primary m-0 truncate font-medium">{title ?? "Loading spreadsheet..."}</h1>
  </header>

  <ContextMenu.Root>
    <ContextMenu.Trigger>
      {#snippet child({ props })}
        <div {...props} class="area-grid" onwheel={pinch}>
          {#if scene}
            <SheetSurface
              {scene}
              {selection}
              {highlights}
              {zoom}
              {scrollTarget}
              bind:api
              onselect={select}
              onedit={edited}
              onbegin={beginWriting}
              ondelete={deleted}
              onfill={fill}
              onpaste={paste}
              onresize={resize}
              onrowresize={resizeRow}
              onmovecolumn={moveColumn}
              onmoverow={moveRow}
              appendHint={`+ ${APPEND_ROWS} rows`}
              appendColumnHint={`+ ${APPEND_COLUMNS} columns`}
              onappend={append}
              onappendcolumn={appendColumn}
              oncontext={pointed}
            />
          {:else}
            <p class="loading text-caption text-ink-muted">
              {runtime?.sync === "error" ? "This spreadsheet could not be read." : "Reading this spreadsheet..."}
            </p>
          {/if}
        </div>
      {/snippet}
    </ContextMenu.Trigger>

    <ContextMenu.Content class="w-60">
      {#if hit?.kind === "corner"}
        <ContextMenu.Item onSelect={selectAll}>Select the used range</ContextMenu.Item>
      {:else if hit?.kind === "cell"}
        <ContextMenu.Item onSelect={() => api?.cut()}>Cut</ContextMenu.Item>
        <ContextMenu.Item onSelect={() => api?.copy()}>Copy</ContextMenu.Item>
        <ContextMenu.Item onSelect={() => api?.paste()}>Paste</ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item onSelect={clearSelection}>Clear contents</ContextMenu.Item>
        {#if hitAnchor}
          <ContextMenu.Item onSelect={unmerge}>Unmerge {rectLabelOf(grid, hitAnchor.rect)}</ContextMenu.Item>
        {:else if hitRect && hitRect.rows * hitRect.columns > 1}
          <ContextMenu.Item onSelect={merge}>Merge {rectLabelOf(grid, hitRect)}</ContextMenu.Item>
        {/if}
        <ContextMenu.Separator />
        <ContextMenu.Item onSelect={() => insertRows("above")}>Insert {rowWord(hitRows)} above</ContextMenu.Item>
        <ContextMenu.Item onSelect={() => insertRows("below")}>Insert {rowWord(hitRows)} below</ContextMenu.Item>
        <ContextMenu.Item onSelect={() => insertColumns("left")}>Insert {columnWord(hitColumns)} left</ContextMenu.Item>
        <ContextMenu.Item onSelect={() => insertColumns("right")}>Insert {columnWord(hitColumns)} right</ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item variant="destructive" onSelect={removeRows}>Remove {rowWord(hitRows)}</ContextMenu.Item>
        <ContextMenu.Item variant="destructive" onSelect={removeColumns}>Remove {columnWord(hitColumns)}</ContextMenu.Item>
      {:else if hit?.kind === "row"}
        <ContextMenu.Label class="text-caption text-ink-muted px-1.5 py-1 font-normal">
          {rowWord(hitRows).replace(/^\w/, (letter) => letter.toUpperCase())}
        </ContextMenu.Label>
        <ContextMenu.Item onSelect={() => insertRows("above")}>Insert {rowWord(hitRows)} above</ContextMenu.Item>
        <ContextMenu.Item onSelect={() => insertRows("below")}>Insert {rowWord(hitRows)} below</ContextMenu.Item>
        <ContextMenu.Item onSelect={() => openLens(rowSignal(grid, hitRows))}>Height and more…</ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item onSelect={clearSelection}>Clear contents</ContextMenu.Item>
        <ContextMenu.Item variant="destructive" onSelect={removeRows}>Remove {rowWord(hitRows)}</ContextMenu.Item>
      {:else if hit?.kind === "column"}
        <ContextMenu.Label class="text-caption text-ink-muted px-1.5 py-1 font-normal">
          {columnWord(hitColumns).replace(/^\w/, (letter) => letter.toUpperCase())}
        </ContextMenu.Label>
        <ContextMenu.Item onSelect={() => insertColumns("left")}>Insert {columnWord(hitColumns)} left</ContextMenu.Item>
        <ContextMenu.Item onSelect={() => insertColumns("right")}>Insert {columnWord(hitColumns)} right</ContextMenu.Item>
        <ContextMenu.Item onSelect={() => openLens(columnSignal(grid, hitColumns))}>Width and more…</ContextMenu.Item>
        <ContextMenu.Item onSelect={freezeUpTo}>
          {(sheet?.body.frozenColumns ?? 0) === Math.max(...hitColumns) + 1 ? "Unfreeze columns" : `Freeze columns up to ${columnLabel(Math.max(...hitColumns))}`}
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item onSelect={clearSelection}>Clear contents</ContextMenu.Item>
        <ContextMenu.Item variant="destructive" onSelect={removeColumns}>Remove {columnWord(hitColumns)}</ContextMenu.Item>
      {/if}
    </ContextMenu.Content>
  </ContextMenu.Root>

  <div class="area-strip bg-surface-panel border-border-subtle flex items-center gap-2 border-t">
    {#if notice}
      <span class="text-caption text-attention-text min-w-0 truncate">{notice}</span>
    {/if}
    <span class="ms-auto flex shrink-0 items-center gap-1">
      <Button variant="ghost" size="icon-xs" aria-label="Undo" title="Undo" disabled={!runtime?.canUndo} onclick={() => runtime?.undo()}>
        <Undo2 aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="icon-xs" aria-label="Redo" title="Redo" disabled={!runtime?.canRedo} onclick={() => runtime?.redo()}>
        <Redo2 aria-hidden="true" />
      </Button>
      <span class="border-border-subtle mx-1 h-4 border-l" aria-hidden="true"></span>
      <Button variant="ghost" size="icon-xs" aria-label="Zoom out" onclick={() => view.setZoom(clampZoom(zoom - ZOOM_STEP))}>
        <Minus aria-hidden="true" />
      </Button>
      <button
        type="button"
        class="text-caption text-ink-secondary hover:text-ink-primary rounded-control w-12 tabular-nums"
        title="Back to 100%"
        onclick={() => view.setZoom(100)}
      >
        {zoom}%
      </button>
      <Button variant="ghost" size="icon-xs" aria-label="Zoom in" onclick={() => view.setZoom(clampZoom(zoom + ZOOM_STEP))}>
        <Plus aria-hidden="true" />
      </Button>
      <span class="text-caption text-ink-muted ms-2">· {SYNC_LABEL[runtime?.sync ?? "loading"]}</span>
    </span>
  </div>
</div>

<style>
  .sheet-editor {
    display: grid;
    height: 100%;
    min-height: 0;
    grid-template-rows: auto 1fr auto;
    grid-template-columns: minmax(0, 1fr);
  }

  .area-title {
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 4);
  }

  .area-grid {
    position: relative;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    background: var(--token-surface-elevated);
  }

  .loading {
    margin: 0;
    padding: calc(var(--token-spacing-unit) * 4);
  }

  .area-strip {
    min-width: 0;
    padding: calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 3);
  }
</style>
