# Knowledge

The project's content read into overlapping windows, embedded, and clustered into
levels — each level a set of overlapping cliques over the one below.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `status` | query | what this project's lattice is, or nothing |
| `cluster` | mutation | one clustering pass: each source's forest, then the corpus tier |

Registered in
[`src/convex/capabilities/knowledge.ts`](../../../convex/capabilities/knowledge.ts).

**Ingestion and retrieval are deliberately not registered.** Both embed text, and
embedding is a network call a Convex function cannot make: each is the
transactional half of an action whose outer half is the intelligence capability,
which does not exist yet. Clustering has no such problem — it reads vectors that
are already stored. See [`api/api.md`](api/api.md).

**Both clustering paths are built.** A pool at or below `maxClusterPool` is
compared pair by pair; above it, an IVF search over a PCA projection picks which
pairs are worth comparing and every survivor is scored in full. The two produce
the same clusters wherever the search reaches every pair that matters, which is
what makes the exact path an oracle rather than a fallback — see
[`api/cluster/cluster.md`](api/cluster/cluster.md) for the two bounds on that.

**Retrieval walks what clustering built**: the frontier, then best-first descent,
then regions merged out of the windows it reached — see
[`api/shared/shared.md`](api/shared/shared.md). Nothing about a retrieval is
stored. It is a step in producing a
[message](../../../../../docs/data-models/core/message.md#research-steps-are-tool-calls)
and is recorded there as a tool call.

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `latticeNodes` | level-0 windows now, clusters above them later: centroid, merged windows, parent |
| `latticeVersions` | one row per project: what built the index, how deep it is, whether it is coherent |
| `latticeLevelIndexes` | the basis and cells one level was clustered through, for descent to narrow the frontier with |
| `latticeSources` | what has already been read out of each source, and at which revision |

## No provider is wired, and that is stated rather than half-built

The `Embedder` is an injected function — `(texts: string[]) => Promise<number[][]>`.
The only implementation today is the deterministic fake in `test/fixture.ts`.
Ingestion embeds windows through it and retrieval embeds the query through it.

That is not a weakness in the tests. Every property this pass has to prove is
about the **algorithm** — that windows overlap, that an unchanged window keeps
its vector, that a branch scoring poorly is never opened — and a fake with known
geometry tests those far better than a real model with unknown geometry would. A
query aimed at a named direction is a test that says what it is asking for;
finding a string that happens to hash near a cluster is not.

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
- **A cluster's identity is the hash of its sorted member ids**, and so is a
  window's over `(source, text)`. Neither is stored: a derived value written down
  can disagree with what it was derived from. Identity independent of order and
  of when clustering ran is what lets repair recognize an unchanged cluster
  instead of churning it.
- **Cliques overlap, so `members` is the truth about containment and `parentId`
  is one walk upwards.** A node held by two cliques has two holders and one
  parent — the first to claim it — because a field cannot name two and the
  hierarchy is written by one pass rather than edited.
- **The projection guides candidate selection and nothing else.** Every stored
  similarity, every edge weight, and every cohesion is a full-dimensional dot
  product. The projection decides which pairs are worth comparing; it never
  decides how similar they are. Approximation where it buys asymptotics,
  exactness where it affects answers.
- **A level's threshold is sampled from the pool, never from the candidate
  graph.** The graph holds each artifact's strongest neighbours, so a percentile
  over its edges would say how similar neighbours are rather than how similar
  "related" has to be — and the projection would be deciding adjacency after all.
  A stride sample of the pool's own pairs, scored in full, is what keeps the
  cutoff a property of the corpus on both sides of the crossover.
- **The same pool builds the same lattice every time.** Seeds are fixed, the
  projection samples by stride rather than at random, the pool is sorted by id
  before it is walked, and node ids hash their members. A lattice that reshuffled
  on every rebuild would make retrieval irreproducible and repair impossible to
  reason about.
- **A query's cost is bounded by `beam × maxExpansions`, independent of corpus
  size.** A cluster's centroid approximates its members, so a branch scoring
  poorly is never opened — a corpus ten times larger has more levels, and each
  level is one more hop rather than one more scan. That bound is the entire
  reason the hierarchy exists.
- **An empty descent returns an empty region list, and there is no fallback
  scan.** A query with no good answer says so, rather than returning the
  least-bad passages in the project — those read as answers and are not.
- **A region's text is verbatim, and its relevance is its best covering
  window's.** Whatever is quoted downstream must be what the source actually
  says, and a span holding one excellent passage should rank on that passage
  rather than be averaged down by the ordinary material merged alongside.
- **Scope filters after descent, and the source id is what it filters on.** A
  kind guides resolution and is carried as provenance; admission compares ids.
  Filtering afterwards has a
  [known cost](api/shared/shared.md#the-known-limitation) — a narrow scope can
  come back thin — and it is the price of one lattice rather than one per scope.
- **`latticeLevelIndexes` is entirely derived, and clustering never reads one.**
  `clusterLevel` takes no context, so it cannot; the rows are written for descent
  and can be dropped wholesale for the cost of a refit. That is what makes
  changing `pcaDims`, `k`, or the cell count a rebuild rather than a migration,
  and storing `threshold` and `k` beside the basis is what makes an index fitted
  under other parameters recognizable rather than silently mixed in.

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

## A basis is a large row, and at the pinned width it is too large

A basis is `pcaDims × dimensions` numbers. At `EMBEDDING_DIMENSIONS` of 1536 and
a `pcaDims` of 128 that is 196,608 float64s — about 1.5 MiB, over Convex's 1 MiB
document limit. A `pcaDims` of roughly 80 fits; so does splitting the basis
across rows.

Nothing reaches it today: no provider is wired, the widths that have run are the
test fixtures', and no project is near `maxClusterPool`. It is written down here
rather than fixed because both fixes are a trade — fewer projected dimensions
costs recall, more rows costs a read — and the number that decides it is the
corpus, which does not exist yet. `pcaDims` is
[configuration](../../../../configuration/knowledge.yaml) precisely so this is a
setting rather than a rewrite.

## Related

[knowledge lattice](../../../../../docs/data-models/knowledge/knowledge-lattice.md) ·
[lattice version](../../../../../docs/data-models/revisions/lattice-version.md) ·
[lattice clustering](../../../../../docs/processes/lattice-clustering.md) ·
[intelligence](../../../../../docs/processes/intelligence.md)
