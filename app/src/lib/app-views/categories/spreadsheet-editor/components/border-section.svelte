<script lang="ts">
  import PanelBottom from "@lucide/svelte/icons/panel-bottom";
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import PanelRight from "@lucide/svelte/icons/panel-right";
  import PanelTop from "@lucide/svelte/icons/panel-top";

  import {
    PanelColor,
    PanelControlGroup,
    PanelControlRow,
    PanelMarks,
    PanelNumber,
    PanelSection,
    PanelSelect
  } from "$authored-components/panel";
  import { gridOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { INKS, orNone } from "$app-views/categories/spreadsheet-editor/procedures/colors";
  import {
    BORDER_SIDES,
    hasBorder,
    type BorderLine,
    type BorderSide,
    type BorderStyle,
    type CellBorder
  } from "$app-views/categories/spreadsheet-editor/procedures/formatting";
  import { formatOps, paintsOf, sharedOf } from "$app-views/categories/spreadsheet-editor/procedures/painting";
  import { recalculating } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
  import { selectedRects, selectedRef } from "$app-views/categories/spreadsheet-editor/procedures/selection-reading";
  import { holdsTheRuntime } from "$app-views/categories/spreadsheet-editor/procedures/effects/holds-the-runtime.svelte";
  import { variableRegister } from "$app-views/categories/spreadsheet-editor/procedures/variables.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const register = variableRegister();
  const sheetId = $derived(view.active.resourceId);

  const attached = holdsTheRuntime();
  const runtime = $derived(attached.current);

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const rects = $derived(selectedRects(grid, view.selection));
  const ref = $derived(selectedRef(view.selection));
  const paints = $derived(paintsOf(sheet, grid, rects));
  const border = $derived(sharedOf(paints, (paint) => paint.format.border).value ?? undefined);

  const onchange = (next: CellBorder | null) => {
    if (sheet === undefined) return;
    const ops = formatOps(sheet, grid, rects, ref, "border", next);
    if (ops.length > 0) runtime?.apply(recalculating(register, sheetId, sheet, ops));
  };

  const lines = (sides: readonly BorderSide[]) =>
    paints.flatMap((paint) => sides.map((side) => paint.format.border?.[side] ?? null));

  const DASHES = [
    { value: "solid", label: "Solid" },
    { value: "dashed", label: "Dashed" },
    { value: "dotted", label: "Dotted" }
  ];

  const SIDE_OPTIONS = [
    { value: "left", label: "Left", icon: PanelLeft },
    { value: "top", label: "Top", icon: PanelTop },
    { value: "all", label: "All", short: "All" },
    { value: "bottom", label: "Bottom", icon: PanelBottom },
    { value: "right", label: "Right", icon: PanelRight }
  ];

  const DEFAULT_BORDER: BorderLine = { color: "--token-border-strong", width: 1, style: "solid" };

  let editing = $state<BorderSide[]>([]);

  const sideValue = $derived(
    editing.length === BORDER_SIDES.length ? ["all", ...editing] : [...editing]
  );

  const shared = $derived.by((): { value: BorderLine | undefined; mixed: boolean } => {
    const seen = [...new Set(lines(editing).map((line) => JSON.stringify(line)))];
    return {
      value: seen.length === 1 ? ((JSON.parse(seen[0]) as BorderLine | null) ?? undefined) : undefined,
      mixed: seen.length > 1
    };
  });

  const line = $derived(shared.value);
  const drawn = $derived(editing.some((side) => border?.[side] !== undefined));

  const sided = (next: string[]) => {
    const wanted = next.filter((value): value is BorderSide => value !== "all");
    const everything = editing.length === BORDER_SIDES.length;
    if (next.includes("all") && !everything) {
      editing = [...BORDER_SIDES];
      return;
    }
    if (!next.includes("all") && everything && wanted.length === BORDER_SIDES.length) {
      editing = [];
      return;
    }
    editing = BORDER_SIDES.filter((side) => wanted.includes(side));
  };

  const bordered = (change: (held: BorderLine | undefined) => BorderLine | undefined) => {
    if (editing.length === 0) return;
    const next: CellBorder = { ...(border ?? {}) };
    for (const side of editing) {
      const wanted = change(next[side]);
      if (wanted === undefined) delete next[side];
      else next[side] = wanted;
    }
    onchange(hasBorder(next) ? next : null);
  };

  const coloured = (next: string) => {
    if (next === "") {
      bordered(() => undefined);
      return;
    }
    bordered((held) => ({
      color: next,
      width: held === undefined || held.width <= 0 ? DEFAULT_BORDER.width : held.width,
      style: held?.style ?? DEFAULT_BORDER.style
    }));
  };

  const widened = (width: number) => {
    if (width <= 0) {
      bordered(() => undefined);
      return;
    }
    bordered((held) => ({
      color: held?.color ?? DEFAULT_BORDER.color,
      width,
      style: held?.style ?? DEFAULT_BORDER.style
    }));
  };

  const dashed = (style: string) => {
    bordered((held) => (held === undefined ? undefined : { ...held, style: style as BorderStyle }));
  };
</script>

<PanelSection title="Border">
  <PanelControlGroup flush>
    <PanelMarks
      label="Which sides you are styling"
      value={sideValue}
      options={SIDE_OPTIONS}
      flush
      onchange={sided}
    />
    <PanelControlRow label="Border">
      <div class="pair">
        <div class="swatch">
          <PanelColor
            picker
            clearable
            label="Border colour"
            value={orNone(line?.color)}
            options={INKS}
            mixed={shared.mixed}
            disabled={editing.length === 0}
            flush
            onchange={coloured}
          />
        </div>
        <div class="figure">
          <PanelNumber
            label="Border width"
            value={line?.width ?? 0}
            min={0}
            max={12}
            disabled={editing.length === 0}
            flush
            onchange={widened}
          />
        </div>
      </div>
    </PanelControlRow>
    <PanelControlRow label="Dash">
      <PanelSelect
        label="Border dash"
        value={line?.style ?? "solid"}
        mixed={shared.mixed}
        options={DASHES}
        disabled={!drawn}
        onchange={dashed}
      />
    </PanelControlRow>
  </PanelControlGroup>
</PanelSection>

<style>
  .pair {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: flex-start;
    gap: calc(var(--token-spacing-unit) * 1.5);
  }

  .swatch {
    flex: 0 0 auto;
  }

  .figure {
    width: 4.25rem;
    flex-shrink: 0;
  }
</style>
