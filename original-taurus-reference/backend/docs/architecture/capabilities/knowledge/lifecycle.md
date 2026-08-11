# Knowledge embedding-space and source lifecycle

Knowledge owns one Text lattice per Project. Its correctness boundary is not
just a provider/model pair: it is an immutable embedding space inside an
immutable lattice generation.

This document is the as-built Ω-005 contract. Windowing and clustering remain
described in [lattice.md](lattice.md); generation-consistent query behavior is
in [retrieval.md](retrieval.md).

## Canonical identity

`EmbeddingSpace` contains every property required to compare or interpret a
vector:

```go
type EmbeddingSpace struct {
    Provider      string
    Model         string
    Dimensions    int
    Normalization string // unit-l2
    VectorFormat  string // float32-le
    SchemaVersion int    // 1
    Algorithm     string // klr-text-v1
}
```

Its identity is SHA-256 over canonical struct JSON. A generation stores that
identity once; sources retain the corresponding provider/model/dimension stamp
for local integrity checks. Changing any field creates a different space.

`LatticeGeneration` is Project- and kind-scoped and moves through
`building → validating → ready → active → retired` (or `failed`). The
`ProjectLatticeState` row contains the sole active pointer, previous rollback
pointer, CAS revision, and monotonic source cursor.

## Ordinary ingest

Every ordinary add, replacement, or removal resolves the active Text generation
first and uses a generation-pinned `ArtifactStore` view.

```text
resolve active token + EmbeddingSpace
  → compare configured provider/model with active space
  → stream and bound current source
  → reuse only vectors from the pinned generation
  → embed/validate exact active identity
  → exact artifact admission
  → publish source artifacts + cursor event atomically
```

Configuration drift returns
`knowledge.embedding_space_change_required` before a no-op skip. It does not
rewrite one source under the new model. Queries continue to target the retained
active space through the exact provider/model adapter.

The first source in a new Project freezes generation 1 after its first valid
embedding response. Concurrent first writers converge through
`EnsureActive`; content-derived source/window/node IDs remain reproducible, and
generation isolation comes from composite persistence keys rather than ID salt.

The Ω-003 byte and artifact limits remain authoritative. Each committed source
slice advances the cursor once per add/update. A successful removal appends a
durable tombstone and advances it too. No-op syncs and removing an absent source
do not advance the cursor.

## Generation-pinned persistence

All seven artifact tables include `generation_id` in their primary or unique
key:

- `knowledge_sources`
- `knowledge_windows`
- `knowledge_nodes`
- `knowledge_memberships`
- `knowledge_corpus_state`
- `knowledge_corpus_index`
- `knowledge_corpus_edges`

Every artifact read/write is issued through `ForGeneration(id)`, whose SQL is
always generation-filtered. The lifecycle root owns active-pointer, cursor,
preview/run/checkpoint, promotion, rollback, and event transactions.

Startup migrates the old schema in one transaction. A legacy Project becomes a
deterministic generation 1 only when all sources have one valid identity and
every vector has the certified width. A mixed, malformed, or dimension-invalid
Project is retained as `reembed_required`; it is not queryable or writable
through the ordinary path, but `ReembedBase` exposes its source manifest to the
authorized repair workflow.

## Operator-controlled re-embedding

Only a current Project owner may preview, start, inspect/control, promote, or
roll back. Workers repeat that authorization and reauthorize each current
Resource before reading it. Source bytes and credentials are never put in logs.

The lifecycle is:

```text
preview
  → freeze target space, source cursor, state revision, policy, expiry
start(idempotency key)
  → durable run + isolated building generation
worker
  → current authorized source snapshots
  → source-by-source bounded embed + atomic checkpoint/usage receipt
  → catch up additions, replacements, removals
  → exact count, identity, graph, evidence, and budget validation
ready
  → explicit owner promotion
  → one CAS pointer change + retired rollback pointer + event
```

There is no automatic promotion. `pause`, `resume`, and `cancel` are durable run
controls. Completed checkpoints are idempotent by source revision/hash, so a
retry neither republishes nor double-counts usage.

The run records bytes, vectors, prompt/total tokens, provider request count, and
provider-reported USD cost. Preview limits are advisory estimates; the worker
enforces hard source, byte, vector, prompt-token, request, and cost ceilings
after each durable checkpoint. An over-budget run becomes `failed`; the active
pointer never changes, while its spend receipt remains auditable.

At process startup `RecoverReembeds` changes interrupted
`running`/`validating` runs back to `queued`, settles `pausing` as `paused`, and
re-enqueues queued domain work. Generic job rows are wakeups; the Knowledge run
and checkpoints are the durable correctness authority.

## Validation and promotion

Before a run becomes `ready`, Knowledge proves:

- the final current manifest and completed checkpoint set agree exactly;
- every source has the frozen target identity and current revision/hash;
- every window is present, finite, dimension-correct, range-valid, and carries
  literal text of exactly `end-start` bytes;
- source block spans and window block references reconcile;
- every graph member resolves to exactly one window or lower-level node;
- node levels, counts, centroids, and membership edges are valid;
- exact source/window/node/artifact counts reconcile and remain within Ω-003;
- deterministic self-probes produce grounded evidence; and
- the source cursor did not move during the final validation transaction.

Promotion reauthorizes the owner and atomically compares the state revision and
source cursor, flips the active pointer, retires the old complete generation,
and writes a `promoted` generation event. A pointer change invalidates retrieval
tokens and `ChangedSince` consumers even though it does not invent a source
change.

## Rollback

The previous complete generation is retained for seven days. Rollback is
another owner-authorized revision CAS and writes a `rolled_back` event. It is
allowed only when:

- the rollback TTL has not expired;
- the previous generation is still complete and retired; and
- no source cursor change has occurred since promotion.

That final rule prevents rollback from silently discarding an ordinary add,
replacement, or removal made after promotion. Artifact garbage collection after
the recovery window is deliberately separate; no in-place destructive rewrite
is part of promotion.

## Stable failures

The operator and retrieval surfaces preserve these typed codes:

- `knowledge.embedding_space_unavailable`
- `knowledge.embedding_space_change_required`
- `knowledge.generation_conflict`
- `knowledge.reembed_preview_stale`
- `knowledge.reembed_incomplete`
- `knowledge.reembed_validation_failed`
- `knowledge.reembed_source_changed`
- `knowledge.reembed_cancelled`
- `knowledge.rollback_expired`
- `knowledge.evidence_changed`
- `knowledge.evidence_corrupt`

The dev operator handlers map them to stable JSON bodies without source content,
provider secrets, or hidden-resource details.

## Certification

The deterministic connector fixture pins Project, Connector, source, embedding,
and algorithm configuration identities over 64 sources. Its certified lattice
hash is:

```text
a103d414b6c0e0c89f1784cc44c3a383598d269cfe3fa010e6e7e99a2ed94bac
```

Memory and SQLite lifecycle suites cover generation isolation, cursor
tombstones, crash recovery, checkpoint idempotency, hard-budget failure,
promotion, rollback, outbox events, and migration quarantine. The live
Knowledge suites remain the quality oracle when an OpenRouter credential and
the optional scale corpus are available; they report token usage and estimated
cost rather than hiding provider spend.
