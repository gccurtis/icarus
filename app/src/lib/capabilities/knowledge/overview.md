# Knowledge

The project's content read into overlapping windows, embedded, and — eventually
— clustered into levels. This pass builds the bottom of that: windowing,
embedding, the level-0 nodes, and the one row per project that says what the
whole index is.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `status` | query | what this project's lattice is, or nothing |

Registered in
[`src/convex/capabilities/knowledge.ts`](../../../convex/capabilities/knowledge.ts),
built from `projectQuery`.

**Ingestion is deliberately not registered.** Embedding is a network call and a
Convex mutation cannot make one, so `ingest` is the transactional half of an
action whose outer half is the intelligence capability — which does not exist
yet. See [`api/api.md`](api/api.md).

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `latticeNodes` | level-0 windows now, clusters above them later: centroid, merged windows, parent |
| `latticeVersions` | one row per project: what built the index, how deep it is, whether it is coherent |
| `latticeSources` | what has already been read out of each source, and at which revision |

## No provider is wired, and that is stated rather than half-built

The `Embedder` is an injected function — `(texts: string[]) => Promise<number[][]>`.
The only implementation today is the deterministic fake in `test/fixture.ts`.

That is not a weakness in the tests. Every property this pass has to prove is
about the **algorithm** — that windows overlap, that an unchanged window keeps
its vector, that staleness reaches the top — and a fake with known geometry tests
those far better than a real model with unknown geometry would.

Wiring a real provider is separate work: it needs `configuration/intelligence.yaml`,
a provider client, and an action to call it from. None of it belongs in this
capability, which is why none of it is here.

## Capability Invariants

- **One `latticeVersions` row per project, enforced by one mutation.** Convex has
  no unique index. Two rows would be two answers to "what does this project
  know", with nothing to say which is right — so the write is a read-then-insert
  inside a serializable transaction, and it lives behind
  [`ensureVersion`](api/shared/shared.md) alone.
- **Every vector in a project comes from one embedding model.** Distances between
  vectors from two models are meaningless, so a repointed binding is refused
  rather than adopted. Detecting it is why both the binding and the model it
  resolved to are stored.
- **A window whose text is unchanged keeps its vector.** Window ids are
  content-addressed over `(source, text)`, so editing one paragraph re-embeds one
  paragraph. This is the property the whole ingest procedure is shaped around.
- **An unchanged source is skipped before it is windowed.** The revision is
  compared against `latticeSources` first, which is what makes "entirely" true
  rather than "except for the hashing".
- **`clustered` is stored, not derived from `parentId` being absent.** It is an
  index key: `by_project_clustered` is both the clustering pass's work queue and
  retrieval's frontier, asked at the start of every pass and every query.
  Building the most frequent question in the system on the *absence* of a field
  makes it the most expensive one.
- **Nodes are derived and never authored.** Nothing is written into the lattice
  directly and nothing is lost by discarding it, which is what makes
  re-windowing or re-embedding with another model an option rather than a
  data-loss event. It is also why no node carries an actor: the answer to "who
  wrote this" is the source every window names.

## `latticeSources` is a table the data models do not list

[The ingest procedure](../../../../../docs/processes/lattice-clustering.md#ingest)
has a source record in it — step 2 compares against it and step 9 persists it —
and nothing in
[knowledge-lattice.md](../../../../../docs/data-models/knowledge/knowledge-lattice.md)
holds one. Without it, "unchanged sources are skipped entirely" cannot be true:
deciding from the nodes alone means windowing and hashing the text first, which
is most of the non-embedding cost of ingesting it.

It is three fields and an index, and it is derived like everything else here — a
lost `latticeSources` row costs one redundant re-ingest, not correctness.

## The vector index pins one width for the deployment

A Convex vector index takes a literal `dimensions`, so `EMBEDDING_DIMENSIONS` in
[`schema.ts`](schema.ts) is fixed when the schema is written rather than chosen
per project. `latticeVersions.dimensions` is the per-project record of what
actually built that lattice, which is what makes a lattice built at another width
recognizable instead of silently mixed in.

## Related

[knowledge lattice](../../../../../docs/data-models/knowledge/knowledge-lattice.md) ·
[lattice version](../../../../../docs/data-models/revisions/lattice-version.md) ·
[lattice clustering](../../../../../docs/processes/lattice-clustering.md) ·
[intelligence](../../../../../docs/processes/intelligence.md)
