import type {
  Mark as ProseMirrorMark,
  Node as ProseMirrorNode
} from "prosemirror-model";

import type {
  Atom,
  Mark,
  MarkLink,
  MarkStyle
} from "$representation/data/types/content/content-block";
import { mint } from "$app-views/categories/document-editor/procedures/ids";
import { schema } from "$app-views/categories/document-editor/procedures/schema";
import type { Styled } from "$app-views/categories/document-editor/procedures/styles";
import {
  endAt,
  linearOf,
  segmentsOf
} from "$app-views/categories/document-editor/procedures/projection-atoms";

const STYLE_MARK: Record<MarkStyle, string> = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strikethrough: "strike",
  code: "code"
};

const MARK_STYLE: Record<string, MarkStyle> = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strike: "strikethrough",
  code: "code"
};

const STYLE_ORDER: readonly MarkStyle[] = ["bold", "italic", "underline", "strikethrough", "code"];

export const sortedStyles = (styles: readonly MarkStyle[]): MarkStyle[] =>
  [...new Set(styles)].sort((a, b) => STYLE_ORDER.indexOf(a) - STYLE_ORDER.indexOf(b));

const proseMarksOf = (mark: Mark): ProseMirrorMark[] => {
  const marks: ProseMirrorMark[] = [];

  for (const style of mark.style ?? []) {
    marks.push(schema.marks[STYLE_MARK[style]].create({ markId: mark.id }));
  }
  if (mark.link !== undefined) {
    marks.push(schema.marks.link.create({ markId: mark.id, link: mark.link }));
  }
  if (mark.color !== undefined || mark.background !== undefined) {
    marks.push(
      schema.marks.colour.create({
        markId: mark.id,
        color: mark.color ?? null,
        background: mark.background ?? null
      })
    );
  }

  return marks;
};

type Span = {
  readonly from: number;
  readonly to: number;
  readonly marks: readonly ProseMirrorMark[];
};

const formulaNode = (atom: Extract<Atom, { kind: "formula" }>, marks: readonly ProseMirrorMark[]) =>
  schema.node(
    "formula_atom",
    {
      atomId: atom.id,
      expression: atom.expression,
      resolved: atom.lastResolvedDisplay,
      state: atom.state,
      formulaId: atom.formulaId ?? null,
      value: atom.lastResolvedValue
    },
    undefined,
    [...marks]
  );

const templateNode = (atom: Extract<Atom, { kind: "template" }>, marks: readonly ProseMirrorMark[]) =>
  schema.node("template_atom", { atomId: atom.id, name: atom.name }, undefined, [...marks]);

export const inlineOf = (block: Styled): ProseMirrorNode[] => {
  const segments = segmentsOf(block.atoms);
  const spans: Span[] = block.marks
    .map((mark) => ({
      from: linearOf(block.atoms, mark.from),
      to: linearOf(block.atoms, mark.to),
      marks: proseMarksOf(mark)
    }))
    .filter((span) => span.from < span.to && span.marks.length > 0);

  const covering = (a: number, b: number): ProseMirrorMark[] =>
    spans.filter((span) => span.from <= a && span.to >= b).flatMap((span) => [...span.marks]);

  const nodes: ProseMirrorNode[] = [];
  for (const segment of segments) {
    if (segment.atom.kind === "formula") {
      nodes.push(formulaNode(segment.atom, covering(segment.start, segment.end)));
      continue;
    }
    if (segment.atom.kind === "template") {
      nodes.push(templateNode(segment.atom, covering(segment.start, segment.end)));
      continue;
    }

    const cuts = new Set<number>([segment.start, segment.end]);
    for (const span of spans) {
      if (span.from > segment.start && span.from < segment.end) cuts.add(span.from);
      if (span.to > segment.start && span.to < segment.end) cuts.add(span.to);
    }

    const points = [...cuts].sort((a, b) => a - b);
    for (let index = 0; index < points.length - 1; index += 1) {
      const a = points[index];
      const b = points[index + 1];
      const text = segment.atom.text.slice(a - segment.start, b - segment.start);
      if (text.length > 0) nodes.push(schema.text(text, covering(a, b)));
    }
  }

  return nodes;
};

/** What one inline child stands for in the body's own text, atoms included. */
export const displayTextOf = (node: ProseMirrorNode): string => {
  let text = "";
  node.forEach((child) => {
    text += displayOfChild(child);
  });
  return text;
};

export const displayOfChild = (child: ProseMirrorNode): string =>
  child.type.name === "formula_atom"
    ? String(child.attrs.resolved)
    : child.type.name === "template_atom"
      ? `{${String(child.attrs.name)}}`
      : (child.text ?? "");

type Gathered = {
  ranges: Map<string, { from: number; to: number }>;
  link?: MarkLink;
  color?: string;
  background?: string;
  first: number;
};

const gather = (node: ProseMirrorNode): Map<string, Gathered> => {
  const held = new Map<string, Gathered>();
  let at = 0;

  node.forEach((child) => {
    const length = displayOfChild(child).length;
    const from = at;
    const to = at + length;
    at = to;

    for (const mark of child.marks) {
      const id = mark.attrs.markId as string | null;
      if (id === null) continue;

      const entry: Gathered = held.get(id) ?? { ranges: new Map(), first: from };
      const range = entry.ranges.get(mark.type.name) ?? { from, to };
      range.from = Math.min(range.from, from);
      range.to = Math.max(range.to, to);
      entry.ranges.set(mark.type.name, range);

      if (mark.type.name === "link") entry.link = mark.attrs.link as MarkLink;
      if (mark.type.name === "colour") {
        if (mark.attrs.color !== null) entry.color = mark.attrs.color as string;
        if (mark.attrs.background !== null) entry.background = mark.attrs.background as string;
      }
      held.set(id, entry);
    }
  });

  return held;
};

const strip = <T extends object>(held: T): T =>
  Object.fromEntries(Object.entries(held).filter(([, value]) => value !== undefined)) as T;

const markFrom = (
  id: string,
  types: readonly string[],
  range: { from: number; to: number },
  entry: Gathered,
  atoms: readonly Atom[]
): Mark => {
  const styles = sortedStyles(types.filter((type) => type in MARK_STYLE).map((type) => MARK_STYLE[type]));
  const carriesLink = types.includes("link");
  const carriesColour = types.includes("colour");

  return strip({
    id,
    from: endAt(atoms, range.from, "from"),
    to: endAt(atoms, range.to, "to"),
    style: styles.length > 0 ? styles : undefined,
    link: carriesLink ? entry.link : undefined,
    color: carriesColour ? entry.color : undefined,
    background: carriesColour ? entry.background : undefined
  });
};

export const marksOf = (node: ProseMirrorNode, atoms: readonly Atom[]): Mark[] => {
  const marks: Mark[] = [];
  const gathered = [...gather(node).entries()].sort((a, b) => a[1].first - b[1].first);

  for (const [id, entry] of gathered) {
    const groups = new Map<string, string[]>();
    for (const [type, range] of entry.ranges) {
      const key = `${range.from}:${range.to}`;
      groups.set(key, [...(groups.get(key) ?? []), type]);
    }

    let index = 0;
    for (const [key, types] of groups) {
      const [from, to] = key.split(":").map(Number);
      marks.push(markFrom(index === 0 ? id : mint("mark"), types, { from, to }, entry, atoms));
      index += 1;
    }
  }

  return marks;
};
