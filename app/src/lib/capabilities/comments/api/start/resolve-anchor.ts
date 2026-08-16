import type { Scope } from "$access/types/access";
import { CommentsError } from "$comments/errors";
import type { AnchorWithin, CommentAnchor } from "$comments/types/anchor";
import type { QueryCtx } from "$convex/_generated/server";
import { applyOps, displaySpan } from "$revisions/api/shared/apply/apply";
import { CONFLICT, shift, type TextSpan } from "$revisions/api/shared/apply/shift";
import { current } from "$revisions/api/shared/current";
import { revisionsRefusal } from "$revisions/errors";
import type { Op, ResourceKey } from "$revisions/types/change";

type Node = Record<string, unknown>;
type TextOp = Extract<Op, { op: "text" }>;

const isNode = (value: unknown): value is Node =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** The thing an anchor names, wherever it now sits. Ids are unique within a resource. */
const nodeById = (node: unknown, id: string): Node | null => {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = nodeById(child, id);
      if (found) return found;
    }
    return null;
  }
  if (!isNode(node)) return null;
  if (node.id === id) return node;
  for (const child of Object.values(node)) {
    const found = nodeById(child, id);
    if (found) return found;
  }
  return null;
};

/** What the anchor has to still find for the thread to have anywhere to hang. */
const namedBy = (within: AnchorWithin): string => {
  switch (within.kind) {
    case "slide":
      return within.slideId;
    case "element":
      return within.elementId;
    // A cell has no id — its address is its identity — so the sheet is what must exist.
    case "cell":
      return within.sheetId;
    case "text":
      return within.blockId;
  }
};

/**
 * An anchor's offsets index the block's display string exactly as a mark's do, so
 * they move by the same arithmetic and it is imported rather than restated.
 *
 * The collapse is the same policy too: by the time an edit has been accepted there
 * is nobody to reject to, so an offset inside replaced text lands on the edit point
 * and `quote` is what makes the drift recognizable.
 */
const moved = (p: number, span: TextSpan, closing = false): number => {
  const next = shift(p, span, closing);
  return next === CONFLICT ? span.at : next;
};

/** Whether a text op edits an atom of the anchored block, which is the only op that moves it. */
const editsBlock = (body: unknown, op: TextOp, blockId: string): boolean => {
  const block = nodeById(body, blockId);
  const atomId = (op.path.split("/").pop() ?? "").replace(/^#/, "");
  return (
    !!block &&
    Array.isArray(block.atoms) &&
    block.atoms.some((atom) => isNode(atom) && atom.id === atomId)
  );
};

/** The three general resources are the ones with a body to resolve against. */
const resourceOf = (anchor: CommentAnchor): ResourceKey | null =>
  anchor.targetType === "document" ||
  anchor.targetType === "slides" ||
  anchor.targetType === "spreadsheet"
    ? { resourceType: anchor.targetType, resourceId: anchor.targetId }
    : null;

/**
 * The resource as it stands, in this capability's own words.
 *
 * A refusal a caller reads should name the function they called: they asked to
 * comment, not to read a change-set window.
 */
const stateOf = async (ctx: QueryCtx, scope: Scope, resource: ResourceKey) => {
  try {
    return await current(ctx, scope, resource);
  } catch (error) {
    if (revisionsRefusal(error)?.code !== "not-found") throw error;
    throw new CommentsError(
      "not-found",
      `Not found: ${resource.resourceType} ${resource.resourceId}`
    );
  }
};

/**
 * The anchor as it stands now, given the revision the selection was made against.
 *
 * **The id half needs no work** — `#b7x2` is that block whatever is inserted above
 * it, which is why the anchor stores an id and not a position. What is still
 * positional is a text range's offsets, and they are carried forward op by op:
 * each accepted edit's span is computed against the body it applied to, because an
 * op's `at` indexes its own atom and the offsets index the whole display string.
 *
 * `quote` is taken from the body the author was looking at, not from the argument
 * and not from the body now — it is a record of what was selected, and a stored
 * copy of the current text would be no evidence of anything.
 *
 * An anchor to a target with no body — an external file, or the research objects
 * arriving in pass 4 — is a kind string and an id, and passes through as given.
 */
export const resolveAnchor = async (
  ctx: QueryCtx,
  scope: Scope,
  anchor: CommentAnchor,
  baseRevision?: number
): Promise<CommentAnchor> => {
  const resource = resourceOf(anchor);
  const within = anchor.within;
  if (!resource) return anchor;

  const { leader, sets, revision } = await stateOf(ctx, scope, resource);
  const base = baseRevision ?? revision;
  if (base < leader.revision || base > revision) {
    throw new CommentsError(
      "anchor-stale",
      `Revision ${base} is outside the window ${leader.revision}–${revision}`
    );
  }
  if (!within) return anchor;

  const ops = (from: number, to: number) =>
    sets.filter((set) => set.revision > from && set.revision <= to).flatMap((set) => set.ops);

  // A text range is the only `within` with anything positional in it.
  const text = within.kind === "text" ? within : null;
  let body: unknown = applyOps(leader.body, ops(leader.revision, base));
  const block = text && nodeById(body, text.blockId);
  const quote =
    text && typeof block?.display === "string"
      ? block.display.slice(text.from, text.to)
      : anchor.quote;

  let range = text && { from: text.from, to: text.to };
  for (const op of ops(base, revision)) {
    if (text && range && op.op === "text" && editsBlock(body, op, text.blockId)) {
      const span = displaySpan(body, op);
      if (span) range = { from: moved(range.from, span), to: moved(range.to, span, true) };
    }
    body = applyOps(body, [op]);
  }

  if (!nodeById(body, namedBy(within))) {
    throw new CommentsError("anchor-missing", `Nothing here to comment on: ${namedBy(within)}`);
  }
  return { ...anchor, quote, within: range ? { ...within, ...range } : within };
};
