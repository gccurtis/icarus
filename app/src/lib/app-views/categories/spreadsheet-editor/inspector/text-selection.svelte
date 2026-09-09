<script lang="ts">
  import {
    Panel,
    PanelColor,
    PanelCrumbs,
    PanelEmpty,
    PanelInput,
    PanelMarks,
    PanelQuote,
    PanelRow,
    PanelSection
  } from "$authored-components/panel";
  import { gridOf, keyOf, labelOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { cellAt } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import { INKS } from "$app-views/categories/spreadsheet-editor/procedures/colors";
  import { mint } from "$app-views/categories/spreadsheet-editor/procedures/ids";
  import {
    STYLES,
    covers,
    exactly,
    isMarkStyle,
    spanOf,
    type Mark,
    type MarkStyle
  } from "$app-views/categories/spreadsheet-editor/procedures/marks";
  import { textRangeOf } from "$app-views/categories/spreadsheet-editor/procedures/selection-reading";
  import { cellSignal } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import { displayOf } from "$app-views/categories/spreadsheet-editor/procedures/values";
  import { holdsTheRuntime } from "$app-views/categories/spreadsheet-editor/procedures/effects/holds-the-runtime.svelte";
  import { isInspectorView, workspaceState, type SpreadsheetRuntime } from "$model/client/workspace-state";

  const view = workspaceState();

  const sheetId = $derived(view.active.resourceId);

  const attached = holdsTheRuntime();
  const runtime = $derived(attached.current);

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const range = $derived(textRangeOf(view.selection));
  const held = $derived(sheet === undefined || range === undefined ? undefined : cellAt(sheet, range.ref));
  const label = $derived(range === undefined ? "?" : labelOf(grid, range.ref));
  const text = $derived(displayOf(held?.value));
  const quoted = $derived(range === undefined ? "" : text.slice(range.from, range.to));
  const marks = $derived(held?.marks ?? []);
  const covering = $derived(range === undefined ? [] : marks.filter((mark) => covers(mark, range.from, range.to)));
  const styles = $derived([...new Set(covering.flatMap((mark) => mark.style ?? []))]);
  const color = $derived(covering.find((mark) => mark.color !== undefined)?.color ?? "");
  const links = $derived(covering.filter((mark) => mark.link?.kind === "url"));

  const path = $derived(range === undefined ? "" : `${keyOf(range.ref)}/marks`);

  const apply = (ops: Parameters<SpreadsheetRuntime["apply"]>[0]) => {
    if (ops.length > 0) runtime?.apply(ops);
  };

  const insert = (mark: Mark) => {
    apply([{ op: "insert", target: "mark", path, ids: [mark.id], after: marks.at(-1)?.id ?? null, values: [mark] }]);
  };

  const remove = (mark: Mark) => {
    const index = marks.findIndex((held) => held.id === mark.id);
    apply([{ op: "remove", target: "mark", path, ids: [mark.id], after: index <= 0 ? null : marks[index - 1].id, values: [mark] }]);
  };

  const restyle = (mark: Mark, next: MarkStyle[]) => {
    if (next.length === 0 && mark.link === undefined && mark.color === undefined) {
      remove(mark);
      return;
    }
    apply([{ op: "set", target: "mark", path: `${path}/${mark.id}/style`, value: next.length === 0 ? null : next, was: mark.style ?? null }]);
  };

  const marked = (chosen: string[]) => {
    if (range === undefined || held === undefined) return;
    const next = chosen.filter(isMarkStyle);
    const added = next.filter((style) => !styles.includes(style));
    const removed = styles.filter(isMarkStyle).filter((style) => !next.includes(style));
    for (const style of added) {
      insert({ id: mint("mark"), ...spanOf(range.from, range.to), style: [style] });
    }
    for (const style of removed) {
      for (const mark of covering.filter((candidate) => candidate.style?.includes(style))) {
        restyle(mark, (mark.style ?? []).filter((kept) => kept !== style));
      }
    }
  };

  const colored = (next: string) => {
    if (range === undefined || held === undefined) return;
    const existing = covering.find((mark) => mark.color !== undefined);
    if (next === "") {
      if (existing === undefined) return;
      if ((existing.style ?? []).length === 0 && existing.link === undefined) remove(existing);
      else apply([{ op: "set", target: "mark", path: `${path}/${existing.id}/color`, value: null, was: existing.color ?? null }]);
      return;
    }
    if (existing !== undefined && exactly(existing, range.from, range.to)) {
      apply([{ op: "set", target: "mark", path: `${path}/${existing.id}/color`, value: next, was: existing.color ?? null }]);
      return;
    }
    insert({ id: mint("mark"), ...spanOf(range.from, range.to), color: next });
  };

  const linked = (url: string) => {
    if (range === undefined || held === undefined || url.trim() === "") return;
    insert({ id: mint("mark"), ...spanOf(range.from, range.to), link: { kind: "url", url: url.trim() } });
  };

  const navigate = (key: string) => {
    if (key === "spreadsheet-editor.cell" && sheet !== undefined && range !== undefined) {
      const signal = cellSignal(sheet, grid, range.ref);
      view.inspect(signal.key, signal.selection);
      return;
    }
    if (isInspectorView(key)) view.inspect(key);
  };
</script>

<Panel title="Text selection">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Spreadsheet", key: "spreadsheet-editor.spreadsheet" }, { label, key: "spreadsheet-editor.cell" }, { label: "Selection" }]}
      onnavigate={navigate}
    />
  {/snippet}

  {#if sheet && range && held}
    <div class="quote">
      <PanelQuote source={`${quoted.length} ${quoted.length === 1 ? "character" : "characters"} · ${label}`}>{quoted}</PanelQuote>
    </div>

    <PanelSection title="Marks">
      <PanelMarks label="Marks" value={styles} options={STYLES} onchange={marked} />
      <PanelColor label="Text color" value={color} options={INKS} onchange={colored} />
    </PanelSection>

    <PanelSection title="Link" count={links.length}>
      {#each links as mark (mark.id)}
        <PanelRow title={mark.link?.kind === "url" ? mark.link.url : ""} sub="Select to remove" onselect={() => remove(mark)} />
      {/each}
      <PanelInput label="URL" placeholder="https://" onenter={linked} />
    </PanelSection>
  {:else}
    <PanelEmpty title="Select characters in a cell's text" />
  {/if}
</Panel>

<style>
  .quote {
    padding: calc(var(--token-spacing-unit) * 2) 0 calc(var(--token-spacing-unit) * 3);
  }
</style>
