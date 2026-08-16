import { CONFLICT, shift, type TextSpan } from "$revisions/api/shared/apply/shift";
import type { Op } from "$revisions/types/change";

type TextOp = Extract<Op, { op: "text" }>;
type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** A path writes an id as `#id`; `after`, `ids`, and a moved id name the same things without the marker. */
const bareId = (id: string): string => (id.startsWith("#") ? id.slice(1) : id);

/** A merge is a bare range string and its own identity; everything else carries an `id`. */
const identityOf = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  return isNode(value) && typeof value.id === "string" ? value.id : null;
};

/**
 * A body is a Convex value, so this covers it — and covering it here rather than
 * with a runtime global keeps applying ops independent of what the isolate
 * happens to expose.
 */
const clone = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map((entry) => clone(entry)) as T;
  if (isNode(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, clone(v)])) as T;
  }
  return value;
};

/** Where a path lands: the thing that holds the value, and what it holds it under. */
type Location = { container: Node | unknown[]; key: string | number };

const valueAt = ({ container, key }: Location): unknown =>
  Array.isArray(container) ? container[key as number] : container[key as string];

const assign = ({ container, key }: Location, value: unknown): void => {
  if (Array.isArray(container)) container[key as number] = value;
  else container[key as string] = value;
};

/**
 * Ids are unique within a resource, so an `#id` segment resolves by search
 * rather than by walking down to it — which is what lets `#b7x2/atoms/#a9x1`
 * address the same atom whether that block sits in a document row, a table cell,
 * or a slide element.
 */
const findById = (node: unknown, id: string): Location | null => {
  if (Array.isArray(node)) {
    for (let index = 0; index < node.length; index += 1) {
      if (identityOf(node[index]) === id) return { container: node, key: index };
      const found = findById(node[index], id);
      if (found) return found;
    }
    return null;
  }
  if (!isNode(node)) return null;

  for (const [key, child] of Object.entries(node)) {
    // A record's string field is not an entity, however much it looks like one:
    // a block naming its style entry would otherwise answer to that name.
    if (isNode(child) && child.id === id) return { container: node, key };
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
};

const step = (node: unknown, segment: string, path: string): Location => {
  if (segment.startsWith("#")) {
    const found = findById(node, segment.slice(1));
    if (!found) throw new Error(`'${path}' names '${segment}', which the body does not hold`);
    return found;
  }
  if (Array.isArray(node)) {
    const index = Number(segment);
    // Without this a `set` writes to `list["NaN"]`, which is a stored body no
    // reader would ever look at again.
    if (!Number.isInteger(index)) throw new Error(`'${path}' indexes a list with '${segment}'`);
    return { container: node, key: index };
  }
  if (isNode(node)) return { container: node, key: segment };
  throw new Error(`'${path}' passes through '${segment}', which holds nothing`);
};

/**
 * The last segment's location rather than its value, because `set` writes there
 * — including where nothing is yet, which is how a spreadsheet cell comes into
 * being.
 */
const locate = (body: unknown, path: string): Location => {
  const segments = path.split("/").filter((segment) => segment.length > 0);
  if (segments.length === 0) throw new Error("an op path names nothing");

  let location = step(body, segments[0], path);
  for (const segment of segments.slice(1)) location = step(valueAt(location), segment, path);
  return location;
};

const listAt = (body: unknown, path: string): unknown[] => {
  const list = valueAt(locate(body, path));
  if (!Array.isArray(list)) throw new Error(`'${path}' is not an ordered list`);
  return list;
};

/** `after: null` is the head, which is also what an empty list wants. */
const indexAfter = (list: unknown[], after: string | null, path: string): number => {
  if (after === null) return 0;
  const id = bareId(after);
  const index = list.findIndex((entry) => identityOf(entry) === id);
  if (index === -1) throw new Error(`'${path}' holds no '${after}' to place after`);
  return index + 1;
};

/** A literal's own text, a formula's resolved value: what the atom contributes to `display`. */
const textOf = (atom: unknown): string => {
  if (!isNode(atom)) return "";
  if (typeof atom.text === "string") return atom.text;
  return typeof atom.resolved === "string" ? atom.resolved : "";
};

/** The block a text op maintains, found by the atom it edits — its display and marks move with it. */
const blockOf = (node: unknown, atomId: string): Node | null => {
  if (isNode(node) && Array.isArray(node.atoms)) {
    if (node.atoms.some((atom) => identityOf(atom) === atomId)) return node;
  }
  const children = Array.isArray(node) ? node : isNode(node) ? Object.values(node) : [];
  for (const child of children) {
    const found = blockOf(child, atomId);
    if (found) return found;
  }
  return null;
};

/**
 * Applying has nobody to reject to, so a mark whose offset falls inside removed
 * text collapses to the edit point instead of conflicting: the text it named is
 * gone. It is collapsed rather than dropped so that a change addressing it still
 * finds it.
 */
const shifted = (p: number, span: TextSpan): number => {
  const next = shift(p, span);
  return next === CONFLICT ? span.at : next;
};

/**
 * Splice the atom, then move the block's marks and rebuild its display.
 *
 * **The mark shift is a consequence of applying, not a payload.** A change set
 * carries no marks beside a text op, so the shift is computed here — one
 * function, called again when rebasing.
 *
 * The op's `at` is an offset into the atom; a mark's offsets index the whole
 * display string, so the span the marks shift against starts where this atom
 * does. Getting that wrong moves marks that should not have moved, silently.
 */
const applyText = (body: unknown, op: TextOp): void => {
  const atomId = bareId(op.path.split("/").pop() ?? "");
  const block = blockOf(body, atomId);
  if (!block) throw new Error(`'${op.path}' names no atom of any block`);

  const atoms = block.atoms as unknown[];
  const index = atoms.findIndex((atom) => identityOf(atom) === atomId);
  const atom = atoms[index];
  if (!isNode(atom) || typeof atom.text !== "string") {
    throw new Error(`'${op.path}' is not a literal atom, which is all a text op edits`);
  }

  // Bounds first, because `slice` has none: an `at` past the end matches an
  // empty `remove` and quietly appends there instead.
  if (op.at < 0 || op.at + op.remove.length > atom.text.length) {
    throw new Error(`'${op.path}' edits at ${op.at}, which is outside the atom`);
  }

  // The removed string is checked rather than assumed: it is what every offset
  // downstream is measured against, and a mismatch means this op was authored
  // against a string that is no longer here.
  if (atom.text.slice(op.at, op.at + op.remove.length) !== op.remove) {
    throw new Error(`'${op.path}' does not hold '${op.remove}' at ${op.at}`);
  }

  const span: TextSpan = {
    at: atoms.slice(0, index).map(textOf).join("").length + op.at,
    insert: op.insert,
    remove: op.remove
  };

  atom.text = atom.text.slice(0, op.at) + op.insert + atom.text.slice(op.at + op.remove.length);

  if (Array.isArray(block.marks)) {
    for (const mark of block.marks) {
      if (!isNode(mark)) continue;
      mark.from = shifted(mark.from as number, span);
      mark.to = shifted(mark.to as number, span);
    }
  }
  block.display = atoms.map(textOf).join("");
};

const apply = (body: unknown, op: Op): void => {
  switch (op.op) {
    case "set":
      assign(locate(body, op.path), op.value);
      return;
    case "insert": {
      const list = listAt(body, op.path);
      list.splice(indexAfter(list, op.after, op.path), 0, ...op.values);
      return;
    }
    case "remove": {
      const list = listAt(body, op.path);
      for (const target of op.ids) {
        const id = bareId(target);
        const index = list.findIndex((entry) => identityOf(entry) === id);
        if (index === -1) throw new Error(`'${op.path}' holds no '${target}' to remove`);
        list.splice(index, 1);
      }
      return;
    }
    case "move": {
      const list = listAt(body, op.path);
      const id = bareId(op.id);
      const from = list.findIndex((entry) => identityOf(entry) === id);
      if (from === -1) throw new Error(`'${op.path}' holds no '${op.id}' to move`);
      const [entry] = list.splice(from, 1);
      list.splice(indexAfter(list, op.after, op.path), 0, entry);
      return;
    }
    case "text":
      applyText(body, op);
      return;
  }
};

/**
 * A body with the ops applied in order, as a new value.
 *
 * The input is copied rather than edited because a caller holds a snapshot it
 * did not ask to have changed — reading folds recent sets onto the leader body,
 * and a mutation that reached back into it would corrupt the anchor for
 * everything after it.
 *
 * Nothing here decides whether an op *should* apply; that is the conflict
 * ladder's, and by the time an op arrives here it has been decided. What this
 * still refuses is an op that cannot be carried out at all — a path naming
 * nothing, an entry that is not there, a removed string that is not the one in
 * the body — because a half-applied set is a state nobody authored.
 */
export const applyOps = <Body>(body: Body, ops: Op[]): Body => {
  const next = clone(body) as unknown;
  for (const op of ops) apply(next, op);
  return next as Body;
};
