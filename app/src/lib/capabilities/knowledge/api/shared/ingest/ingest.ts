import type { Scope } from "$access/types/access";
import type { Doc } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { embedWindows } from "$knowledge/api/shared/ingest/embed-windows";
import { windowId } from "$knowledge/api/shared/ingest/window-id";
import { windowText } from "$knowledge/api/shared/ingest/window-text";
import { markStale } from "$knowledge/api/shared/mark-stale";
import { advanceVersion, ensureVersion } from "$knowledge/api/shared/version";
import type { Embedding } from "$knowledge/types/embedding";
import type { WindowPiece } from "$knowledge/types/lattice-node";
import { sourceKey, type LatticeSource } from "$knowledge/types/lattice-source";

/** A source's text, and the revision the caller read it at. */
export type IngestRequest = {
  readonly source: LatticeSource;
  /** Empty when the caller cannot say. An unknown revision is never "unchanged". */
  readonly revision: string;
  readonly text: string;
};

export type IngestResult = {
  readonly skipped: boolean;
  readonly windows: number;
  readonly embedded: number;
  readonly reused: number;
  readonly staleMarked: number;
};

const SKIPPED: IngestResult = {
  skipped: true,
  windows: 0,
  embedded: 0,
  reused: 0,
  staleMarked: 0
};

const sourceRecord = async (ctx: MutationCtx, scope: Scope, source: LatticeSource) =>
  await ctx.db
    .query("latticeSources")
    .withIndex("by_project_source", (q) =>
      q.eq("projectId", scope.projectId).eq("source.kind", source.kind).eq("source.id", source.id)
    )
    .first();

const level0Nodes = async (ctx: MutationCtx, scope: Scope, source: LatticeSource) =>
  (
    await ctx.db
      .query("latticeNodes")
      .withIndex("by_tier_source", (q) =>
        q.eq("projectId", scope.projectId).eq("tierSourceId", sourceKey(source))
      )
      .collect()
  ).filter((node) => node.level === 0);

/**
 * Read one source into the lattice's level 0.
 *
 * The order is [the ingest
 * procedure](../../../../../../../docs/processes/lattice-clustering.md#ingest),
 * and every step of it exists to avoid work:
 *
 * 1. the caller supplies the text — reading a body is the resource's business
 * 2. an unchanged revision is skipped **before** the text is windowed
 * 3. window into overlapping spans
 * 4. reuse the vector of every content-addressed window that matches
 * 5. embed only what changed, in batches
 * 6. replace the source's windows
 * 7. rebuild the source tier, then 8. repair the corpus tier — not yet
 * 9. persist the source record
 *
 * **Attribution is absent on purpose.** A node is derived and never authored, so
 * there is nobody to attribute: the answer to "who wrote this" is the source it
 * was read out of, which every window names.
 */
export const ingest = async (
  ctx: MutationCtx,
  scope: Scope,
  request: IngestRequest,
  embedding: Embedding
): Promise<IngestResult> => {
  const { source, revision, text } = request;

  const record = await sourceRecord(ctx, scope, source);
  if (record && revision !== "" && record.revision === revision) return SKIPPED;

  // After the skip, because a drifted binding is not worth refusing over a
  // source that was going to be left alone anyway.
  const version = await ensureVersion(ctx, scope, embedding);

  const pieces: WindowPiece[] = windowText(text).map((window) => ({
    id: windowId(source, window.text),
    source,
    start: window.start,
    end: window.end,
    text: window.text
  }));

  // Bucketed rather than keyed one-to-one: the same text can be a whole window
  // twice in one source, and a map would lose the second node rather than
  // reuse it, leaving a row nothing ever deletes.
  const existing = await level0Nodes(ctx, scope, source);
  const spare = new Map<string, Doc<"latticeNodes">[]>();
  for (const node of existing) {
    const id = windowId(source, node.text ?? "");
    const bucket = spare.get(id);
    if (bucket) bucket.push(node);
    else spare.set(id, [node]);
  }

  const held = new Set(spare.keys());
  const vectors = await embedWindows(
    pieces,
    new Map([...spare].map(([id, [node]]) => [id, node.centroid])),
    embedding
  );

  // Every cluster above this source is built from windows that are about to be
  // replaced, so it is stale whether or not its own centroid moves. The level-0
  // nodes themselves are not: each one is either kept because its text did not
  // change, rewritten with a fresh vector, or gone.
  const at = Date.now();
  const parents = existing.map((node) => node.parentId).filter((id) => id !== undefined);
  const staleMarked = await markStale(ctx, scope, parents, at);

  for (const piece of pieces) {
    const windows = [{ source, start: piece.start, end: piece.end, density: 1 }];
    const reusable = spare.get(piece.id)?.shift();

    if (reusable) {
      // Same text, possibly a different place in the source. The vector is the
      // text's, so it stands; the offsets are not, so they are rewritten.
      await ctx.db.patch(reusable._id, { windows, updatedAt: at });
      continue;
    }

    const centroid = vectors.get(piece.id);
    if (!centroid) throw new Error(`No vector was produced for window ${piece.id}`);
    await ctx.db.insert("latticeNodes", {
      projectId: scope.projectId,
      level: 0,
      tierSourceId: sourceKey(source),
      clustered: false,
      windows,
      text: piece.text,
      centroid: [...centroid],
      updatedAt: at
    });
  }

  // Whatever no piece claimed is a window the source no longer has.
  for (const bucket of spare.values()) {
    for (const node of bucket) await ctx.db.delete(node._id);
  }

  // Steps 7 and 8 — the source tier and the corpus tier — are `api/cluster`,
  // and they run after this rather than inside it. The clusters above this
  // source are marked stale above; the pass that follows is what answers those
  // marks, and doing it here would make marking them pointless.

  await (record
    ? ctx.db.patch(record._id, { revision, windowCount: pieces.length, indexedAt: at })
    : ctx.db.insert("latticeSources", {
        projectId: scope.projectId,
        source,
        revision,
        windowCount: pieces.length,
        indexedAt: at
      }));

  await advanceVersion(ctx, version._id, {
    nodesByLevel: [await countLevel0(ctx, scope)],
    staleCount: version.staleCount + staleMarked
  });

  // Counted over distinct window ids, which is what the embedder was actually
  // asked for — two identical spans of one source are one embedding.
  const ids = new Set(pieces.map((piece) => piece.id));
  const reused = [...ids].filter((id) => held.has(id)).length;

  return {
    skipped: false,
    windows: pieces.length,
    embedded: ids.size - reused,
    reused,
    staleMarked
  };
};

/**
 * Counted rather than accumulated, because the lattice holds every source's
 * level-0 nodes and this one pass only knows about its own.
 */
const countLevel0 = async (ctx: MutationCtx, scope: Scope): Promise<number> =>
  (
    await ctx.db
      .query("latticeNodes")
      .withIndex("by_project_level", (q) => q.eq("projectId", scope.projectId).eq("level", 0))
      .collect()
  ).length;
