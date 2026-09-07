import type {
  Atom,
  Mark,
  MarkStyle,
  PromptBlock,
  TextBlock
} from "$representation/data/types/content/content-block";
import { displayOfAtom, endAt, rangeOf } from "$representation/data/behavior/content/positions";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import { mint } from "$app-views/categories/slide-deck-editor/procedures/ids";

type EditableTextBlock = TextBlock | PromptBlock;

const lengthOf = (atom: Atom): number => displayOfAtom(atom).length;

export const replaced = (block: EditableTextBlock, from: number, to: number, insert: string): SlideDeckOp[] => {
  const start = Math.min(from, to);
  const end = Math.max(from, to);

  if (block.atoms.length === 0) {
    const atom: Atom = { id: mint("atom"), kind: "literal", text: insert };
    return [{ op: "insert", target: "atom", path: `${block.id}/atoms`, ids: [atom.id], after: null, values: [atom] }];
  }

  let offset = 0;
  const spans = block.atoms.map((atom) => {
    const atomStart = offset;
    offset += lengthOf(atom);
    return { atom, start: atomStart, end: offset };
  });
  const literals = spans.filter((span) => span.atom.kind === "literal");
  const textOp = (atomId: string, at: number, text: string, remove: string): SlideDeckOp => ({
    op: "text",
    target: "atom",
    path: `${block.id}/atoms/${atomId}`,
    at,
    insert: text,
    remove
  });

  if (start === end) {
    if (insert.length === 0) return [];
    const host =
      literals.find((span) => span.start < start && start <= span.end) ??
      literals.find((span) => span.start <= start && start < span.end) ??
      literals.at(-1);
    if (host === undefined) {
      const atom: Atom = { id: mint("atom"), kind: "literal", text: insert };
      return [{ op: "insert", target: "atom", path: `${block.id}/atoms`, ids: [atom.id], after: spans.at(-1)?.atom.id ?? null, values: [atom] }];
    }
    return [textOp(host.atom.id, Math.min(Math.max(start - host.start, 0), host.end - host.start), insert, "")];
  }

  const ops: SlideDeckOp[] = [];
  let pending = insert;
  for (const span of spans) {
    if (span.end <= start || span.start >= end) continue;
    if (span.atom.kind !== "literal") {
      if (start <= span.start && end >= span.end) {
        ops.push({ op: "remove", target: "atom", path: `${block.id}/atoms`, ids: [span.atom.id], after: null, values: [span.atom] });
      }
      continue;
    }
    const localFrom = Math.max(start, span.start) - span.start;
    const localTo = Math.min(end, span.end) - span.start;
    ops.push(textOp(span.atom.id, localFrom, pending, span.atom.text.slice(localFrom, localTo)));
    pending = "";
  }
  return ops;
};

export const diffed = (block: EditableTextBlock, next: string): SlideDeckOp[] => {
  const was = block.display;
  if (was === next) return [];
  const shortest = Math.min(was.length, next.length);
  let head = 0;
  while (head < shortest && was[head] === next[head]) head += 1;
  let tail = 0;
  while (tail < shortest - head && was[was.length - 1 - tail] === next[next.length - 1 - tail]) tail += 1;
  return replaced(block, head, was.length - tail, next.slice(head, next.length - tail));
};

const covering = (block: EditableTextBlock, style: MarkStyle, from: number, to: number): boolean => {
  const spans = block.marks
    .filter((mark) => mark.style?.includes(style))
    .map((mark) => {
      const range = rangeOf(block.atoms, mark);
      return [range.from, range.to] as const;
    })
    .sort((a, b) => a[0] - b[0]);
  let cursor = from;
  for (const [start, end] of spans) {
    if (start > cursor) break;
    cursor = Math.max(cursor, end);
    if (cursor >= to) return true;
  }
  return cursor >= to;
};

export const stylesAt = (block: EditableTextBlock, from: number, to: number): MarkStyle[] => {
  const styles: MarkStyle[] = ["bold", "italic", "underline", "strikethrough", "code"];
  if (from === to) {
    return styles.filter((style) =>
      block.marks.some((mark) => {
        const range = rangeOf(block.atoms, mark);
        return mark.style?.includes(style) && range.from < from && from <= range.to;
      })
    );
  }
  return styles.filter((style) => covering(block, style, Math.min(from, to), Math.max(from, to)));
};

export const colorAt = (block: EditableTextBlock, from: number, to: number): string | undefined =>
  block.marks.find((mark) => {
    const range = rangeOf(block.atoms, mark);
    return mark.color !== undefined && range.from <= Math.min(from, to) && range.to >= Math.max(from, to);
  })?.color;

const pieces = (block: EditableTextBlock, mark: Mark, from: number, to: number): Mark[] => {
  const range = rangeOf(block.atoms, mark);
  const kept: Mark[] = [];
  if (range.from < from) {
    kept.push({ ...mark, id: mint("atom"), to: endAt(block.atoms, from, "to") });
  }
  if (range.to > to) {
    kept.push({ ...mark, id: mint("atom"), from: endAt(block.atoms, to, "from") });
  }
  return kept;
};

export const toggledMark = (block: EditableTextBlock, from: number, to: number, style: MarkStyle): SlideDeckOp[] => {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  if (start === end) return [];
  const path = `${block.id}/marks`;

  if (!covering(block, style, start, end)) {
    const mark: Mark = {
      id: mint("atom"),
      from: endAt(block.atoms, start, "from"),
      to: endAt(block.atoms, end, "to"),
      style: [style]
    };
    return [{ op: "insert", target: "mark", path, ids: [mark.id], after: block.marks.at(-1)?.id ?? null, values: [mark] }];
  }

  const ops: SlideDeckOp[] = [];
  for (const mark of block.marks) {
    const range = rangeOf(block.atoms, mark);
    if (!mark.style?.includes(style) || range.to <= start || range.from >= end) continue;
    ops.push({ op: "remove", target: "mark", path, ids: [mark.id], after: null, values: [mark] });
    const others = mark.style.filter((held) => held !== style);
    const rest: Mark[] = [
      ...pieces(block, mark, start, end),
      ...(others.length > 0 || mark.color || mark.background || mark.link
        ? [{
            ...mark,
            id: mint("atom"),
            from: endAt(block.atoms, Math.max(range.from, start), "from"),
            to: endAt(block.atoms, Math.min(range.to, end), "to"),
            style: others.length > 0 ? others : undefined
          }]
        : [])
    ];
    if (rest.length > 0) {
      ops.push({ op: "insert", target: "mark", path, ids: rest.map((held) => held.id), after: null, values: rest });
    }
  }
  return ops;
};

export const colouredMark = (block: EditableTextBlock, from: number, to: number, color: string | undefined): SlideDeckOp[] => {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  if (start === end) return [];
  const path = `${block.id}/marks`;
  const ops: SlideDeckOp[] = [];
  for (const mark of block.marks) {
    const range = rangeOf(block.atoms, mark);
    if (mark.color === undefined || range.to <= start || range.from >= end) continue;
    ops.push({ op: "remove", target: "mark", path, ids: [mark.id], after: null, values: [mark] });
    const { color: _color, ...withoutColor } = mark;
    const rest: Mark[] = [
      ...pieces(block, mark, start, end),
      ...(mark.style || mark.link || mark.background
        ? [{
            ...withoutColor,
            id: mint("atom"),
            from: endAt(block.atoms, Math.max(range.from, start), "from"),
            to: endAt(block.atoms, Math.min(range.to, end), "to")
          }]
        : [])
    ];
    if (rest.length > 0) ops.push({ op: "insert", target: "mark", path, ids: rest.map((held) => held.id), after: null, values: rest });
  }
  if (color !== undefined) {
    const mark: Mark = {
      id: mint("atom"),
      from: endAt(block.atoms, start, "from"),
      to: endAt(block.atoms, end, "to"),
      color
    };
    ops.push({ op: "insert", target: "mark", path, ids: [mark.id], after: null, values: [mark] });
  }
  return ops;
};
