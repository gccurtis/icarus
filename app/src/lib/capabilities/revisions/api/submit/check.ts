import type { QueryCtx } from "$convex/_generated/server";
import { CONFLICT, shift, type TextSpan } from "$revisions/api/shared/apply/shift";
import { RevisionsError } from "$revisions/errors";
import type { Op, ResourceType } from "$revisions/types/change";

/**
 * `revisions.resources.rebaseWindow` in `configuration/revisions.yaml`.
 *
 * Mirrored rather than read. A mutation runs in an isolate with no filesystem
 * and the Convex bundler has no YAML loader, so the only two ways to reach the
 * file are a deployment environment variable or a copy here — and a copy is
 * visible to the code that depends on it. `test/unit/retention.test.ts` is what
 * fails if the file moves without it.
 */
export const REBASE_WINDOW = 200;

/** A change as authored, before it is known whether it may land. */
export type IncomingChange = {
  resourceType: ResourceType;
  resourceId: string;
  baseRevision: number;
  ops: Op[];
  touched: string[];
};

type TextOp = Extract<Op, { op: "text" }>;

const isText = (op: Op): op is TextOp => op.op === "text";

/** A path writes an id as `#id`; `ids`, `after`, and a moved id name the same things without it. */
const bare = (id: string): string => (id.startsWith("#") ? id.slice(1) : id);

/** The ids a path names, outermost first. An `#id` segment resolves alone, so a path may name one. */
const idsIn = (path: string): string[] =>
  path
    .split("/")
    .filter((segment) => segment.startsWith("#"))
    .map(bare);

/** A merge is a bare range string and its own identity; everything else carries an `id`. */
const identityOf = (value: unknown): string | null => {
  if (typeof value === "string") return bare(value);
  const id = (value as { id?: unknown } | null | undefined)?.id;
  return typeof id === "string" ? bare(id) : null;
};

/**
 * The deepest id an op addresses, never its ancestors: including them would
 * report a collision on every shared container, so two people editing different
 * atoms of one paragraph would never both land.
 *
 * An insert names what it created rather than where it went, which is what lets
 * two people add a row in the same place.
 */
const touchedByOp = (op: Op): string[] => {
  switch (op.op) {
    case "insert":
      return op.values.map(identityOf).filter((id): id is string => id !== null);
    case "remove":
      return op.ids.map(bare);
    case "move":
      return [bare(op.id)];
    default:
      // A path naming no id addresses a structural field, and then the path is
      // the only identity it has.
      return [idsIn(op.path).at(-1) ?? op.path];
  }
};

/**
 * What a change set's `touched` holds — derived from the ops rather than taken
 * from the client, because it is the whole of step 2 and a set that understated
 * it would be a change that never collides with anything.
 */
export const touchedBy = (ops: Op[]): string[] => [...new Set(ops.flatMap(touchedByOp))];

const opsTouching = (ops: Op[], id: string): Op[] =>
  ops.filter((op) => touchedByOp(op).includes(id));

/** Two people typing in one atom is the single intersection step 4 can transform. */
const bothTyping = (mine: Op[], landed: Op[], id: string): boolean => {
  const here = opsTouching(mine, id);
  const there = opsTouching(landed, id);
  return here.length > 0 && there.length > 0 && [...here, ...there].every(isText);
};

/** Ops measuring a position in a string: a text op's `at`, a mark's `from` and `to`. */
const carriesOffsets = (op: Op): boolean => op.op === "text" || op.target === "mark";

/** The id a path names before a list — `#b7x2/atoms/#a9x1` is an atom of block `b7x2`. */
const owner = (path: string, list: "atoms" | "marks"): string | null => {
  const segments = path.split("/");
  const index = segments.indexOf(list);
  const name = index > 0 ? segments[index - 1] : undefined;
  return name?.startsWith("#") ? bare(name) : null;
};

/** The block whose display an op's offsets are measured against, when its path says. */
const blockOf = (op: Op): string | null => owner(op.path, op.op === "text" ? "atoms" : "marks");

const atomOf = (op: TextOp): string | null => idsIn(op.path).at(-1) ?? null;

/**
 * Whether an intervening op moved a block's text by an amount it does not state:
 * a formula re-resolved, an expression replaced, an atom inserted or removed, or
 * the block set wholesale. A mark carries no text and so never does.
 */
const movesText = (op: Op): boolean =>
  op.op !== "text" && (op.target === "atom" || op.target === "block");

/** The block such an op disturbed, or null when its path does not say which. */
const disturbed = (op: Op): string | null =>
  op.target === "atom" ? owner(op.path, "atoms") : (idsIn(op.path).at(-1) ?? null);

/** Every intervening span in revision order, each against the result of the last. */
const through = (p: number, spans: TextSpan[]): number => {
  let at = p;
  for (const span of spans) {
    const next = shift(at, span);
    if (next === CONFLICT) {
      throw new RevisionsError(
        "offsets-overlap",
        `Offset ${p} falls strictly inside text the window replaced.`,
        4
      );
    }
    at = next;
  }
  return at;
};

type Offsets = { from: number; to: number };

const hasOffsets = (value: unknown): value is Offsets =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Offsets).from === "number" &&
  typeof (value as Offsets).to === "number";

/** A mark's two ends move independently; the rest of its payload is untouched. */
const movedMark = (value: unknown, move: (p: number) => number): unknown =>
  hasOffsets(value) ? { ...value, from: move(value.from), to: move(value.to) } : value;

/**
 * `was` and a removal's `values` move with the mark itself. They describe the
 * state an undo restores, and after the window applied that state is in the
 * window's coordinates too.
 */
const marksMoved = (op: Op, move: (p: number) => number): Op => {
  switch (op.op) {
    case "set":
      return { ...op, value: movedMark(op.value, move), was: movedMark(op.was, move) };
    case "insert":
    case "remove":
      return { ...op, values: op.values.map((value: unknown) => movedMark(value, move)) };
    default:
      return op;
  }
};

/**
 * One incoming op with its offsets moved past the window.
 *
 * A text op's `at` is an offset into its own atom, so only edits to that atom
 * move it. A mark's offsets index the block's whole display string, so every
 * text edit in the block does. Either way, a path that does not name what the
 * offsets are measured against cannot be shown to be somewhere else, and the
 * change is refused rather than shifted on a guess.
 */
const rebased = (op: Op, texts: TextOp[]): Op => {
  if (isText(op)) {
    const atom = atomOf(op);
    if (atom === null) {
      throw new RevisionsError("not-plain-text", `'${op.path}' names no atom to measure in.`, 4);
    }
    return { ...op, at: through(op.at, texts.filter((text) => atomOf(text) === atom)) };
  }

  const block = blockOf(op);
  if (block === null || texts.some((text) => blockOf(text) === null)) {
    throw new RevisionsError(
      "not-plain-text",
      `'${op.path}' and the window's edits cannot be shown to be in different blocks.`,
      4
    );
  }
  return marksMoved(op, (p) => through(p, texts.filter((text) => blockOf(text) === block)));
};

/**
 * Whether an incoming change may land, and as what.
 *
 * The ladder in
 * [change conflicts](../../../../../../../docs/processes/change-conflicts.md),
 * cheapest rung first. Three of the four checks can only reject; only step 4
 * produces a modified change, and only after refusing everything it is not
 * certain about — a rejection costs one round trip and loses no work, because
 * the edits are still in the client's buffer.
 *
 * Nothing here reads a body. Every rung is a comparison of ids, paths, and
 * offsets the ops already carry.
 */
export const check = async (
  ctx: QueryCtx,
  incoming: IncomingChange,
  current: number
): Promise<Op[]> => {
  if (incoming.baseRevision === current) return incoming.ops;

  // The window's age is tested before it is read, which is also what bounds the
  // read: `(B, C]` on a base from last year is every set the resource ever had.
  if (current - incoming.baseRevision > REBASE_WINDOW) {
    throw new RevisionsError(
      "base-outside-window",
      `Authored against revision ${incoming.baseRevision}; only the last ${REBASE_WINDOW} are kept.`,
      1
    );
  }

  const sets = await ctx.db
    .query("changeSets")
    .withIndex("by_resource_revision", (q) =>
      q
        .eq("resourceType", incoming.resourceType)
        .eq("resourceId", incoming.resourceId)
        .gt("revision", incoming.baseRevision)
    )
    .order("asc")
    .collect();
  if (sets.length === 0) return incoming.ops;

  const landed: Op[] = sets.flatMap((set) => set.ops);

  const addressed = new Set(sets.flatMap((set) => set.touched));
  for (const id of incoming.touched) {
    if (!addressed.has(id) || bothTyping(incoming.ops, landed, id)) continue;
    throw new RevisionsError("touched-intersects", `The window already addressed '${id}'.`, 2);
  }

  // Identity misses one relationship: removing `#b7x2` touches `#b7x2`, while
  // editing `#b7x2/atoms/#a9x1` touches `#a9x1`. A removal covers its whole
  // subtree and a path is a string, so this is the containment the ids missed.
  for (const op of landed) {
    if (op.op !== "remove") continue;
    const gone = new Set(op.ids.map(bare));
    const under = incoming.ops.find((mine) => idsIn(mine.path).some((id) => gone.has(id)));
    if (under) {
      throw new RevisionsError(
        "removed-under-edit",
        `'${under.path}' is inside something the window removed.`,
        3
      );
    }
  }

  const offsets = incoming.ops.filter(carriesOffsets);
  if (offsets.length === 0) return incoming.ops;

  // Shifting is correct only where every intervening op that moved the string
  // moved it by a stated amount, so anything else in these blocks disqualifies
  // it. A path that does not name its block counts as any block.
  const blocks = offsets.map(blockOf);
  for (const op of landed) {
    if (!movesText(op)) continue;
    const block = disturbed(op);
    if (block !== null && !blocks.includes(null) && !blocks.includes(block)) continue;
    throw new RevisionsError(
      "not-plain-text",
      `An intervening ${op.op} on '${op.path}' moved the text these offsets are measured against.`,
      4
    );
  }

  const texts = landed.filter(isText);
  if (texts.length === 0) return incoming.ops;
  return incoming.ops.map((op) => (carriesOffsets(op) ? rebased(op, texts) : op));
};
