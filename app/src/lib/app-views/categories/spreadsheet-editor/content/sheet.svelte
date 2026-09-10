<script lang="ts">
  import {
    SheetSurface,
    type SurfaceHighlight,
    type SurfaceSelection
  } from "$authored-components/sheet-surface";
  import * as ContextMenu from "$vendored-components/context-menu";
  import SheetMenu from "$app-views/categories/spreadsheet-editor/components/sheet-menu.svelte";
  import SheetStrip from "$app-views/categories/spreadsheet-editor/components/sheet-strip.svelte";
  import { createSheetState } from "$app-views/categories/spreadsheet-editor/content/sheet.state.svelte";
  import {
    gridOf,
    indexOf,
    keyOf,
    parseRef,
    type Grid
  } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { commentsQuery, threadsIn } from "$app-views/categories/spreadsheet-editor/procedures/comment-feed";
  import { anchorOf, pinsOf, threadsOf } from "$app-views/categories/spreadsheet-editor/procedures/comments";
  import { followsTheAskedForCell } from "$app-views/categories/spreadsheet-editor/procedures/effects/follows-the-asked-for-cell.svelte";
  import { holdsTheRuntime } from "$app-views/categories/spreadsheet-editor/procedures/effects/holds-the-runtime.svelte";
  import { loadsTheVariables } from "$app-views/categories/spreadsheet-editor/procedures/effects/loads-the-variables.svelte";
  import { recalculatesOnVariables } from "$app-views/categories/spreadsheet-editor/procedures/effects/recalculates-on-variables.svelte";
  import { settlesTheInspector } from "$app-views/categories/spreadsheet-editor/procedures/effects/settles-the-inspector.svelte";
  import { takesBackTheCaret } from "$app-views/categories/spreadsheet-editor/procedures/effects/takes-back-the-caret.svelte";
  import { pickingChannel } from "$app-views/categories/spreadsheet-editor/procedures/picking.svelte";
  import {
    factsOf,
    storedOf,
    type SheetCell,
    type SheetFacts
  } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
  import { dependentsOf, referencesIn } from "$app-views/categories/spreadsheet-editor/procedures/references";
  import { titleOf, titleQuery } from "$app-views/categories/spreadsheet-editor/procedures/resource-title";
  import { sceneOf } from "$app-views/categories/spreadsheet-editor/procedures/scene";
  import type { SheetActionContext } from "$app-views/categories/spreadsheet-editor/procedures/sheet-action-context";
  import { createSheetEditActions } from "$app-views/categories/spreadsheet-editor/procedures/sheet-edit-actions";
  import { createSheetKeyboardActions } from "$app-views/categories/spreadsheet-editor/procedures/sheet-keyboard-actions";
  import { createSheetSelectionActions } from "$app-views/categories/spreadsheet-editor/procedures/sheet-selection-actions";
  import {
    highlightedRefs,
    selectedRef,
    surfaceSelectionOf
  } from "$app-views/categories/spreadsheet-editor/procedures/selection-reading";
  import { cellSignal } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import { spillChildOf, spillOf } from "$app-views/categories/spreadsheet-editor/procedures/spill-spans";
  import { APPEND_COLUMNS, APPEND_ROWS } from "$app-views/categories/spreadsheet-editor/procedures/structure";
  import { variableRegister } from "$app-views/categories/spreadsheet-editor/procedures/variables.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const channel = pickingChannel();
  const register = variableRegister();
  const held = createSheetState();
  const sheetId = view.active.resourceId;

  const title = $derived(sheetId === undefined ? undefined : titleOf(titleQuery(sheetId)) || undefined);
  const attached = holdsTheRuntime();
  const runtime = $derived(attached.current);
  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const facts = $derived(factsOf(sheetId, sheet, title ?? ""));

  loadsTheVariables(register);
  recalculatesOnVariables(register, () => ({ resourceId: sheetId, sheet, runtime }));

  const comments = commentsQuery();
  const allThreads = $derived(threadsIn(comments));
  const threads = $derived(sheetId === undefined ? [] : threadsOf(allThreads, sheetId));
  const currentThread = $derived(view.inspected === "general.comment" ? view.selection?.id : undefined);
  const pins = $derived(
    sheet === undefined
      ? new Map()
      : pinsOf(
          threads,
          sheet,
          grid,
          currentThread,
          view.selection?.kind === "cell" ? view.selection.id : undefined
        )
  );

  const scene = $derived(
    sheet === undefined ? undefined : sceneOf(sheet, grid, pins, facts, channel.drafted)
  );
  const selection = $derived.by((): SurfaceSelection | undefined => {
    const selected = view.selection;
    if (selected?.kind !== "comment") return surfaceSelectionOf(grid, selected);
    const thread = allThreads.find((candidate) => candidate._id === selected.id);
    const anchor = thread === undefined ? undefined : anchorOf(thread);
    return anchor === undefined
      ? undefined
      : surfaceSelectionOf(grid, { kind: "cell", id: keyOf(anchor) });
  });
  const zoom = $derived(view.zoom ?? 100);

  const highlights = $derived.by((): SurfaceHighlight[] => {
    if (sheet === undefined) return [];
    const found: SurfaceHighlight[] = [];
    for (const hit of highlightedRefs(view.selection)) {
      const at = indexOf(grid, hit);
      if (at !== undefined) {
        found.push({
          rect: { row: at.row, column: at.column, rows: 1, columns: 1 },
          tone: "hit"
        });
      }
    }

    const ref = selectedRef(view.selection);
    if (ref === undefined) return found;
    const cell = sheet.cells[`${ref.rowId}/${ref.columnId}`];
    const writing = channel.drafted;
    const draft = writing === undefined ? undefined : storedOf(facts, writing.text);
    const reading: SheetCell | undefined = draft === undefined
      ? cell
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
      if (at !== undefined) {
        found.push({
          rect: { row: at.row, column: at.column, rows: 1, columns: 1 },
          tone: "feeds"
        });
      }
    }
    const spill = spillOf(sheet, grid, ref) ?? spillChildOf(sheet, grid, ref);
    if (spill !== undefined) found.push({ rect: spill.rect, tone: "spill" });
    return found;
  });

  const surfaceSelection = $derived(
    channel.armed && held.referencePick?.session === channel.session
      ? held.referencePick.selection
      : selection
  );

  const actionContext = {
    view,
    channel,
    register,
    held,
    sheetId,
    get runtime() { return runtime; },
    get sheet() { return sheet; },
    get grid(): Grid { return grid; },
    get facts(): SheetFacts { return facts; },
    get selection() { return selection; },
    get zoom() { return zoom; }
  } satisfies SheetActionContext;

  const edits = createSheetEditActions(actionContext);
  const selections = createSheetSelectionActions(actionContext);
  const keyboard = createSheetKeyboardActions(actionContext);

  settlesTheInspector({
    unset: () => sheet !== undefined && view.inspected === "empty" && view.selection === undefined,
    whole: () => view.inspect("spreadsheet-editor.spreadsheet"),
    collapsed: selections.collapsed,
    show: selections.show
  });
  takesBackTheCaret(channel, () => held.api?.focus());
  followsTheAskedForCell({
    scrollTo: () => {
      const target = runtime?.scrollTo;
      const open = runtime;
      if (target === undefined || open === undefined) return undefined;
      const at = indexOf(grid, target);
      return {
        reach: () => {
          if (at === undefined) return;
          held.scrolls += 1;
          held.scrollTarget = { row: at.row, column: at.column, token: held.scrolls };
        },
        taken: () => { open.scrollTo = undefined; }
      };
    },
    focused: () => {
      const focus = view.active.focus;
      const open = runtime;
      if (sheet === undefined || open === undefined || focus === undefined || focus === held.landed) {
        return undefined;
      }
      const ref = parseRef(grid, focus);
      if (ref === undefined) return undefined;
      return () => {
        held.landed = focus;
        open.scrollTo = ref;
        selections.show(cellSignal(sheet, grid, ref));
      };
    }
  });
</script>

<svelte:window onkeydown={keyboard.keydown} />

<div class="sheet-editor" bind:this={held.wrapper}>
  <header class="area-title bg-surface-panel border-border-subtle border-b">
    <h1 class="text-body-sm text-ink-primary m-0 truncate font-medium">{title ?? "Loading spreadsheet..."}</h1>
  </header>

  <ContextMenu.Root>
    <ContextMenu.Trigger>
      {#snippet child({ props })}
        <div {...props} class="area-grid" onwheel={keyboard.pinch}>
          {#if scene}
            <SheetSurface
              {scene}
              selection={surfaceSelection}
              {highlights}
              {zoom}
              scrollTarget={held.scrollTarget}
              bind:api={held.api}
              onselect={selections.select}
              onedit={edits.edited}
              onbegin={(seed) => channel.beginWriting(seed)}
              ondelete={edits.deleted}
              onfill={edits.fill}
              onpaste={edits.paste}
              onresize={edits.resize}
              onrowresize={edits.resizeRow}
              onmovecolumn={edits.moveColumn}
              onmoverow={edits.moveRow}
              appendHint={`+ ${APPEND_ROWS} rows`}
              appendColumnHint={`+ ${APPEND_COLUMNS} columns`}
              onappend={edits.append}
              onappendcolumn={edits.appendColumn}
              oncontext={selections.pointed}
              onselectiongesture={selections.referenceGesture}
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
      over={held.hit?.kind}
      row={held.hit !== undefined && held.hit.kind !== "corner" && held.hit.kind !== "column" ? held.hit.row : 0}
      column={held.hit !== undefined && held.hit.kind !== "corner" && held.hit.kind !== "row" ? held.hit.column : 0}
      onsay={edits.say}
      oncut={() => held.api?.cut()}
      oncopy={() => held.api?.copy()}
      onpaste={() => held.api?.paste()}
      onclear={edits.clearSelection}
      onselectall={selections.selectAll}
    />
  </ContextMenu.Root>

  <SheetStrip notice={held.notice} />
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
