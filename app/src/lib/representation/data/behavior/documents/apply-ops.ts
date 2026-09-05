import type {
  Atom,
  ContentBlock,
  Mark,
  MarkEnd
} from "$representation/data/types/content/content-block";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";
import type { StyleSet, TextStyle } from "$representation/data/types/documents/style-set";

type BlocksRow = Extract<DocumentRow, { kind: "blocks" }>;
type Marked = Extract<ContentBlock, { type: "text" | "prompt" }>;
type Furniture = "header" | "footer";
type RowList = "rows" | "firstPageRows";
type Root = { furniture?: Furniture; list: RowList };
type Fields = Record<string, unknown>;

const refuse = (op: DocumentOp, why: string): never => {
  throw new Error(`cannot apply ${op.op} on ${op.target} at ${op.path}: ${why}`);
};

const isMarked = (block: ContentBlock): block is Marked =>
  block.type === "text" || block.type === "prompt";

export const displayOf = (atoms: readonly Atom[]): string =>
  atoms.map((atom) => (atom.kind === "literal" ? atom.text : atom.lastResolvedDisplay)).join("");

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

const withField = <T extends object>(held: T, field: string, value: unknown): T => {
  if (value === null) {
    const { [field]: gone, ...rest } = held as Fields;
    void gone;
    return rest as T;
  }

  return { ...held, [field]: value };
};

const setDeep = (held: unknown, fields: readonly string[], value: unknown): unknown => {
  const [field, ...rest] = fields;
  if (field === undefined) return value;

  const object = held !== null && typeof held === "object" ? (held as Fields) : {};
  return withField(object, field, rest.length === 0 ? value : setDeep(object[field], rest, value));
};

const ROOTS: readonly Root[] = [
  { list: "rows" },
  { furniture: "header", list: "rows" },
  { furniture: "header", list: "firstPageRows" },
  { furniture: "footer", list: "rows" },
  { furniture: "footer", list: "firstPageRows" }
];

const rootOf = (path: string): Root | undefined => {
  if (path === "rows") return { list: "rows" };

  const [furniture, list] = path.split("/");
  if (furniture !== "header" && furniture !== "footer") return undefined;
  if (list !== "rows" && list !== "firstPageRows") return undefined;

  return { furniture, list };
};

const rowsAt = (body: DocumentBody, root: Root): readonly DocumentRow[] | undefined =>
  root.furniture === undefined ? body.rows : body[root.furniture]?.[root.list];

const withRowsAt = (body: DocumentBody, root: Root, rows: DocumentRow[]): DocumentBody => {
  if (root.furniture === undefined) return { ...body, rows };

  const held = body[root.furniture];
  if (held === undefined) throw new Error(`The document has no ${root.furniture}.`);

  return { ...body, [root.furniture]: { ...held, [root.list]: rows } };
};

const rootHolding = (body: DocumentBody, rowId: string): Root | undefined =>
  ROOTS.find((root) => rowsAt(body, root)?.some((row) => row.id === rowId));

const mapRow = (
  body: DocumentBody,
  rowId: string,
  change: (row: DocumentRow) => DocumentRow
): DocumentBody => {
  const root = rootHolding(body, rowId);
  if (root === undefined) throw new Error(`No row ${rowId} in the body.`);

  const rows = rowsAt(body, root) ?? [];
  return withRowsAt(
    body,
    root,
    rows.map((row) => (row.id === rowId ? change(row) : row))
  );
};

const blocksRow = (row: DocumentRow, path: string): BlocksRow => {
  if (row.kind !== "blocks") {
    throw new Error(`Row ${row.id} holds no blocks, so ${path} is unreachable.`);
  }
  return row;
};

const rowHolding = (body: DocumentBody, blockId: string): DocumentRow | undefined => {
  for (const root of ROOTS) {
    const found = rowsAt(body, root)?.find(
      (row) => row.kind === "blocks" && row.blocks.some((block) => block.id === blockId)
    );
    if (found !== undefined) return found;
  }
  return undefined;
};

const mapBlock = (
  body: DocumentBody,
  blockId: string,
  change: (block: ContentBlock) => ContentBlock
): DocumentBody => {
  const holder = rowHolding(body, blockId);
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

const blockHoldingMark = (body: DocumentBody, markId: string): ContentBlock | undefined => {
  for (const root of ROOTS) {
    for (const row of rowsAt(body, root) ?? []) {
      if (row.kind !== "blocks") continue;
      const found = row.blocks.find(
        (block) => isMarked(block) && block.marks.some((mark) => mark.id === markId)
      );
      if (found !== undefined) return found;
    }
  }
  return undefined;
};

const mapMark = (
  body: DocumentBody,
  markId: string,
  change: (mark: Mark) => Mark
): DocumentBody => {
  const holder = blockHoldingMark(body, markId);
  if (holder === undefined) throw new Error(`No mark ${markId} in the body.`);

  return mapBlock(body, holder.id, (block) =>
    isMarked(block)
      ? { ...block, marks: block.marks.map((mark) => (mark.id === markId ? change(mark) : mark)) }
      : block
  );
};

const shiftFrom = (end: MarkEnd, atom: string, at: number, removed: number, inserted: number): MarkEnd => {
  if (end.atom !== atom || end.offset < at) return end;
  if (end.offset >= at + removed) return { ...end, offset: end.offset + inserted - removed };
  return { ...end, offset: at + inserted };
};

const shiftTo = (end: MarkEnd, atom: string, at: number, removed: number, inserted: number): MarkEnd => {
  if (end.atom !== atom || end.offset <= at) return end;
  if (end.offset >= at + removed) return { ...end, offset: end.offset + inserted - removed };
  return { ...end, offset: at };
};

const empty = (mark: Mark): boolean =>
  mark.from.atom === mark.to.atom && mark.from.offset >= mark.to.offset;

const shifted = (
  marks: readonly Mark[],
  atom: string,
  at: number,
  removed: number,
  inserted: number
): Mark[] =>
  marks
    .map((mark) => ({
      ...mark,
      from: shiftFrom(mark.from, atom, at, removed, inserted),
      to: shiftTo(mark.to, atom, at, removed, inserted)
    }))
    .filter((mark) => !empty(mark));

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
  if (field !== "atoms" || atomId === undefined) return refuse(op, "a text op names an atom");

  return mapBlock(body, blockId, (block) => {
    if (!isMarked(block)) throw new Error(`Block ${blockId} holds no atoms a text op can reach.`);
    if (!block.atoms.some((atom) => atom.id === atomId)) {
      throw new Error(`No atom ${atomId} in block ${blockId}.`);
    }

    const atoms = block.atoms.map((atom) => (atom.id === atomId ? spliced(op, atom) : atom));
    return {
      ...block,
      atoms,
      display: displayOf(atoms),
      marks: shifted(block.marks, atomId, op.at, op.remove.length, op.insert.length)
    };
  });
};

const applyDocumentSet = (
  body: DocumentBody,
  op: Extract<DocumentOp, { op: "set" }>
): DocumentBody => {
  const [head, ...rest] = op.path.split("/");

  if (head === "pageSetup" || head === "header" || head === "footer") {
    return withField(body, head, rest.length === 0 ? op.value : setDeep(body[head], rest, op.value));
  }

  if (head === "styles") {
    if (rest.length === 0) return withField(body, "styles", op.value);

    const held: StyleSet = body.styles ?? { styles: {}, defaultKey: "" };
    const [key, ...fields] = rest;
    if (key === "defaultKey") return { ...body, styles: { ...held, defaultKey: op.value as string } };

    const styles = withField(
      held.styles,
      key,
      fields.length === 0 ? op.value : setDeep(held.styles[key], fields, op.value)
    );
    return { ...body, styles: { ...held, styles } };
  }

  return refuse(op, "the document has no such field");
};

const applySet = (body: DocumentBody, op: Extract<DocumentOp, { op: "set" }>): DocumentBody => {
  if (op.target === "document") return applyDocumentSet(body, op);

  const [id, field, ...rest] = op.path.split("/");
  if (field === undefined || rest.length > 0) return refuse(op, "a set names one field of one thing");

  if (op.target === "row") return mapRow(body, id, (row) => withField(row, field, op.value));
  if (op.target === "block") return mapBlock(body, id, (block) => withField(block, field, op.value));
  if (op.target === "mark") return mapMark(body, id, (mark) => withField(mark, field, op.value));

  return refuse(op, "an atom is spliced, not set");
};

const applyStyles = (
  body: DocumentBody,
  op: Extract<DocumentOp, { op: "insert" | "remove" }>
): DocumentBody => {
  const held: StyleSet = body.styles ?? { styles: {}, defaultKey: op.ids[0] ?? "" };
  const styles = { ...held.styles };

  if (op.op === "insert") {
    op.ids.forEach((key, index) => {
      styles[key] = op.values[index] as TextStyle;
    });
  } else {
    for (const key of op.ids) {
      if (!(key in styles)) throw new Error(`No style ${key} to remove.`);
      delete styles[key];
    }
  }

  // A style set with nothing in it is no style set, so removing the last style
  // returns the body to what it was before the first was inserted.
  return Object.keys(styles).length === 0
    ? withField(body, "styles", null)
    : { ...body, styles: { ...held, styles } };
};

const applyInsert = (
  body: DocumentBody,
  op: Extract<DocumentOp, { op: "insert" }>
): DocumentBody => {
  if (op.target === "document") {
    return op.path === "styles" ? applyStyles(body, op) : refuse(op, "only styles are inserted");
  }

  if (op.target === "row") {
    const root = rootOf(op.path);
    if (root === undefined) return refuse(op, "rows live at rows, header/rows or footer/rows");
    const rows = rowsAt(body, root);
    if (rows === undefined) return refuse(op, `the document has no ${root.furniture}`);
    return withRowsAt(body, root, insertAfter(rows, op.after, op.values as DocumentRow[]));
  }

  const [id, field] = op.path.split("/");

  if (op.target === "block" && field === "blocks") {
    return mapRow(body, id, (row) => ({
      ...blocksRow(row, op.path),
      blocks: insertAfter(blocksRow(row, op.path).blocks, op.after, op.values as ContentBlock[])
    }));
  }

  if (op.target === "atom" && field === "atoms") {
    return mapBlock(body, id, (block) => {
      if (!isMarked(block)) throw new Error(`Block ${id} holds no atoms.`);
      const atoms = insertAfter(block.atoms, op.after, op.values as Atom[]);
      return { ...block, atoms, display: displayOf(atoms) };
    });
  }

  if (op.target === "mark" && field === "marks") {
    return mapBlock(body, id, (block) => {
      if (!isMarked(block)) throw new Error(`Block ${id} holds no marks.`);
      return { ...block, marks: insertAfter(block.marks, op.after, op.values as Mark[]) };
    });
  }

  return refuse(op, "nothing is inserted there");
};

const applyRemove = (
  body: DocumentBody,
  op: Extract<DocumentOp, { op: "remove" }>
): DocumentBody => {
  if (op.target === "document") {
    return op.path === "styles" ? applyStyles(body, op) : refuse(op, "only styles are removed");
  }

  if (op.target === "row") {
    const root = rootOf(op.path);
    if (root === undefined) return refuse(op, "rows live at rows, header/rows or footer/rows");
    const rows = rowsAt(body, root);
    if (rows === undefined) return refuse(op, `the document has no ${root.furniture}`);
    return withRowsAt(body, root, withoutIds(rows, op.ids));
  }

  const [id, field] = op.path.split("/");

  if (op.target === "block" && field === "blocks") {
    return mapRow(body, id, (row) => ({
      ...blocksRow(row, op.path),
      blocks: withoutIds(blocksRow(row, op.path).blocks, op.ids)
    }));
  }

  if (op.target === "atom" && field === "atoms") {
    return mapBlock(body, id, (block) => {
      if (!isMarked(block)) throw new Error(`Block ${id} holds no atoms.`);
      const atoms = withoutIds(block.atoms, op.ids);
      const going = new Set(op.ids);
      const marks = block.marks.filter(
        (mark) => !going.has(mark.from.atom) && !going.has(mark.to.atom)
      );
      return { ...block, atoms, display: displayOf(atoms), marks };
    });
  }

  if (op.target === "mark" && field === "marks") {
    return mapBlock(body, id, (block) => {
      if (!isMarked(block)) throw new Error(`Block ${id} holds no marks.`);
      return { ...block, marks: withoutIds(block.marks, op.ids) };
    });
  }

  return refuse(op, "nothing is removed there");
};

const applyMove = (body: DocumentBody, op: Extract<DocumentOp, { op: "move" }>): DocumentBody => {
  if (op.target === "row") {
    const root = rootOf(op.path);
    if (root === undefined) return refuse(op, "rows live at rows, header/rows or footer/rows");
    const rows = rowsAt(body, root);
    if (rows === undefined) return refuse(op, `the document has no ${root.furniture}`);

    const moving = rows.find((row) => row.id === op.id);
    if (moving === undefined) throw new Error(`No row ${op.id} to move.`);

    return withRowsAt(body, root, insertAfter(withoutIds(rows, [op.id]), op.after, [moving]));
  }

  const [rowId, field] = op.path.split("/");
  if (field !== "blocks") return refuse(op, "blocks move within a row's blocks");

  return mapRow(body, rowId, (row) => {
    const held = blocksRow(row, op.path);
    const moving = held.blocks.find((block) => block.id === op.id);
    if (moving === undefined) throw new Error(`No block ${op.id} to move.`);

    return { ...held, blocks: insertAfter(withoutIds(held.blocks, [op.id]), op.after, [moving]) };
  });
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

export const invert = (op: DocumentOp): DocumentOp => {
  switch (op.op) {
    case "set":
      return { ...op, value: op.was, was: op.value };
    case "insert":
      return { ...op, op: "remove" };
    case "remove":
      return { ...op, op: "insert" };
    case "move":
      return { ...op, after: op.wasAfter, wasAfter: op.after };
    case "text":
      return { ...op, insert: op.remove, remove: op.insert };
  }
};

export const invertAll = (ops: readonly DocumentOp[]): DocumentOp[] =>
  [...ops].reverse().map(invert);
