<script lang="ts">
  import AlignCenter from "@lucide/svelte/icons/align-center";
  import AlignLeft from "@lucide/svelte/icons/align-left";
  import AlignRight from "@lucide/svelte/icons/align-right";
  import AlignVerticalJustifyCenter from "@lucide/svelte/icons/align-vertical-justify-center";
  import AlignVerticalJustifyEnd from "@lucide/svelte/icons/align-vertical-justify-end";
  import AlignVerticalJustifyStart from "@lucide/svelte/icons/align-vertical-justify-start";

  import {
    PanelChoice,
    PanelControlGroup,
    PanelControlRow,
    PanelMarks,
    PanelNumber,
    PanelSection,
    PanelSelect
  } from "$authored-components/panel";
  import { Input } from "$vendored-components/input";
  import ColorPair from "$app-views/categories/spreadsheet-editor/components/color-pair.svelte";
  import { gridOf, keyOf, refsIn } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { setField, type Edit } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import { orClear, orNone } from "$app-views/categories/spreadsheet-editor/procedures/colors";
  import {
    DEFAULT_FONT_SIZE,
    FAMILIES,
    emphasisOf,
    familyOf,
    paintOf,
    sizeOf,
    type BlockFormat,
    type Paint
  } from "$app-views/categories/spreadsheet-editor/procedures/formatting";
  import { STYLES } from "$app-views/categories/spreadsheet-editor/procedures/marks";
  import { selectedRects, selectedRef } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import {
    DEFAULT_COLUMN_WIDTH,
    DEFAULT_ROW_HEIGHT,
    resizedColumn,
    resizedRow
  } from "$app-views/categories/spreadsheet-editor/procedures/structure";
  import { appliedStyle, ruleFormatOver } from "$app-views/categories/spreadsheet-editor/procedures/styles";
  import { pixelsOf, pointsOf } from "$app-views/categories/spreadsheet-editor/procedures/units";
  import { workspaceState, type SpreadsheetRuntime } from "$model/client/workspace-state";

  const ALIGN = [
    { value: "start", label: "Left", icon: AlignLeft },
    { value: "center", label: "Center", icon: AlignCenter },
    { value: "end", label: "Right", icon: AlignRight }
  ];

  const VALIGN = [
    { value: "top", label: "Top", icon: AlignVerticalJustifyStart },
    { value: "middle", label: "Middle", icon: AlignVerticalJustifyCenter },
    { value: "bottom", label: "Bottom", icon: AlignVerticalJustifyEnd }
  ];

  const FAMILY_OPTIONS = FAMILIES.map((family) => ({ value: family, label: family }));

  const view = workspaceState();

  const sheetId = $derived(view.active.resourceId);

  let runtime = $state<SpreadsheetRuntime | undefined>(undefined);

  $effect(() => {
    runtime = sheetId === undefined ? undefined : view.spreadsheetRuntime(sheetId);
  });

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const rects = $derived(selectedRects(grid, view.selection));
  const ref = $derived(selectedRef(view.selection));
  const held = $derived(sheet === undefined || ref === undefined ? undefined : sheet.cells[keyOf(ref)]);

  const paints = $derived(
    sheet === undefined
      ? []
      : rects.flatMap((rect) => refsIn(grid, rect).map((at) => paintOf(sheet.body, grid, at, sheet.cells[keyOf(at)])))
  );

  const shared = <T,>(pick: (paint: Paint) => T): { value: T | undefined; mixed: boolean } => {
    const values = [...new Set(paints.map((paint) => JSON.stringify(pick(paint) ?? null)))];
    return { value: values.length === 1 ? (JSON.parse(values[0]) as T) : undefined, mixed: values.length > 1 };
  };

  const styleShared = $derived(shared((paint) => paint.styleKey));
  const familyShared = $derived(shared((paint) => familyOf(paint) ?? FAMILIES[0]));
  const sizeShared = $derived(shared((paint) => sizeOf(paint) ?? DEFAULT_FONT_SIZE));
  const alignShared = $derived(shared((paint) => paint.format.horizontalAlignment ?? paint.style.horizontalAlignment));
  const valignShared = $derived(shared((paint) => paint.format.verticalAlignment ?? "middle"));
  const colorShared = $derived(shared((paint) => paint.format.color ?? paint.style.color));
  const backgroundShared = $derived(shared((paint) => paint.format.background ?? paint.style.background));
  const emphases = $derived(paints.map(emphasisOf));
  const marksOn = $derived(
    STYLES.filter((style) => emphases.length > 0 && emphases.every((emphasis) => emphasis[style.value as keyof typeof emphasis])).map((style) => style.value)
  );
  const marksMixed = $derived(
    STYLES.filter((style) => {
      const held = emphases.map((emphasis) => emphasis[style.value as keyof typeof emphasis]);
      return held.some(Boolean) && !held.every(Boolean);
    }).map((style) => style.value)
  );

  const styleOptions = $derived(
    sheet === undefined ? [] : Object.entries(sheet.body.styles.styles).map(([value, style]) => ({ value, label: style.name }))
  );

  const columnIds = $derived([
    ...new Set(rects.flatMap((rect) => grid.columns.slice(rect.column, rect.column + rect.columns).map((column) => column.id)))
  ]);
  const rowIds = $derived([
    ...new Set(rects.flatMap((rect) => grid.rows.slice(rect.row, rect.row + rect.rows).map((row) => row.id)))
  ]);
  const widths = $derived([...new Set(columnIds.map((id) => grid.columns[grid.columnAt.get(id) ?? -1]?.width ?? DEFAULT_COLUMN_WIDTH))]);
  const heights = $derived([...new Set(rowIds.map((id) => grid.rows[grid.rowAt.get(id) ?? -1]?.height ?? DEFAULT_ROW_HEIGHT))]);

  let widthDraft = $state("");
  let heightDraft = $state("");

  $effect(() => {
    widthDraft = widths.length === 1 ? String(pointsOf(widths[0])) : "";
  });

  $effect(() => {
    heightDraft = heights.length === 1 ? String(pointsOf(heights[0])) : "";
  });

  const apply = (ops: Edit["ops"]) => {
    if (ops.length > 0) runtime?.apply(ops);
  };

  const formatted = (field: keyof BlockFormat, value: unknown) => {
    if (sheet === undefined) return;
    if (ref !== undefined && held !== undefined) {
      apply([setField(sheet, ref, `format/${field}`, value)]);
      return;
    }
    apply(ruleFormatOver(sheet.body, grid, rects, field, value));
  };

  const styled = (key: string) => {
    if (sheet === undefined) return;
    apply(appliedStyle(sheet.body, grid, rects, key));
  };

  const marked = (next: string[]) => {
    for (const style of STYLES) {
      const wanted = next.includes(style.value);
      const had = marksOn.includes(style.value);
      if (wanted === had && !marksMixed.includes(style.value)) continue;
      formatted(style.value as keyof BlockFormat, wanted ? true : null);
    }
  };

  const sized = (raw: string, along: "width" | "height") => {
    const wanted = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(wanted)) {
      widthDraft = widths.length === 1 ? String(pointsOf(widths[0])) : "";
      heightDraft = heights.length === 1 ? String(pointsOf(heights[0])) : "";
      return;
    }
    const pixels = pixelsOf(wanted);
    const ops =
      along === "width"
        ? columnIds.flatMap((id) => {
            const op = resizedColumn(grid, id, pixels);
            return op === undefined ? [] : [op];
          })
        : rowIds.flatMap((id) => {
            const op = resizedRow(grid, id, pixels);
            return op === undefined ? [] : [op];
          });
    apply(ops);
  };
</script>

{#if sheet && rects.length > 0}
  <PanelSection title="Format">
    <PanelControlGroup flush>
      <PanelControlRow label="Style">
        <PanelSelect label="Style" value={styleShared.value ?? ""} mixed={styleShared.mixed} options={styleOptions} onchange={styled} />
      </PanelControlRow>
      <PanelControlRow label="Font">
        <PanelSelect
          label="Font"
          value={familyShared.value ?? FAMILIES[0]}
          mixed={familyShared.mixed}
          options={FAMILY_OPTIONS}
          onchange={(next) => formatted("fontFamily", next)}
        />
      </PanelControlRow>
      <PanelControlRow label="Font size">
        <PanelNumber
          label="Font size"
          value={sizeShared.value ?? DEFAULT_FONT_SIZE}
          unit="px"
          min={6}
          max={96}
          flush
          onchange={(next) => formatted("fontSize", next)}
        />
      </PanelControlRow>
      <div class="border-border-subtle border-t" aria-hidden="true"></div>
      <PanelMarks label="Formatting" value={[...marksOn]} mixed={marksMixed} options={STYLES} flush onchange={marked} />
      <ColorPair
        foreground={orNone(colorShared.value)}
        background={orNone(backgroundShared.value)}
        mixed={colorShared.mixed || backgroundShared.mixed}
        onforeground={(next) => formatted("color", orClear(next))}
        onbackground={(next) => formatted("background", orClear(next))}
      />
      <PanelControlRow label="Align">
        <PanelChoice
          label="Alignment"
          value={alignShared.value ?? ""}
          mixed={alignShared.mixed}
          options={ALIGN}
          fill
          flush
          onchange={(next) => formatted("horizontalAlignment", next)}
        />
      </PanelControlRow>
      <PanelControlRow label="Vertical">
        <PanelChoice
          label="Vertical alignment"
          value={valignShared.value ?? "middle"}
          mixed={valignShared.mixed}
          options={VALIGN}
          fill
          flush
          onchange={(next) => formatted("verticalAlignment", next === "middle" ? null : next)}
        />
      </PanelControlRow>
      <div class="border-border-subtle border-t" aria-hidden="true"></div>
      <PanelControlRow label="Size (pt)">
        <span class="dimension">
          <span class="text-caption text-ink-muted">W</span>
          <Input
            type="number"
            value={widthDraft}
            min={18}
            max={450}
            step={0.5}
            placeholder="–"
            inputmode="decimal"
            aria-label="Width in points"
            class="text-caption h-7 px-1.5 text-center [appearance:textfield] tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            oninput={(event: Event & { currentTarget: EventTarget & HTMLInputElement }) => {
              widthDraft = event.currentTarget.value;
            }}
            onchange={(event: Event & { currentTarget: EventTarget & HTMLInputElement }) => sized(event.currentTarget.value, "width")}
          />
        </span>
        <span class="dimension">
          <span class="text-caption text-ink-muted">H</span>
          <Input
            type="number"
            value={heightDraft}
            min={12}
            max={300}
            step={0.5}
            placeholder="–"
            inputmode="decimal"
            aria-label="Height in points"
            class="text-caption h-7 px-1.5 text-center [appearance:textfield] tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            oninput={(event: Event & { currentTarget: EventTarget & HTMLInputElement }) => {
              heightDraft = event.currentTarget.value;
            }}
            onchange={(event: Event & { currentTarget: EventTarget & HTMLInputElement }) => sized(event.currentTarget.value, "height")}
          />
        </span>
      </PanelControlRow>
    </PanelControlGroup>
  </PanelSection>
{/if}

<style>
  .dimension {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1);
  }
</style>
