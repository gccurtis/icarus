import {
  canonicalAnchorWithin,
  textAnchorSpans
} from "$representation/data/behavior/collaboration/anchors";
import type {
  AnchorWithin,
  StoredAnchorWithin,
  TextAnchorSpan
} from "$representation/data/types/collaboration/anchor";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";

const shiftedFrom = (
  end: TextAnchorSpan["from"],
  op: Extract<DocumentOp, { op: "text" }>,
  atom: string
): TextAnchorSpan["from"] => {
  if (end.atom !== atom || end.offset < op.at) return end;
  const beyond = op.at + op.remove.length;
  if (end.offset >= beyond) {
    return { ...end, offset: end.offset + op.insert.length - op.remove.length };
  }
  return { ...end, offset: op.at + op.insert.length };
};

const shiftedTo = (
  end: TextAnchorSpan["to"],
  op: Extract<DocumentOp, { op: "text" }>,
  atom: string
): TextAnchorSpan["to"] => {
  if (end.atom !== atom || end.offset <= op.at) return end;
  const beyond = op.at + op.remove.length;
  if (end.offset >= beyond) {
    return { ...end, offset: end.offset + op.insert.length - op.remove.length };
  }
  return { ...end, offset: op.at };
};

const projectedRows = (body: DocumentBody): readonly DocumentRow[] => [
  ...(body.header?.rows ?? []),
  ...(body.header?.firstPageRows ?? []),
  ...body.rows,
  ...(body.footer?.rows ?? []),
  ...(body.footer?.firstPageRows ?? [])
];

const liveAtoms = (body: DocumentBody): ReadonlyMap<string, ReadonlySet<string>> => {
  const blocks = new Map<string, ReadonlySet<string>>();
  for (const row of projectedRows(body)) {
    if (row.kind !== "blocks") continue;
    for (const block of row.blocks) {
      if (block.type !== "text" && block.type !== "prompt") continue;
      blocks.set(block.id, new Set(block.atoms.map((atom) => atom.id)));
    }
  }
  return blocks;
};

/** Moves structural comment anchors through one accepted document change set. */
export const transformCommentAnchor = (
  within: StoredAnchorWithin | undefined,
  ops: readonly DocumentOp[],
  after: DocumentBody
): AnchorWithin | undefined => {
  if (within === undefined || within.kind !== "text") return canonicalAnchorWithin(within);

  let spans = [...textAnchorSpans(within)];
  for (const op of ops) {
    if (op.op !== "text") continue;
    const [blockId, field, atom] = op.path.split("/");
    if (field !== "atoms" || atom === undefined) continue;

    spans = spans.map((span) => {
      if (span.blockId !== blockId) return span;
      const from = shiftedFrom(span.from, op, atom);
      const to = shiftedTo(span.to, op, atom);
      return from.atom === to.atom && from.offset > to.offset
        ? { ...span, from, to: from }
        : { ...span, from, to };
    });
  }

  const live = liveAtoms(after);
  spans = spans.filter((span) => {
    const atoms = live.get(span.blockId);
    return atoms?.has(span.from.atom) === true && atoms.has(span.to.atom);
  });

  return { kind: "text", spans };
};
