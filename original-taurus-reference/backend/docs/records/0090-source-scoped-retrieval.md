# Source-scoped retrieval (live-document Slice C)

The third slice of the live-document program (design:
[`docs/superpowers/specs/2026-07-26-live-document-connectors-design.md`](../superpowers/specs/2026-07-26-live-document-connectors-design.md);
plan: [`docs/superpowers/plans/2026-07-26-source-scoped-retrieval.md`](../superpowers/plans/2026-07-26-source-scoped-retrieval.md)).
It gives the knowledge lattice a retrieval path that ranks a query **only within a
caller-supplied set of sources**, the primitive a per-block context scope needs.

## What changed

- **`Origin{SourceType, SourceID}`** — the public addressing of a source, the pair
  a caller knows before the lattice's internal `LocalRefID`.
- **`windowsForOrigins`** (unexported) resolves each allowed origin to its source
  (via the existing `SourceByOrigin`) and loads just that source's windows (via
  `SourceWindows`), deduped, skipping origins that are not registered. It never
  reads any other source's windows.
- **`RetrieveScopedMany(ctx, projectID, queries, topK, allow []Origin)`** ranks the
  queries **only** within the allowed sources' windows, reusing the exact
  rank-and-merge path (`poolRankings` → `regionsFor`) and **bypassing directed
  descent** — the candidate set is already bounded to the scope, so there is
  nothing to walk. An empty allow-set returns no regions; the same-identity guard
  as the unscoped path still refuses cross-embedding-space comparison.

## Why this shape

The `includes − excludes` math and its use by prompt resolution are deliberately
**not** here — they belong to the document context model (Slice E), which will call
this with an already-resolved allow-set. Keeping the knowledge capability's job to
"rank only within these sources" keeps it independent of how a block chooses its
scope. This also supersedes the inert per-source-revision staleness plumbing: the
reference graph (Slice F) keys off a block's resolved scope instead.

## Tests

- Unit (`core/capability/knowledge`, fake embedder): two connector sources with
  distinct vocab; scoping to source B and querying about source A's topic returns
  regions **only** from B (membership, not relevance, is the assertion); an empty
  allow-set returns no regions; an unknown origin contributes nothing (not an
  error). Ranking *quality* remains the live knowledge suite's concern; *scoping*
  is deterministic plumbing.

## Settled

- Retrieval can be scoped to an explicit allow-set of `(sourceType, sourceID)`
  origins, ranking only within them. ✓
- Empty scope → no regions; unknown origins are skipped. ✓
- Entirely within `knowledge`; no cross-capability import; no store change (reuses
  `SourceByOrigin` + `SourceWindows`). ✓
- Underpins acceptance criterion 5. The `includes − excludes` resolution and
  prompt usage are Slice E.
