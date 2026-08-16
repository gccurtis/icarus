import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import { applyOps, displaySpan } from "$revisions/api/shared/apply/apply";
import { CONFLICT, shift, type TextSpan } from "$revisions/api/shared/apply/shift";
import { current } from "$revisions/api/shared/current";
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

/**
 * The id an op resolves against the body besides the ones in its path: the entry
 * it is ordered after. `remove.after` and `move.wasAfter` are not among them —
 * they are what an undo would place the entry back after, and applying never
 * reads them, so refusing on one would cost a resubmit for a change that lands.
 */
const anchorOf = (op: Op): string | null =>
  (op.op === "insert" || op.op === "move") && op.after !== null ? bare(op.after) : null;

/** Every entity nested inside a removed entry, at any depth. A string field is text, not an entity. */
const idsWithin = (value: unknown): string[] => {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(idsWithin);
  const record = value as Record<string, unknown>;
  const own = typeof record.id === "string" ? [bare(record.id)] : [];
  return [...own, ...Object.values(record).flatMap(idsWithin)];
};

/**
 * What a removal took, subtree included — or `null` when it did not say.
 *
 * A removed row takes its blocks, atoms, and marks with it and names none of
 * them, so `values` is the only account of that subtree the ladder has. It is
 * the same payload an undo restores from, so a removal that carries it is a
 * removal that was invertible anyway.
 */
const removedBy = (op: Extract<Op, { op: "remove" }>): Set<string> | null => {
  const within = op.values.flatMap((value) =>
    // A merge is a bare range string and its own identity.
    typeof value === "string" ? [bare(value)] : idsWithin(value)
  );
  const ids = op.ids.map(bare);
  // A keyed entry has no identity of its own, so the account cannot name it —
  // the value in the same position is that account, and its absence is what the
  // opaque case looks like.
  const accounted = ids.every(
    (id, index) =>
      index < op.values.length && (within.includes(id) || identityOf(op.values[index]) === null)
  );
  return accounted ? new Set([...ids, ...within]) : null;
};

/** A merge is a bare range string and its own identity; everything else carries an `id`. */
const identityOf = (value: unknown): string | null => {
  if (typeof value === "string") return bare(value);
  const id = (value as { id?: unknown } | null | undefined)?.id;
  return typeof id === "string" ? bare(id) : null;
};

/**
 * The deepest identity a path names: its last `#id` and the segments below it,
 * or the whole path when it names no id at all.
 *
 * **The segments below the id are not decoration.** A keyed collection's entries
 * are named by the path and by nothing else, so stopping at the deepest id would
 * collapse `sheets/#sh1/cells/B2` and `.../B7` onto `sh1` — and two people
 * working in different corners of one sheet would contend on every write, which
 * is the opposite of what the sparse cell map is for.
 */
const deepest = (path: string): string => {
  const segments = path.split("/");
  const id = segments.findLastIndex((segment) => segment.startsWith("#"));
  return id === -1 ? path : segments.slice(id).map(bare).join("/");
};

/**
 * The deepest thing an op addresses, never its ancestors: including them would
 * report a collision on every shared container, so two people editing different
 * atoms of one paragraph would never both land.
 *
 * An insert names what it created rather than where it went, which is what lets
 * two people add a row in the same place.
 */
const touchedByOp = (op: Op): string[] => {
  switch (op.op) {
    case "insert":
      // A keyed entry has no identity of its own, so the path is what names it —
      // the mirror of the `remove` branch below.
      return op.values.map((value) => identityOf(value) ?? deepest(op.path));
    case "remove":
      // A path that already names the entry is what identifies it — a keyed
      // entry has no identity apart from where it sits. Otherwise the entry
      // names itself and the path is the collection it was in.
      return op.ids.map((id) =>
        op.path.split("/").at(-1) === bare(id) ? deepest(op.path) : bare(id)
      );
    case "move":
      return [bare(op.id)];
    default:
      return [deepest(op.path)];
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
const through = (p: number, spans: TextSpan[], closing = false): number => {
  let at = p;
  for (const span of spans) {
    const next = shift(at, span, closing);
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
 * The window's text edits in the coordinates a mark is measured in.
 *
 * **The one rung that reads a body**, and only for the pair that cannot be
 * decided without one: a text op's `at` indexes its own atom while a mark's
 * offsets index the block's display, and no op carries the atoms in front that
 * separate them. Comparing the two raw moves marks the edit never reached.
 *
 * Each span is measured against the body as its own op found it, so the window
 * is replayed from the incoming change's own base rather than measured against
 * where it ended up — an edit to an earlier atom moves where a later one starts.
 */
const displayed = async (
  ctx: QueryCtx,
  scope: Scope,
  incoming: IncomingChange,
  landed: Op[]
): Promise<Map<TextOp, TextSpan>> => {
  const { leader, sets } = await current(ctx, scope, incoming);
  if (leader.revision > incoming.baseRevision) {
    throw new RevisionsError(
      "not-plain-text",
      `Consolidation has folded past revision ${incoming.baseRevision}, so the text these offsets were measured against cannot be rebuilt.`,
      4
    );
  }

  let body: unknown = applyOps(
    leader.body,
    sets.filter((set) => set.revision <= incoming.baseRevision).flatMap((set) => set.ops)
  );
  const spans = new Map<TextOp, TextSpan>();
  for (const op of landed) {
    if (isText(op)) {
      const span = displaySpan(body, op);
      if (span) spans.set(op, span);
    }
    body = applyOps(body, [op]);
  }
  return spans;
};

/**
 * One incoming op with its offsets moved past the window.
 *
 * A text op's `at` is an offset into its own atom, so only edits to that atom
 * move it, and its own span is the one to move it by. A mark's offsets index the
 * block's whole display string, so every text edit in the block moves it, in the
 * converted coordinates `displayed` supplies. Either way, a path that does not
 * name what the offsets are measured against cannot be shown to be somewhere
 * else, and the change is refused rather than shifted on a guess.
 */
const rebased = (op: Op, texts: TextOp[], display: Map<TextOp, TextSpan>): Op => {
  if (isText(op)) {
    const atom = atomOf(op);
    if (atom === null) {
      throw new RevisionsError("not-plain-text", `'${op.path}' names no atom to measure in.`, 4);
    }
    const spans = texts.filter((text) => atomOf(text) === atom);
    const at = through(op.at, spans);

    // Both ends of what this replaces, because moving only the near one accepts
    // an edit that swallowed the window's: `remove` would then be a string the
    // atom no longer holds, and applying is where that would be found out.
    if (op.remove.length > 0 && through(op.at + op.remove.length, spans, true) - at !== op.remove.length) {
      throw new RevisionsError(
        "offsets-overlap",
        `'${op.path}' replaces text the window edited inside.`,
        4
      );
    }
    return { ...op, at };
  }

  const block = blockOf(op);
  if (block === null || texts.some((text) => blockOf(text) === null)) {
    throw new RevisionsError(
      "not-plain-text",
      `'${op.path}' and the window's edits cannot be shown to be in different blocks.`,
      4
    );
  }

  const spans: TextSpan[] = [];
  for (const text of texts) {
    if (blockOf(text) !== block) continue;
    const span = display.get(text);
    if (!span) {
      throw new RevisionsError(
        "not-plain-text",
        `'${text.path}' cannot be located in the body, so '${op.path}' cannot be measured against it.`,
        4
      );
    }
    spans.push(span);
  }
  return marksMoved(op, (p) => through(p, spans));
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
 * Every rung is a comparison of ids, paths, and offsets the ops already carry,
 * with one exception: rebasing a mark past a text edit needs the atoms in front
 * of that edit, and only the body holds them. That read is the last thing done
 * and the narrowest case reaching it.
 */
export const check = async (
  ctx: QueryCtx,
  scope: Scope,
  incoming: IncomingChange,
  revision: number
): Promise<Op[]> => {
  if (incoming.baseRevision === revision) return incoming.ops;

  // The window's age is tested before it is read, which is also what bounds the
  // read: `(B, C]` on a base from last year is every set the resource ever had.
  if (revision - incoming.baseRevision > REBASE_WINDOW) {
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
        .eq("projectId", scope.projectId)
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

  // Identity misses two relationships. Removing `#r4m1` touches `#r4m1`, while
  // editing `#b7x2/atoms/#a9x1` inside it touches `#a9x1` — and an `#id` segment
  // resolves alone, so the path above it that would have said so is not there.
  // An insert or move names what it created or carried, never the entry it was
  // ordered after. Both land as sets nothing can ever apply.
  for (const op of landed) {
    if (op.op !== "remove") continue;
    const gone = removedBy(op);
    if (gone === null) {
      throw new RevisionsError(
        "removed-under-edit",
        `A removal on '${op.path}' did not say what it took, so nothing can be shown to be outside it.`,
        3
      );
    }
    for (const mine of incoming.ops) {
      if (idsIn(mine.path).some((id) => gone.has(id))) {
        throw new RevisionsError(
          "removed-under-edit",
          `'${mine.path}' is inside something the window removed.`,
          3
        );
      }
      const anchor = anchorOf(mine);
      if (anchor !== null && gone.has(anchor)) {
        throw new RevisionsError(
          "removed-under-edit",
          `'${mine.path}' orders against '#${anchor}', which the window removed.`,
          3
        );
      }
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

  // Everything above answered from the ops alone. A mark is the one thing left
  // whose offsets nothing in them can convert, so the body is read here and
  // nowhere else — and only when the window typed inside a mark's own block.
  const marks = offsets.filter((op) => !isText(op));
  const converting = marks.some(
    (mark) => blockOf(mark) !== null && texts.some((text) => blockOf(text) === blockOf(mark))
  );
  const display = converting
    ? await displayed(ctx, scope, incoming, landed)
    : new Map<TextOp, TextSpan>();

  return incoming.ops.map((op) => (carriesOffsets(op) ? rebased(op, texts, display) : op));
};
