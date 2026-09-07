<script lang="ts">
  import AlignCenter from "@lucide/svelte/icons/align-center";
  import AlignLeft from "@lucide/svelte/icons/align-left";
  import AlignRight from "@lucide/svelte/icons/align-right";
  import AlignVerticalJustifyCenter from "@lucide/svelte/icons/align-vertical-justify-center";
  import AlignVerticalJustifyEnd from "@lucide/svelte/icons/align-vertical-justify-end";
  import AlignVerticalJustifyStart from "@lucide/svelte/icons/align-vertical-justify-start";
  import PanelBottom from "@lucide/svelte/icons/panel-bottom";
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import PanelRight from "@lucide/svelte/icons/panel-right";
  import PanelTop from "@lucide/svelte/icons/panel-top";

  import {
    PanelChoice,
    PanelColor,
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
  import { INKS, orClear, orNone } from "$app-views/categories/spreadsheet-editor/procedures/colors";
  import {
    BORDER_SIDES,
    DEFAULT_FONT_SIZE,
    FAMILIES,
    emphasisOf,
    hasBorder,
    familyOf,
    paintOf,
    sizeOf,
    type BlockFormat,
    type Border,
    type BorderLine,
    type BorderSide,
    type BorderStyle,
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
  const borderShared = $derived(shared((paint) => paint.format.border));
  const border = $derived(borderShared.value ?? undefined);

  let editing = $state<BorderSide[]>([]);

  const sideValue = $derived(editing.length === BORDER_SIDES.length ? ["all", ...editing] : [...editing]);

  const drawn = $derived(editing.some((side) => border?.[side] !== undefined));

  const lineShared = $derived.by((): { value: BorderLine | undefined; mixed: boolean } => {
    const seen = [
      ...new Set(paints.flatMap((paint) => editing.map((side) => JSON.stringify(paint.format.border?.[side] ?? null))))
    ];
    return { value: seen.length === 1 ? ((JSON.parse(seen[0]) as BorderLine | null) ?? undefined) : undefined, mixed: seen.length > 1 };
  });

  const line = $derived(lineShared.value);
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
    const next: Border = { ...(border ?? {}) };
    for (const side of editing) {
      const wanted = change(next[side]);
      if (wanted === undefined) delete next[side];
      else next[side] = wanted;
    }
    formatted("border", hasBorder(next) ? next : null);
  };

  const borderColoured = (next: string) => {
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

  const borderSized = (width: number) => {
    if (width <= 0) {
      bordered(() => undefined);
      return;
    }
    bordered((held) => ({ color: held?.color ?? DEFAULT_BORDER.color, width, style: held?.style ?? DEFAULT_BORDER.style }));
  };

  const borderDashed = (style: string) => {
    bordered((held) => (held === undefined ? undefined : { ...held, style: style as BorderStyle }));
  };
</script>

{#if sheet && rects.length > 0}
  <PanelSection title="Format">
    <PanelControlGroup flush>
      <PanelSelect label="Style" value={styleShared.value ?? ""} mixed={styleShared.mixed} options={styleOptions} onchange={styled} />
      <div class="pair">
        <div class="grow">
          <PanelSelect
            label="Font"
            value={familyShared.value ?? FAMILIES[0]}
            mixed={familyShared.mixed}
            options={FAMILY_OPTIONS}
            onchange={(next) => formatted("fontFamily", next)}
          />
        </div>
        <div class="figure">
          <PanelNumber
            label="Font size"
            value={sizeShared.value ?? DEFAULT_FONT_SIZE}
            min={6}
            max={96}
            flush
            onchange={(next) => formatted("fontSize", next)}
          />
        </div>
      </div>
      <PanelMarks label="Formatting" value={[...marksOn]} mixed={marksMixed} options={STYLES} flush onchange={marked} />
      <ColorPair
        foreground={orNone(colorShared.value)}
        background={orNone(backgroundShared.value)}
        mixed={colorShared.mixed || backgroundShared.mixed}
        onforeground={(next) => formatted("color", orClear(next))}
        onbackground={(next) => formatted("background", orClear(next))}
      />
    </PanelControlGroup>
  </PanelSection>

  <PanelSection title="Cell style">
    <PanelControlGroup flush>
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

  <PanelSection title="Border">
    <PanelControlGroup flush>
      <PanelMarks label="Which sides you are styling" value={sideValue} options={SIDE_OPTIONS} flush onchange={sided} />
      <PanelControlRow label="Border">
        <div class="pair tight">
          <div class="swatch">
            <PanelColor
              picker
              clearable
              label="Border colour"
              value={orNone(line?.color)}
              options={INKS}
              mixed={lineShared.mixed}
              disabled={editing.length === 0}
              flush
              onchange={borderColoured}
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
              onchange={borderSized}
            />
          </div>
        </div>
      </PanelControlRow>
      <PanelControlRow label="Dash">
        <PanelSelect
          label="Border dash"
          value={line?.style ?? "solid"}
          mixed={lineShared.mixed}
          options={DASHES}
          disabled={!drawn}
          onchange={borderDashed}
        />
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

  .pair {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
  }

  .grow {
    min-width: 0;
    flex: 1;
  }

  .tight {
    justify-content: flex-start;
  }

  .swatch {
    flex: 0 0 auto;
  }

  .figure {
    width: 4.25rem;
    flex-shrink: 0;
  }
</style>
