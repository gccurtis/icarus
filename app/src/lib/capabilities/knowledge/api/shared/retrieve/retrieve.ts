import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import { admit } from "$knowledge/api/shared/retrieve/admit";
import { descend } from "$knowledge/api/shared/retrieve/descent";
import { frontier } from "$knowledge/api/shared/retrieve/frontier";
import { assembleRegions } from "$knowledge/api/shared/retrieve/regions";
import { resolveScope } from "$knowledge/api/shared/retrieve/scope-manifest";
import { embeddingDrift, readVersion } from "$knowledge/api/shared/version";
import { KnowledgeError } from "$knowledge/errors";
import type { Embedding } from "$knowledge/types/embedding";
import type { ReachedWindow, Retrieval, RetrievalRequest } from "$knowledge/types/retrieval";

/**
 * A query, walked down the lattice into the passages that answer it.
 *
 * The path is [lattice
 * retrieval](../../../../../../../../docs/processes/lattice-retrieval.md):
 *
 * 1. resolve the scope, once
 * 2. embed the query
 * 3. load the corpus frontier
 * 4. descend it, best-first
 * 5. load the windows that were reached
 * 6. keep the ones whose source the scope admits
 * 7. merge them into regions and admit what the budget affords
 *
 * **Scoping happens after descent, and that has a known cost** — a narrow scope
 * can come back thin, because the expansion budget is spent on globally stronger
 * out-of-scope branches before in-scope material is reached. It is the price of
 * one lattice; see [`shared.md`](../shared.md#the-known-limitation).
 *
 * **A project with no lattice answers with nothing**, rather than refusing: one
 * nobody has written in yet, and one whose first ingest has not run, are both
 * ordinary. A query embedded by another *model* is not — distances between
 * vectors from two models mean nothing — so that is refused.
 */
export const retrieve = async (
  ctx: QueryCtx,
  scope: Scope,
  request: RetrievalRequest,
  embedding: Embedding
): Promise<Retrieval> => {
  const version = await readVersion(ctx, scope);
  if (version && embeddingDrift(version, embedding)) {
    throw new KnowledgeError(
      "embedding-changed",
      `The '${embedding.binding}' binding now resolves to ${embedding.model}, but this lattice was built with ${version.embeddingModel} — rebuild it`
    );
  }

  // Before the lattice is read, so an answer from an empty project still says
  // what it was asked to search.
  const manifest = await resolveScope(ctx, scope, request.scope);
  if (!version) return { regions: [], scope: manifest };

  const [query] = await embedding.embed([request.query]);
  const reached = await descend(ctx, scope, query, await frontier(ctx, scope));

  const admissible = manifest ? new Set(manifest.sourceIds) : null;
  const windows: ReachedWindow[] = [];
  for (const [id, score] of reached) {
    const node = await ctx.db.get(id);
    const window = node?.windows[0];
    if (!node || !window || node.projectId !== scope.projectId) continue;
    // The source id is the authoritative membership key. The kind guided how the
    // scope resolved and never decides this.
    if (admissible && !admissible.has(window.source.id)) continue;

    windows.push({
      source: window.source,
      start: window.start,
      end: window.end,
      text: node.text ?? "",
      score
    });
  }

  return { regions: admit(assembleRegions(windows), request.limit), scope: manifest };
};
