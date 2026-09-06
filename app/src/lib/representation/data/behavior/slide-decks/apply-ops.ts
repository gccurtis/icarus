import type { Atom, TextBlock } from "$representation/data/types/content/content-block";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";

type Identified = { id: string };
type Tree = Record<string, unknown>;

const ROOT_FIELDS = new Set(["aspectRatio", "theme", "styles", "slides", "sections", "layouts"]);

const refuse = (op: SlideDeckOp, why: string): never => {
  throw new Error(`cannot apply ${op.op} at ${op.path}: ${why}`);
};

const isTree = (value: unknown): value is Tree =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isReference = (value: Tree): boolean => {
  const keys = Object.keys(value);
  return keys.length === 2 && keys.includes("kind") && keys.includes("id");
};

const carries = (value: unknown, id: string): value is Identified & Tree =>
  isTree(value) && value.id === id && !isReference(value);

type Search = { hit: boolean };

const replaceIn = <T>(value: T, id: string, change: (node: Tree) => Tree, search: Search): T => {
  if (search.hit) return value;

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const replaced = replaceIn(item, id, change, search);
      if (replaced !== item) changed = true;
      return replaced;
    });
    return (changed ? next : value) as T;
  }

  if (!isTree(value)) return value;

  if (carries(value, id)) {
    search.hit = true;
    return change(value) as T;
  }

  let changed = false;
  const next: Tree = {};
  for (const [key, held] of Object.entries(value)) {
    const replaced = replaceIn(held, id, change, search);
    if (replaced !== held) changed = true;
    next[key] = replaced;
  }
  return (changed ? next : value) as T;
};

const mapNode = (body: SlideDeckBody, id: string, change: (node: Tree) => Tree): SlideDeckBody => {
  const search: Search = { hit: false };
  const next = replaceIn(body, id, change, search);
  if (!search.hit) throw new Error(`Nothing in the deck has the id ${id}.`);
  return next;
};

const findNode = (value: unknown, id: string): Tree | undefined => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findNode(item, id);
      if (hit) return hit;
    }
    return undefined;
  }
  if (!isTree(value)) return undefined;
  if (carries(value, id)) return value;
  for (const held of Object.values(value)) {
    const hit = findNode(held, id);
    if (hit) return hit;
  }
  return undefined;
};

const setDeep = (node: Tree, segments: readonly string[], value: unknown, op: SlideDeckOp): Tree => {
  const [head, ...rest] = segments;
  if (head === undefined) return refuse(op, "a set names a field");

  if (rest.length === 0) {
    const held = node[head];
    if (Array.isArray(held) && held.some((item) => isTree(item) && typeof item.id === "string")) {
      return refuse(op, `${head} is a list — insert, remove or move into it`);
    }
    if (value === null) {
      const { [head]: gone, ...without } = node;
      void gone;
      return without;
    }
    return { ...node, [head]: value };
  }

  const inner = node[head];
  if (inner === undefined) return { ...node, [head]: setDeep({}, rest, value, op) };
  if (!isTree(inner)) return refuse(op, `${head} holds no fields to reach ${rest.join("/")} in`);
  return { ...node, [head]: setDeep(inner, rest, value, op) };
};

const applySet = (body: SlideDeckBody, op: Extract<SlideDeckOp, { op: "set" }>): SlideDeckBody => {
  const [head, ...rest] = op.path.split("/");

  if (ROOT_FIELDS.has(head)) {
    return setDeep(body as unknown as Tree, [head, ...rest], op.value, op) as unknown as SlideDeckBody;
  }

  if (rest.length === 0) return refuse(op, "an id alone names nothing to set");
  return mapNode(body, head, (node) => setDeep(node, rest, op.value, op));
};

const insertAfter = <T extends Identified>(
  items: readonly T[],
  after: string | null,
  values: readonly T[]
): T[] => {
  if (after === null) return [...values, ...items];

  const at = items.findIndex((item) => item.id === after);
  if (at === -1) throw new Error(`Nothing with id ${after} to insert after.`);

  return [...items.slice(0, at + 1), ...values, ...items.slice(at + 1)];
};

const withoutIds = <T extends Identified>(items: readonly T[], ids: readonly string[]): T[] => {
  const going = new Set(ids);
  const kept = items.filter((item) => !going.has(item.id));
  if (kept.length + going.size !== items.length) {
    throw new Error(`Not every id of ${[...going].join(", ")} is there to remove.`);
  }

  return kept;
};

const mapListDeep = (
  node: Tree,
  fields: readonly string[],
  op: SlideDeckOp,
  change: (list: Identified[]) => Identified[]
): Tree => {
  const [field, ...rest] = fields;
  if (field === undefined) return refuse(op, "a list is named by its holder and a field");
  const held = node[field];
  if (rest.length === 0) {
    if (!Array.isArray(held)) return refuse(op, `${field} is not a list here`);
    return { ...node, [field]: change(held as Identified[]) };
  }
  if (!isTree(held)) return refuse(op, `${field} holds no ${rest.join("/")}`);
  return { ...node, [field]: mapListDeep(held, rest, op, change) };
};

const mapList = (
  body: SlideDeckBody,
  op: SlideDeckOp,
  change: (list: Identified[]) => Identified[]
): SlideDeckBody => {
  const [head, ...fields] = op.path.split("/");

  if (fields.length === 0) {
    if (!ROOT_FIELDS.has(head)) return refuse(op, `${head} is not a list the deck holds`);
    const held = (body as unknown as Tree)[head];
    if (!Array.isArray(held)) return refuse(op, `${head} is not a list`);
    return { ...body, [head]: change(held as Identified[]) };
  }

  return mapNode(body, head, (node) => mapListDeep(node, fields, op, change));
};

const applyInsert = (body: SlideDeckBody, op: Extract<SlideDeckOp, { op: "insert" }>) =>
  mapList(body, op, (list) => insertAfter(list, op.after, op.values as Identified[]));

const applyRemove = (body: SlideDeckBody, op: Extract<SlideDeckOp, { op: "remove" }>) =>
  mapList(body, op, (list) => withoutIds(list, op.ids));

const applyMove = (body: SlideDeckBody, op: Extract<SlideDeckOp, { op: "move" }>) =>
  mapList(body, op, (list) => {
    const moving = list.find((item) => item.id === op.id);
    if (moving === undefined) throw new Error(`No ${op.target} ${op.id} to move.`);
    return insertAfter(withoutIds(list, [op.id]), op.after, [moving]);
  });

const displayOf = (atoms: readonly Atom[]): string =>
  atoms.map((atom) => (atom.kind === "literal" ? atom.text : atom.lastResolvedDisplay)).join("");

const spliced = (op: Extract<SlideDeckOp, { op: "text" }>, atom: Atom): Atom => {
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

const shiftedFrom = (position: number, at: number, removed: number, inserted: number): number => {
  if (position < at) return position;
  if (position > at + removed) return position + inserted - removed;
  return removed > 0 ? at : at + inserted;
};

const shiftedTo = (position: number, at: number, removed: number, inserted: number): number => {
  if (position < at) return position;
  if (position > at + removed) return position + inserted - removed;
  return position === at + removed ? at + inserted : at;
};

const shiftedMarks = (block: TextBlock, at: number, removed: number, inserted: number) =>
  block.marks
    .map((mark) => ({
      ...mark,
      from: shiftedFrom(mark.from, at, removed, inserted),
      to: shiftedTo(mark.to, at, removed, inserted)
    }))
    .filter((mark) => mark.to > mark.from);

const applyText = (body: SlideDeckBody, op: Extract<SlideDeckOp, { op: "text" }>): SlideDeckBody => {
  const [blockId, field, atomId] = op.path.split("/");
  if (field !== "atoms" || atomId === undefined) return refuse(op, "a text op names <block>/atoms/<atom>");

  return mapNode(body, blockId, (node) => {
    const block = node as unknown as TextBlock;
    if (block.type !== "text" || !Array.isArray(block.atoms)) {
      throw new Error(`Block ${blockId} holds no atoms a text op can reach.`);
    }
    const atomIndex = block.atoms.findIndex((atom) => atom.id === atomId);
    if (atomIndex === -1) throw new Error(`No atom ${atomId} in block ${blockId}.`);

    const before = displayOf(block.atoms.slice(0, atomIndex)).length + op.at;
    const atoms = block.atoms.map((atom) => (atom.id === atomId ? spliced(op, atom) : atom));
    return {
      ...block,
      atoms,
      display: displayOf(atoms),
      marks: shiftedMarks(block, before, op.remove.length, op.insert.length)
    } as unknown as Tree;
  });
};

const applyOp = (body: SlideDeckBody, op: SlideDeckOp): SlideDeckBody => {
  switch (op.op) {
    case "set":
      return applySet(body, op);
    case "insert":
      return applyInsert(body, op);
    case "remove":
      return applyRemove(body, op);
    case "move":
      return applyMove(body, op);
    case "text":
      return applyText(body, op);
    default:
      return refuse(op, "not an op");
  }
};

export const applyOps = (body: SlideDeckBody, ops: readonly SlideDeckOp[]): SlideDeckBody =>
  ops.reduce(applyOp, body);

export const nodeIn = (body: SlideDeckBody, id: string): Tree | undefined => findNode(body, id);
