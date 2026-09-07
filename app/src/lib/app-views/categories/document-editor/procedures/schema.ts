import { Schema, type MarkSpec, type NodeSpec } from "prosemirror-model";

import { safeLinkHref } from "$app-views/categories/document-editor/procedures/links";
import type { MarkLink } from "$representation/data/types/content/content-block";

const HEADING_LEVELS = 4;

const elementOf = (variant: unknown, level: unknown): string => {
  if (variant === "heading") {
    const depth = typeof level === "number" ? Math.min(Math.max(level, 1), HEADING_LEVELS) : 1;
    return `h${depth}`;
  }
  if (variant === "quote") return "blockquote";
  if (variant === "code") return "pre";
  return "p";
};

const textBlockSpec: NodeSpec = {
  group: "block",
  selectable: false,
  content: "inline*",
  attrs: {
    blockId: { default: null },
    kind: { default: "text" },
    variant: { default: "paragraph" },
    level: { default: null },
    listStyle: { default: null },
    checked: { default: null },
    language: { default: null },
    styleKey: { default: null },
    format: { default: null },
    atomIds: { default: [] },
    presentation: { default: "" },
    fontSize: { default: 16 },
    lineHeight: { default: 26 },
    spaceBefore: { default: 0 },
    spaceAfter: { default: 0 },
    share: { default: 1 }
  },
  toDOM: (node) => [
    elementOf(node.attrs.variant, node.attrs.level),
    {
      class: `document-block document-${node.attrs.variant}`,
      "data-block": node.attrs.blockId,
      "data-kind": node.attrs.kind,
      "data-style": node.attrs.styleKey ?? "",
      "data-list": node.attrs.listStyle ?? undefined,
      style: `flex-basis: ${node.attrs.share * 100}%; ${node.attrs.presentation}`
    },
    0
  ]
};

const unboundFormula = (name: string, block: unknown): boolean =>
  name === "formula" && ((block ?? {}) as Record<string, unknown>).formulaId === undefined;

const atomBlockSpec = (name: string): NodeSpec => ({
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  attrs: { blockId: { default: null }, share: { default: 1 }, block: { default: null } },
  toDOM: (node) => [
    "div",
    {
      class: `document-block document-${name}${unboundFormula(name, node.attrs.block) ? " document-formula-unbound" : ""}`,
      "data-block": node.attrs.blockId,
      style: `flex-basis: ${node.attrs.share * 100}%`
    },
    ["span", { class: "document-atom-block-label" }, labelOf(name, node.attrs.block)]
  ]
});

const labelOf = (name: string, block: unknown): string => {
  const held = (block ?? {}) as Record<string, unknown>;
  if (name === "image") return typeof held.alt === "string" && held.alt.length > 0 ? held.alt : "Image";
  if (name === "table") {
    const rows = Array.isArray(held.rows) ? held.rows.length : 0;
    return `Table · ${rows} row${rows === 1 ? "" : "s"}`;
  }
  if (name === "formula") return typeof held.display === "string" ? held.display : "Formula";
  return name;
};

const styleMark = (name: string, tag: string): MarkSpec => ({
  attrs: { markId: { default: null } },
  excludes: "",
  toDOM: (mark) => [tag, { class: `document-mark document-${name}`, "data-mark": mark.attrs.markId }, 0]
});

export const schema = new Schema({
  nodes: {
    doc: { content: "page+" },

    page: {
      content: "row+",
      toDOM: () => ["article", { class: "document-page" }, 0]
    },

    blocks_row: {
      group: "row",
      attrs: { rowId: { default: null }, proportions: { default: null } },
      content: "block+",
      toDOM: (node) => ["div", { class: "document-row", "data-row": node.attrs.rowId }, 0]
    },

    divider: {
      group: "row",
      atom: true,
      selectable: true,
      attrs: {
        rowId: { default: null },
        color: { default: null },
        width: { default: null },
        style: { default: null }
      },
      toDOM: (node) => [
        "hr",
        {
          class: "document-divider",
          "data-row": node.attrs.rowId,
          style: [
            node.attrs.color === null ? "" : `border-color: ${node.attrs.color}`,
            node.attrs.width === null ? "" : `border-top-width: ${node.attrs.width}px`,
            node.attrs.style === null ? "" : `border-top-style: ${node.attrs.style}`
          ]
            .filter((rule) => rule.length > 0)
            .join("; ")
        }
      ]
    },

    page_break: {
      group: "row",
      atom: true,
      selectable: true,
      attrs: { rowId: { default: null } },
      toDOM: (node) => [
        "div",
        { class: "document-page-break", "data-row": node.attrs.rowId },
        ["span", {}, "Page break"]
      ]
    },

    text_block: textBlockSpec,
    image_block: atomBlockSpec("image"),
    table_block: atomBlockSpec("table"),
    formula_block: atomBlockSpec("formula"),

    text: { group: "inline" },

    /**
     * A template's own hole, drawn as its name in braces.
     *
     * It is an atom like a formula is: one indivisible thing the caret steps
     * over, because half a parameter name is not a thing anyone means to type.
     */
    template_atom: {
      group: "inline",
      inline: true,
      atom: true,
      selectable: true,
      attrs: {
        atomId: { default: null },
        name: { default: "" }
      },
      toDOM: (node) => [
        "span",
        {
          class: "document-template-atom",
          "data-atom": node.attrs.atomId,
          title: `${node.attrs.name} · filled in when this template is placed`
        },
        `{${node.attrs.name}}`
      ]
    },

    formula_atom: {
      group: "inline",
      inline: true,
      atom: true,
      selectable: true,
      attrs: {
        atomId: { default: null },
        expression: { default: "" },
        resolved: { default: "" },
        state: { default: "fresh" },
        error: { default: null },
        formulaId: { default: null },
        value: { default: null }
      },
      toDOM: (node) => [
        "span",
        {
          class: `document-formula document-formula-${node.attrs.state}${
            node.attrs.formulaId === null ? " document-formula-unbound" : ""
          }`,
          "data-atom": node.attrs.atomId,
          title:
            node.attrs.formulaId === null
              ? `${node.attrs.expression} · not bound to a formula yet`
              : node.attrs.expression
        },
        node.attrs.resolved
      ]
    }
  },

  marks: {
    bold: styleMark("bold", "strong"),
    italic: styleMark("italic", "em"),
    underline: styleMark("underline", "u"),
    strike: styleMark("strike", "s"),
    code: styleMark("code", "code"),

    link: {
      attrs: { markId: { default: null }, link: { default: null } },
      excludes: "",
      inclusive: false,
      toDOM: (mark) => {
        const link = mark.attrs.link as MarkLink | null;
        const href = safeLinkHref(link);
        return [
          "a",
          {
            class: "document-mark document-link",
            "data-mark": mark.attrs.markId,
            href,
            rel: href === undefined ? undefined : "noopener noreferrer"
          },
          0
        ];
      }
    },

    colour: {
      attrs: { markId: { default: null }, color: { default: null }, background: { default: null } },
      excludes: "",
      toDOM: (mark) => [
        "span",
        {
          class: "document-mark document-colour",
          "data-mark": mark.attrs.markId,
          style: [
            mark.attrs.color === null ? "" : `color: ${mark.attrs.color}`,
            mark.attrs.background === null ? "" : `background-color: ${mark.attrs.background}`
          ]
            .filter((rule) => rule.length > 0)
            .join("; ")
        },
        0
      ]
    }
  }
});
