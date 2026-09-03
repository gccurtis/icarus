import type { Atom, ContentBlock } from "$representation/data/types/content/content-block";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";

const refuse = (op: DocumentOp): never => {
  throw new Error(
    `document/submit-document-changes cannot apply ${op.op} on ${op.target} at ${op.path}`
  );
};

const insertAfter = <T extends { id: string }>(
  items: readonly T[],
  after: string | null,
  values: readonly T[]
): T[] => {
  if (after === null) return [...values, ...items];

  const at = items.findIndex((item) => item.id === after);
  if (at === -1) throw new Error(`Nothing with id ${after} to insert after.`);

  return [...items.slice(0, at + 1), ...values, ...items.slice(at + 1)];
};

const withoutIds = <T extends { id: string }>(items: readonly T[], ids: readonly string[]): T[] => {
  const going = new Set(ids);
  const kept = items.filter((item) => !going.has(item.id));
  if (kept.length + going.size !== items.length) {
    throw new Error(`Not every id of ${[...going].join(", ")} is there to remove.`);
  }

  return kept;
};

const mapRow = (
  body: DocumentBody,
  rowId: string,
  change: (row: DocumentRow) => DocumentRow
): DocumentBody => {
  if (!body.rows.some((row) => row.id === rowId)) {
    throw new Error(`No row ${rowId} in the body.`);
  }

  return { ...body, rows: body.rows.map((row) => (row.id === rowId ? change(row) : row)) };
};

const mapBlock = (
  body: DocumentBody,
  blockId: string,
  change: (block: ContentBlock) => ContentBlock
): DocumentBody => {
  const holder = body.rows.find(
    (row) => row.kind === "blocks" && row.blocks.some((block) => block.id === blockId)
  );
  if (holder === undefined) throw new Error(`No block ${blockId} in the body.`);

  return mapRow(body, holder.id, (row) =>
    row.kind === "blocks"
      ? {
          ...row,
          blocks: row.blocks.map((block) => (block.id === blockId ? change(block) : block))
        }
      : row
  );
};

const blocksRow = (row: DocumentRow, path: string): Extract<DocumentRow, { kind: "blocks" }> => {
  if (row.kind !== "blocks") throw new Error(`Row ${row.id} holds no blocks, so ${path} is unreachable.`);
  return row;
};

const displayOf = (atoms: readonly Atom[]): string =>
  atoms.map((atom) => (atom.kind === "literal" ? atom.text : atom.lastResolvedDisplay)).join("");

const spliced = (op: Extract<DocumentOp, { op: "text" }>, atom: Atom): Atom => {
  if (atom.kind !== "literal") throw new Error(`Atom ${atom.id} is not a literal.`);

  const removed = atom.text.slice(op.at, op.at + op.remove.length);
  if (removed !== op.remove) {
    throw new Error(
      `Atom ${atom.id} holds "${removed}" at ${op.at}, not "${op.remove}" — authored against text that has moved.`
    );
  }

  return {
    ...atom,
    text: atom.text.slice(0, op.at) + op.insert + atom.text.slice(op.at + op.remove.length)
  };
};

const applyText = (body: DocumentBody, op: Extract<DocumentOp, { op: "text" }>): DocumentBody => {
  const [blockId, field, atomId] = op.path.split("/");
  if (field !== "atoms" || atomId === undefined) return refuse(op);

  return mapBlock(body, blockId, (block) => {
    if (block.type !== "text") {
      throw new Error(`Block ${blockId} holds no atoms a text op can reach.`);
    }
    if (!block.atoms.some((atom) => atom.id === atomId)) {
      throw new Error(`No atom ${atomId} in block ${blockId}.`);
    }

    const atoms = block.atoms.map((atom) => (atom.id === atomId ? spliced(op, atom) : atom));
    return { ...block, atoms, display: displayOf(atoms) };
  });
};

const applySet = (body: DocumentBody, op: Extract<DocumentOp, { op: "set" }>): DocumentBody => {
  const [id, field, ...rest] = op.path.split("/");
  if (rest.length > 0) return refuse(op);

  if (op.target === "row" && field === "proportions") {
    return mapRow(body, id, (row) => {
      const held = blocksRow(row, op.path);
      if (op.value === null) {
        const { proportions, ...without } = held;
        void proportions;
        return without;
      }

      return { ...held, proportions: op.value as number[] };
    });
  }

  return refuse(op);
};

const applyInsert = (
  body: DocumentBody,
  op: Extract<DocumentOp, { op: "insert" }>
): DocumentBody => {
  if (op.target === "row" && op.path === "rows") {
    return { ...body, rows: insertAfter(body.rows, op.after, op.values as DocumentRow[]) };
  }

  const [rowId, field] = op.path.split("/");
  if (op.target === "block" && field === "blocks") {
    return mapRow(body, rowId, (row) => ({
      ...blocksRow(row, op.path),
      blocks: insertAfter(blocksRow(row, op.path).blocks, op.after, op.values as ContentBlock[])
    }));
  }

  return refuse(op);
};

const applyRemove = (
  body: DocumentBody,
  op: Extract<DocumentOp, { op: "remove" }>
): DocumentBody => {
  if (op.target === "row" && op.path === "rows") {
    return { ...body, rows: withoutIds(body.rows, op.ids) };
  }

  const [rowId, field] = op.path.split("/");
  if (op.target === "block" && field === "blocks") {
    return mapRow(body, rowId, (row) => ({
      ...blocksRow(row, op.path),
      blocks: withoutIds(blocksRow(row, op.path).blocks, op.ids)
    }));
  }

  return refuse(op);
};

const applyMove = (body: DocumentBody, op: Extract<DocumentOp, { op: "move" }>): DocumentBody => {
  if (op.target !== "row" || op.path !== "rows") return refuse(op);

  const moving = body.rows.find((row) => row.id === op.id);
  if (moving === undefined) throw new Error(`No row ${op.id} to move.`);

  return { ...body, rows: insertAfter(withoutIds(body.rows, [op.id]), op.after, [moving]) };
};

const applyOp = (body: DocumentBody, op: DocumentOp): DocumentBody => {
  switch (op.op) {
    case "text":
      return applyText(body, op);
    case "set":
      return applySet(body, op);
    case "insert":
      return applyInsert(body, op);
    case "remove":
      return applyRemove(body, op);
    case "move":
      return applyMove(body, op);
  }
};

export const applyOps = (body: DocumentBody, ops: readonly DocumentOp[]): DocumentBody =>
  ops.reduce(applyOp, body);
