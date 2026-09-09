<script lang="ts">
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
  import * as ContextMenu from "$vendored-components/context-menu";
  import SheetMenu from "$app-views/categories/spreadsheet-editor/components/sheet-menu.svelte";
  import SheetStrip from "$app-views/categories/spreadsheet-editor/components/sheet-strip.svelte";
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
    type Rect
  } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { cleared, typed, type Edit } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import { pasted } from "$app-views/categories/spreadsheet-editor/procedures/clipboard";
  import { anchorOf, pinsOf, threadsOf } from "$app-views/categories/spreadsheet-editor/procedures/comments";
  import { filled } from "$app-views/categories/spreadsheet-editor/procedures/fill";
  import { armed, beginWriting, drafted, pick } from "$app-views/categories/spreadsheet-editor/procedures/picking.svelte";
  import {
    factsOf,
    recalculating,
    storedOf,
    type SheetCell
  } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
  import { followsTheAskedForCell } from "$app-views/categories/spreadsheet-editor/procedures/effects/follows-the-asked-for-cell.svelte";
  import { loadsTheVariables } from "$app-views/categories/spreadsheet-editor/procedures/effects/loads-the-variables.svelte";
  import { recalculatesOnVariables } from "$app-views/categories/spreadsheet-editor/procedures/effects/recalculates-on-variables.svelte";
  import { settlesTheInspector } from "$app-views/categories/spreadsheet-editor/procedures/effects/settles-the-inspector.svelte";
  import { takesBackTheCaret } from "$app-views/categories/spreadsheet-editor/procedures/effects/takes-back-the-caret.svelte";
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
  import {
    merged,
    mergeAround,
    mergeOf,
    spillChildOf,
    spillOf,
    unmerged
  } from "$app-views/categories/spreadsheet-editor/procedures/spans";
  import { usedRect } from "$app-views/categories/spreadsheet-editor/procedures/stats";
  import { rowsOf, tableQuery, titleOf, titleQuery } from "$app-views/categories/spreadsheet-editor/procedures/store";
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
  import { holdsTheRuntime } from "$app-views/categories/spreadsheet-editor/procedures/effects/holds-the-runtime.svelte";
  import { workspaceState, type SyncState } from "$model/client/workspace-state";

  const WHEEL_NOTCH = 120;
  const PERCENT_PER_NOTCH = 2;
  const ZOOM_STEP = 10;
  const ZOOM_MIN = 50;
  const ZOOM_MAX = 200;

  const view = workspaceState();

  const sheetId = $derived(view.active.resourceId);

  const title = $derived(sheetId === undefined ? undefined : titleOf(titleQuery(sheetId)) || undefined);

  const attached = holdsTheRuntime();
  const runtime = $derived(attached.current);

  loadsTheVariables(() => view.project);

  recalculatesOnVariables(
    () => view.project,
    () => ({ resourceId: sheetId, sheet, runtime })
  );

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

  const scene = $derived(sheet === undefined ? undefined : sceneOf(sheet, grid, pins, facts, drafted()));
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
    const draft = writing === undefined ? undefined : storedOf(facts, writing.text);
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
    runtime?.apply(recalculating(view.project, sheetId, sheet, ops));
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

  const collapsed = (): Signal | undefined => {
    const held = view.selection;
    if (sheet === undefined || held?.kind !== "range" || held.ranges !== undefined) return undefined;
    const [only] = selectedRects(grid, held);
    if (only === undefined) return undefined;
    const span = mergeAround(sheet, grid, only);
    return span === undefined ? undefined : cellSignal(sheet, grid, span.anchor);
  };

  settlesTheInspector({
    unset: () => sheet !== undefined && view.inspected === "empty" && view.selection === undefined,
    whole: () => view.inspect(WHOLE),
    collapsed,
    show
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
      const span = mergeAround(sheet, grid, only);
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



  const selectAll = () => show(everything());

  const clearSelection = () => {
    if (selection !== undefined) deleted(selection);
  };

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

  takesBackTheCaret(() => api?.focus());

  let landed = $state<string | undefined>(undefined);

  followsTheAskedForCell({
    scrollTo: () => {
      const target = runtime?.scrollTo;
      const held = runtime;
      if (target === undefined || held === undefined) return undefined;
      const at = indexOf(grid, target);
      return {
        reach: () => {
          if (at === undefined) return;
          scrolls += 1;
          scrollTarget = { row: at.row, column: at.column, token: scrolls };
        },
        taken: () => {
          held.scrollTo = undefined;
        }
      };
    },
    focused: () => {
      const focus = view.active.focus;
      const held = runtime;
      if (sheet === undefined || held === undefined || focus === undefined || focus === landed) return undefined;
      const ref = parseRef(grid, focus);
      if (ref === undefined) return undefined;
      return () => {
        landed = focus;
        held.scrollTo = ref;
        show(cellSignal(sheet, grid, ref));
      };
    }
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

    <SheetMenu
      over={hit?.kind}
      row={hit !== undefined && hit.kind !== "corner" && hit.kind !== "column" ? hit.row : 0}
      column={hit !== undefined && hit.kind !== "corner" && hit.kind !== "row" ? hit.column : 0}
      onsay={say}
      oncut={() => api?.cut()}
      oncopy={() => api?.copy()}
      onpaste={() => api?.paste()}
      onclear={clearSelection}
      onselectall={selectAll}
    />
  </ContextMenu.Root>

  <SheetStrip {notice} />
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

</style>
