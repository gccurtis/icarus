import type { Atom, Mark, MarkStyle, TextBlock } from "$representation/data/types/content/content-block";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import { mint } from "$app-views/categories/slide-deck-editor/procedures/ids";

const lengthOf = (atom: Atom): number =>
  atom.kind === "literal" ? atom.text.length : atom.lastResolvedDisplay.length;

export const replaced = (block: TextBlock, from: number, to: number, insert: string): SlideDeckOp[] => {
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

export const diffed = (block: TextBlock, next: string): SlideDeckOp[] => {
  const was = block.display;
  if (was === next) return [];
  const shortest = Math.min(was.length, next.length);
  let head = 0;
  while (head < shortest && was[head] === next[head]) head += 1;
  let tail = 0;
  while (tail < shortest - head && was[was.length - 1 - tail] === next[next.length - 1 - tail]) tail += 1;
  return replaced(block, head, was.length - tail, next.slice(head, next.length - tail));
};

const covering = (marks: readonly Mark[], style: MarkStyle, from: number, to: number): boolean => {
  const spans = marks
    .filter((mark) => mark.style?.includes(style))
    .map((mark) => [mark.from, mark.to] as const)
    .sort((a, b) => a[0] - b[0]);
  let cursor = from;
  for (const [start, end] of spans) {
    if (start > cursor) break;
    cursor = Math.max(cursor, end);
    if (cursor >= to) return true;
  }
  return cursor >= to;
};

export const stylesAt = (block: TextBlock, from: number, to: number): MarkStyle[] => {
  const styles: MarkStyle[] = ["bold", "italic", "underline", "strikethrough", "code"];
  if (from === to) {
    return styles.filter((style) =>
      block.marks.some((mark) => mark.style?.includes(style) && mark.from < from && from <= mark.to)
    );
  }
  return styles.filter((style) => covering(block.marks, style, Math.min(from, to), Math.max(from, to)));
};

export const colorAt = (block: TextBlock, from: number, to: number): string | undefined =>
  block.marks.find((mark) => mark.color !== undefined && mark.from <= Math.min(from, to) && mark.to >= Math.max(from, to))?.color;

const pieces = (mark: Mark, from: number, to: number): Mark[] => {
  const kept: Mark[] = [];
  if (mark.from < from) kept.push({ ...mark, id: mint("atom"), to: from });
  if (mark.to > to) kept.push({ ...mark, id: mint("atom"), from: to });
  return kept;
};

export const toggledMark = (block: TextBlock, from: number, to: number, style: MarkStyle): SlideDeckOp[] => {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  if (start === end) return [];
  const path = `${block.id}/marks`;

  if (!covering(block.marks, style, start, end)) {
    const mark: Mark = { id: mint("atom"), from: start, to: end, style: [style] };
    return [{ op: "insert", target: "mark", path, ids: [mark.id], after: block.marks.at(-1)?.id ?? null, values: [mark] }];
  }

  const ops: SlideDeckOp[] = [];
  for (const mark of block.marks) {
    if (!mark.style?.includes(style) || mark.to <= start || mark.from >= end) continue;
    ops.push({ op: "remove", target: "mark", path, ids: [mark.id], after: null, values: [mark] });
    const others = mark.style.filter((held) => held !== style);
    const rest: Mark[] = [
      ...pieces(mark, start, end),
      ...(others.length > 0 || mark.color || mark.link
        ? [{ ...mark, id: mint("atom"), from: Math.max(mark.from, start), to: Math.min(mark.to, end), style: others.length > 0 ? others : undefined }]
        : [])
    ];
    if (rest.length > 0) {
      ops.push({ op: "insert", target: "mark", path, ids: rest.map((held) => held.id), after: null, values: rest });
    }
  }
  return ops;
};

export const colouredMark = (block: TextBlock, from: number, to: number, color: string | undefined): SlideDeckOp[] => {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  if (start === end) return [];
  const path = `${block.id}/marks`;
  const ops: SlideDeckOp[] = [];
  for (const mark of block.marks) {
    if (mark.color === undefined || mark.to <= start || mark.from >= end) continue;
    ops.push({ op: "remove", target: "mark", path, ids: [mark.id], after: null, values: [mark] });
    const rest = pieces(mark, start, end);
    if (rest.length > 0) ops.push({ op: "insert", target: "mark", path, ids: rest.map((held) => held.id), after: null, values: rest });
  }
  if (color !== undefined) {
    const mark: Mark = { id: mint("atom"), from: start, to: end, color };
    ops.push({ op: "insert", target: "mark", path, ids: [mark.id], after: null, values: [mark] });
  }
  return ops;
};
