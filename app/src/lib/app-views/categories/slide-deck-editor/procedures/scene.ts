import type {
  FormulaBlock,
  PromptBlock,
  TableCell,
  TextBlock
} from "$representation/data/types/content/content-block";
import { rangeOf } from "$representation/data/behavior/content/positions";
import type {
  AspectRatio,
  Dash,
  DeckTheme,
  ElementType,
  Frame,
  LineEnd,
  Point,
  ShapeKind,
  Slide,
  SlideBackground,
  SlideDeckBody,
  SlideElement
} from "$representation/data/types/slide-decks/body";
import type { TextStyle } from "$representation/data/types/slide-decks/style-set";
import { placedOn, styleOf } from "$app-views/categories/slide-deck-editor/procedures/deck";
import type { Size } from "$app-views/categories/slide-deck-editor/procedures/stage";
import { columnsOf, gridOf, type GridCell } from "$app-views/categories/slide-deck-editor/procedures/tables";

export type Run = {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly strike: boolean;
  readonly code: boolean;
  readonly color?: string;
  readonly formula: boolean;
};

export type TextScene = {
  readonly blockId: string;
  readonly display: string;
  readonly runs: readonly Run[];
  readonly font: string;
  readonly size: number;
  readonly weight: number;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly strike: boolean;
  readonly color: string;
  readonly background?: string;
  readonly lineHeight: number;
  readonly align: "start" | "center" | "end" | "justify";
  readonly valign: "top" | "middle" | "bottom";
  readonly spaceBefore: number;
  readonly spaceAfter: number;
  readonly indent: number;
  readonly padding: number;
};

export type CellScene = {
  readonly id: string;
  readonly text?: TextScene;
  readonly row: number;
  readonly column: number;
  readonly rowSpan: number;
  readonly columnSpan: number;
  readonly fill?: string;
  readonly border?: { readonly color: string; readonly width: number; readonly style: string };
  readonly header: boolean;
};

export type Item = {
  readonly id: string;
  readonly type: ElementType;
  readonly frame: Frame;
  readonly rotation: number;
  readonly depth: number;
  readonly parents: readonly string[];
  readonly locked: boolean;
  readonly fixed: boolean;
  readonly overflow: "clip" | "shrink" | "grow";
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth: number;
  readonly dash: Dash;
  readonly opacity: number;
  readonly radius: number;
  readonly shadow?: string;
  readonly shape?: ShapeKind;
  readonly text?: TextScene;
  readonly line?: { from: Point; to: Point; start: LineEnd; end: LineEnd };
  readonly image?: { src?: string; alt: string };
  readonly table?: {
    rows: readonly (readonly CellScene[])[];
    columns: number;
    headerRows: number;
    columnWidths?: readonly number[];
    rowHeights?: readonly number[];
  };
  readonly children: number;
};

export type Scene = {
  readonly ratio: AspectRatio;
  readonly units: Size;
  readonly background: string;
  readonly items: readonly Item[];
};

export const colorOf = (value: string | undefined, fallback: string): string => {
  const wanted = value === undefined || value === "" ? fallback : value;
  return wanted.startsWith("--") ? `var(${wanted})` : wanted;
};

type TextSceneBlock = TextBlock | FormulaBlock | PromptBlock;

export const runsOf = (block: TextSceneBlock): Run[] => {
  if (block.type === "formula") {
    return [{
      text: block.display,
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      code: false,
      formula: true
    }];
  }
  const cuts = new Set<number>([0, block.display.length]);
  const marks = block.marks.map((mark) => ({ mark, ...rangeOf(block.atoms, mark) }));
  for (const mark of marks) {
    cuts.add(Math.max(0, mark.from));
    cuts.add(Math.min(block.display.length, mark.to));
  }
  let offset = 0;
  const formulaRanges: [number, number][] = [];
  for (const atom of block.atoms) {
    const length = atom.kind === "literal" ? atom.text.length : atom.lastResolvedDisplay.length;
    if (atom.kind === "formula") {
      formulaRanges.push([offset, offset + length]);
      cuts.add(offset);
      cuts.add(offset + length);
    }
    offset += length;
  }
  const edges = [...cuts].sort((a, b) => a - b);
  const runs: Run[] = [];
  for (let index = 0; index < edges.length - 1; index += 1) {
    const from = edges[index];
    const to = edges[index + 1];
    if (to <= from) continue;
    const active = marks.filter((mark) => mark.from <= from && mark.to >= to);
    const styles = new Set(active.flatMap(({ mark }) => mark.style ?? []));
    runs.push({
      text: block.display.slice(from, to),
      bold: styles.has("bold"),
      italic: styles.has("italic"),
      underline: styles.has("underline"),
      strike: styles.has("strikethrough"),
      code: styles.has("code"),
      color: active.find(({ mark }) => mark.color !== undefined)?.mark.color,
      formula: formulaRanges.some(([start, end]) => start <= from && end >= to)
    });
  }
  if (runs.length === 0) {
    runs.push({ text: "", bold: false, italic: false, underline: false, strike: false, code: false, formula: false });
  }
  return runs;
};

export const textSceneOf = (
  block: TextSceneBlock,
  style: TextStyle | undefined,
  theme: DeckTheme,
  centred = false
): TextScene => ({
  blockId: block.id,
  display: block.display,
  runs: runsOf(block),
  font: block.format?.fontFamily ?? style?.fontFamily ?? theme.fontFamily ?? "IBM Plex Sans",
  size: block.format?.fontSize ?? style?.fontSize ?? 20,
  weight: style?.fontWeight ?? (style?.bold ? 700 : 400),
  italic: style?.italic ?? false,
  underline: style?.underline ?? false,
  strike: style?.strikethrough ?? false,
  color: colorOf(block.format?.color ?? style?.color ?? theme.colors.text, "var(--token-ink-primary)"),
  background:
    block.format?.background === undefined && style?.background === undefined
      ? undefined
      : colorOf(block.format?.background ?? style?.background, "transparent"),
  lineHeight: block.format?.lineHeight ?? style?.lineHeight ?? 1.3,
  align: block.format?.horizontalAlignment ?? style?.horizontalAlignment ?? (centred ? "center" : "start"),
  valign: block.format?.verticalAlignment ?? style?.verticalAlignment ?? (centred ? "middle" : "top"),
  spaceBefore: block.format?.spaceBefore ?? style?.spaceBefore ?? 0,
  spaceAfter: block.format?.spaceAfter ?? style?.spaceAfter ?? 0,
  indent: block.format?.indent ?? style?.indent ?? 0,
  padding: block.format?.padding?.x ?? 12
});

const cellSceneOf = (body: SlideDeckBody, placed: GridCell, header: boolean): CellScene => {
  const cell: TableCell = placed.cell;
  const block = cell.blocks.find((held): held is TextBlock => held.type === "text");
  return {
    id: cell.id,
    text: block === undefined ? undefined : textSceneOf(block, styleOf(body, block), body.theme),
    row: placed.row,
    column: placed.column,
    rowSpan: placed.rowSpan,
    columnSpan: placed.columnSpan,
    fill: cell.format?.background === undefined ? undefined : colorOf(cell.format.background, "transparent"),
    border:
      cell.format?.border === undefined
        ? undefined
        : { color: colorOf(cell.format.border.color, "var(--token-border-strong)"), width: cell.format.border.width, style: cell.format.border.style },
    header
  };
};

const shadowOf = (paint: SlideElement["paint"]): string | undefined =>
  paint?.shadow === undefined
    ? undefined
    : `${paint.shadow.x}px ${paint.shadow.y}px ${paint.shadow.blur}px ${colorOf(paint.shadow.color, "--token-shadow-cast")}`;

const itemOf = (body: SlideDeckBody, element: SlideElement, frame: Frame, depth: number, parents: readonly string[]): Item => {
  const paint = element.paint;
  const base = {
    id: element.id,
    type: element.content.type,
    frame,
    rotation: element.rotation ?? 0,
    depth,
    parents,
    locked: element.locked ?? false,
    fixed: false,
    overflow: element.overflow ?? "clip",
    fill: paint?.fill === undefined ? undefined : colorOf(paint.fill, "transparent"),
    stroke: paint?.stroke === undefined ? undefined : colorOf(paint.stroke.color, "var(--token-border-strong)"),
    strokeWidth: paint?.stroke?.width ?? 0,
    dash: paint?.stroke?.dash ?? "solid",
    opacity: paint?.opacity ?? 1,
    radius: paint?.cornerRadius ?? 0,
    shadow: shadowOf(paint),
    children: 0
  } satisfies Partial<Item> & { id: string };

  switch (element.content.type) {
    case "text":
      return { ...base, text: textSceneOf(element.content.block, styleOf(body, element.content.block), body.theme) };
    case "formula":
      return { ...base, text: textSceneOf(element.content.block, undefined, body.theme) };
    case "prompt":
      return {
        ...base,
        text: textSceneOf(
          element.content.block,
          styleOf(body, element.content.block),
          body.theme
        )
      };
    case "shape":
      return {
        ...base,
        shape: element.content.shape,
        text: element.content.block === undefined ? undefined : textSceneOf(element.content.block, styleOf(body, element.content.block), body.theme, true)
      };
    case "line":
      return {
        ...base,
        line: {
          from: element.content.from,
          to: element.content.to,
          start: element.content.ends?.start ?? "none",
          end: element.content.ends?.end ?? "none"
        }
      };
    case "image":
      return {
        ...base,
        image: {
          src: element.content.block.source?.kind === "url" ? element.content.block.source.url : undefined,
          alt: element.content.block.alt
        }
      };
    case "table": {
      const table = element.content.block;
      const grid = gridOf(table);
      return {
        ...base,
        table: {
          headerRows: table.headerRows,
          columns: columnsOf(grid),
          columnWidths: table.columnWidths,
          rowHeights: element.content.rowHeights,
          rows: table.rows.map((row, index) =>
            grid.filter((placed) => placed.rowId === row.id).map((placed) => cellSceneOf(body, placed, index < table.headerRows))
          )
        }
      };
    }
    case "chart":
      return base;
    case "group":
      return { ...base, children: element.content.children.length };
  }
};

const colourOfBackground = (background: SlideBackground | undefined): string | undefined =>
  background?.kind === "color" ? background.color : undefined;

export const sceneOf = (body: SlideDeckBody, slide: Slide | undefined, units: Size): Scene => {
  const layout = slide?.layoutKey === undefined ? undefined : body.layouts.find((held) => held.key === slide.layoutKey);
  const fixed =
    layout === undefined
      ? []
      : placedOn({ id: layout.id, elements: layout.locked, notes: [] }).map(({ element, frame, depth, parents }) => ({
          ...itemOf(body, element, frame, depth, parents),
          locked: true,
          fixed: true
        }));
  const own =
    slide === undefined
      ? []
      : placedOn(slide).map(({ element, frame, depth, parents }) => itemOf(body, element, frame, depth, parents));

  return {
    ratio: body.aspectRatio,
    units,
    background: colorOf(
      colourOfBackground(slide?.background) ?? colourOfBackground(layout?.background) ?? colourOfBackground(body.theme.background),
      "var(--token-surface-elevated)"
    ),
    items: [...fixed, ...own]
  };
};
