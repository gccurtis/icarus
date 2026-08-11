# 0145 — The index is stored beside the tier

Persistence for the level index (record 0144): two tables, one port extension,
both stores. The repair-aware rebuild that produces and consumes the stored
indexes is the next increment; until it lands, `RebuildCorpus` passes nil and
the stored state stays truthful — no index, next rebuild is a full build.

## Shape

`knowledge_corpus_index` holds one row per level: the pinned threshold, k, and
the candidate machinery (projection basis and IVF centroids as float32
matrices — `encodeMatrix`, the vector codec with a shape prefix).
`knowledge_corpus_edges` holds one row per artifact per level: its IVF cell
and its packed edges (`[count u32]` then 16 raw id bytes + float32 similarity
per edge; lattice ids are 32 hex characters, and an id that is not is rejected
at write time so corruption fails loudly). A `(project_id, level, cell)` index
exists for the retrieval probe to read one cell instead of a project.

Derived state, so no backfill and no migration ceremony: absence means the
next rebuild builds in full — the same reasoning record 0138 applied to the
corpus tier itself.

## Two decisions that carry the semantics

**The index writes in the tier's transaction.** `RebuildCorpus` gained an
`indexes` parameter and replaces a project's rows wholesale beside the corpus
nodes and `built_seq`. Tier and index are computed from one frontier; separate
writes could leave them describing different ones, and no amount of repair
logic downstream can reconcile that.

**Invalidation does not drop the index.** A source write drops the corpus
*tier* because descent would follow it into dangling members. The *index* has
exactly one reader — the next rebuild — which diffs it against the live
frontier by artifact id. A stale index is not a hazard; it is precisely the
input a repair wants. (Stable artifact ids, record 0140, are what make that
diff meaningful.)

## Verification

Round-trip tests on both stores pin the semantics to each other: exact
round trip (the fixtures use float32-exact values so equality is equality,
not tolerance), wholesale replacement, nil clears, corrupt edge id rolls the
whole write back, and — MemoryStore — invalidation keeps the index while
dropping the tier.
