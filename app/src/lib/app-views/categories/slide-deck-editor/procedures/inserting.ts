import type {
  Frame,
  Point,
  ShapeKind,
  SlideDeckBody,
  SlideElement
} from "$representation/data/types/slide-decks/body";
import {
  emptyText,
  withInsertedElements,
  type Edit
} from "$app-views/categories/slide-deck-editor/procedures/deck";
import { mint } from "$app-views/categories/slide-deck-editor/procedures/ids";

export type InsertKind =
  | "text"
  | "rectangle"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "arrow"
  | "callout"
  | "line"
  | "image"
  | "table"
  | "chart";

export type PlacedKind = Exclude<InsertKind, "chart">;

export type InsertEntry = {
  readonly kind: InsertKind;
  readonly label: string;
  readonly note: string;
  readonly ready: boolean;
};

export type InsertGroup = {
  readonly title: string;
  readonly nested: boolean;
  readonly entries: readonly InsertEntry[];
};

export const INSERT_GROUPS: readonly InsertGroup[] = [
  {
    title: "Text",
    nested: false,
    entries: [{ kind: "text", label: "Text box", note: "", ready: true }]
  },
  {
    title: "Shapes",
    nested: true,
    entries: [
      { kind: "rectangle", label: "Rectangle", note: "", ready: true },
      { kind: "ellipse", label: "Ellipse", note: "", ready: true },
      { kind: "triangle", label: "Triangle", note: "", ready: true },
      { kind: "diamond", label: "Diamond", note: "", ready: true },
      { kind: "arrow", label: "Arrow", note: "", ready: true },
      { kind: "callout", label: "Callout", note: "", ready: true }
    ]
  },
  {
    title: "Lines",
    nested: false,
    entries: [{ kind: "line", label: "Line", note: "", ready: true }]
  },
  {
    title: "Content",
    nested: false,
    entries: [
      { kind: "image", label: "Picture", note: "", ready: true },
      { kind: "table", label: "Table", note: "", ready: true },
      { kind: "chart", label: "Chart", note: "Arrives with the analysis chart", ready: false }
    ]
  }
];

export const INSERT_ENTRIES: readonly InsertEntry[] = INSERT_GROUPS.flatMap((group) => group.entries);

const SHAPES: readonly string[] = ["rectangle", "ellipse", "triangle", "diamond", "arrow", "callout"];

const isShape = (kind: PlacedKind): kind is ShapeKind => SHAPES.includes(kind);

const SIZE: Record<InsertKind, { readonly width: number; readonly height: number }> = {
  text: { width: 0.44, height: 0.1 },
  rectangle: { width: 0.26, height: 0.22 },
  ellipse: { width: 0.24, height: 0.24 },
  triangle: { width: 0.24, height: 0.22 },
  diamond: { width: 0.24, height: 0.24 },
  arrow: { width: 0.3, height: 0.16 },
  callout: { width: 0.3, height: 0.2 },
  line: { width: 0.24, height: 0.16 },
  image: { width: 0.32, height: 0.24 },
  table: { width: 0.52, height: 0.28 },
  chart: { width: 0.44, height: 0.3 }
};

const EDGE = 0.02;

export const frameFor = (kind: InsertKind, at?: Point): Frame => {
  const { width, height } = SIZE[kind];
  const centre = at ?? { x: 0.5, y: 0.5 };
  const place = (middle: number, span: number) =>
    Math.min(Math.max(middle - span / 2, EDGE), Math.max(EDGE, 1 - EDGE - span));

  return { x: place(centre.x, width), y: place(centre.y, height), width, height };
};

export const makeElement = (kind: PlacedKind, body: SlideDeckBody, frame: Frame): SlideElement => {
  const id = mint("element");

  if (isShape(kind)) {
    return {
      id,
      frame,
      paint: { fill: body.theme.colors.accent },
      content: {
        type: "shape",
        shape: kind,
        block: emptyText(body.styles.defaultKey, "")
      }
    };
  }

  switch (kind) {
    case "text":
      return {
        id,
        frame,
        overflow: "grow",
        content: { type: "text", block: emptyText(body.styles.defaultKey, "Text") }
      };

    case "line":
      return {
        id,
        frame,
        paint: { stroke: { color: body.theme.colors.text, width: 3, dash: "solid" } },
        content: {
          type: "line",
          from: { x: frame.x, y: frame.y + frame.height },
          to: { x: frame.x + frame.width, y: frame.y },
          ends: { end: "arrow" }
        }
      };

    case "image":
      return {
        id,
        frame,
        content: { type: "image", block: { id: mint("block"), type: "image", alt: "" } }
      };

    case "table": {
      const cell = () => ({ id: mint("block"), blocks: [emptyText("caption", "")] });
      return {
        id,
        frame,
        paint: { stroke: { color: "--token-border-strong", width: 1, dash: "solid" } },
        content: {
          type: "table",
          block: {
            id: mint("block"),
            type: "table",
            headerRows: 1,
            rows: [0, 1, 2].map(() => ({ id: mint("block"), cells: [cell(), cell(), cell()] }))
          }
        }
      };
    }
  }
};

export const insertedElement = (
  kind: PlacedKind,
  body: SlideDeckBody,
  slideId: string,
  at?: Point
): { readonly element: SlideElement; readonly edit: Edit } => {
  const element = makeElement(kind, body, frameFor(kind, at));
  return { element, edit: withInsertedElements(body, slideId, [element]) };
};
