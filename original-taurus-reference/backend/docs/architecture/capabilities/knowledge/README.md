# Knowledge — the Text retrieval lattice

The `knowledge` capability maintains one generation-controlled Text lattice per
Project and returns verbatim grounded evidence. It embeds and retrieves; it does
not synthesize answers or own canonical Resource reads.

Deep dives:

- [Lattice](lattice.md) — windowing and KLR clique/DAG construction.
- [Retrieval](retrieval.md) — generation-consistent ranking and fail-closed
  evidence hydration.
- [Lifecycle](lifecycle.md) — embedding spaces, ordinary ingest, re-embedding,
  promotion, rollback, cursors, and persistence.

Production code lives in
[`core/capability/knowledge`](../../../../core/capability/knowledge). SQLite is
the durable adapter; `MemoryStore` is the isolated lifecycle implementation used
by tests.

## Current invariants

- A Text generation has one immutable `EmbeddingSpace`: provider, model,
  dimensions, normalization, vector format, schema version, and KLR algorithm.
- A Project has one active Text generation. Ordinary writes and queries resolve
  it before touching artifacts.
- Configuration drift never rewrites one source into a new space. Ordinary
  ingest returns `knowledge.embedding_space_change_required`; retained active
  retrieval targets its exact provider/model.
- All artifact tables are generation-keyed and accessed through a pinned view.
- Adds, replacements, and removals advance a durable source cursor; removal
  leaves a tombstone.
- A complete Project re-embed builds an isolated shadow generation with durable
  checkpoints and usage/cost receipts. Only an explicit owner command can
  promote it.
- Promotion and bounded rollback are atomic state-revision CAS operations with
  durable generation events.
- Retrieval ranks and hydrates under one read token, retries one race, and
  refuses missing/corrupt literal evidence.

## Ingest

```text
current authorized source stream
  → Ω-003 decoded-byte limits
  → sentence-aware overlapping windows
  → reuse unchanged vectors in the active generation
  → exact active-space embedding
  → KLR source ascent
  → exact artifact admission + source/cursor transaction
  → deferred corpus-tier rebuild
```

Sources may be Documents, Connector items, or text Attachments. Each window
carries its own literal text and origin block references, so citations never
depend on a mutable second copy of the source. Content-derived IDs are stable
across databases for the same pinned Project/origin/configuration.

## Retrieval

```text
active token + exact embedding space
  → query embedding
  → directed descent (exact fallback) or certification exact scan
  → generation-pinned source/window hydration
  → range/block/overlap/hash/vector validation
  → grounded regions + generation/hash/window provenance
  → token recheck
```

A result includes `generationId`, `sourceCursor`, `spaceIdentity`, mode, usage,
and regions. Each region includes `indexedRevision`, `generationId`,
`sourceHash`, and all contributing `windowIds` in addition to its literal text,
range, block references, relevance, and density.

## Ports and adapters

Knowledge declares:

- `Embedder`, `IdentityEmbedder`, and `ConfiguredSpaceReporter` for normal and
  exact-space provider calls;
- `ArtifactStore` for one generation-pinned lattice view;
- `GenerationStore` for active state, cursors, durable migrations,
  checkpoints, promotion/rollback, and events;
- `ReembedAuthorizer` and `ReembedSourceReader` for owner authorization and
  current canonical source acquisition; and
- `ResourceLocatorResolver` for mapping indexed origins into Resource-owned
  exact-read locators.

Wiring supplies Intelligence, Access, Resource, Document, Connector, Chat/File,
job, and SQLite adapters. Production readiness fails when a required port or
job handler is absent.

## Operator HTTP surface

The current endpoints remain under `/dev`:

| Method and path | Operation |
|---|---|
| `POST /dev/knowledge/documents/:documentID` | add/reconcile a Document |
| `DELETE /dev/knowledge/documents/:documentID` | remove a Document source |
| `POST /dev/knowledge/retrieve` | grounded retrieval |
| `POST /dev/knowledge/reembed/preview` | freeze target space and estimate work |
| `POST /dev/knowledge/reembed/runs` | idempotently start a shadow build |
| `GET /dev/knowledge/reembed/runs/:runID` | owner-only status |
| `POST .../:runID/pause` | request pause |
| `POST .../:runID/resume` | resume and enqueue |
| `POST .../:runID/cancel` | cancel without changing active |
| `POST .../:runID/promote` | explicit revision-CAS promotion |
| `POST /dev/knowledge/reembed/rollback` | revision-CAS bounded rollback |

The full request shapes and runbook are in
[the backend guide](../../../backend-guide.md#knowledge--grounded-retrieval-lattice-dev).

## Deliberate boundary

General Knowledge search remains project-scoped. Ω-009 owns requester-aware
Resource filtering for project reads and Agent evidence. Ω-016 owns automatic
Document-to-Text publication. Neither later contract is claimed by Ω-005.
