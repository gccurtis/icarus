import type { Paint } from "$app-views/categories/spreadsheet-editor/procedures/formatting";
import type { ValueKind } from "$app-views/categories/spreadsheet-editor/procedures/values";

export type Align = "left" | "center" | "right";

export const alignOf = (paint: Paint, kind: ValueKind): Align => {
  switch (paint.format.horizontalAlignment ?? paint.style.horizontalAlignment) {
    case "start":
    case "justify":
      return "left";
    case "center":
      return "center";
    case "end":
      return "right";
    default:
      return kind === "number" || kind === "date"
        ? "right"
        : kind === "logic"
          ? "center"
          : "left";
  }
};

export type Valign = "top" | "middle" | "bottom";

export const valignOf = (paint: Paint): Valign => paint.format.verticalAlignment ?? "middle";
