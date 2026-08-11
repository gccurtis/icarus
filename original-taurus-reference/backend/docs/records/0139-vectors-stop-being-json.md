# 0139 — Vectors stop being JSON

Embeddings and centroids were stored as JSON text, so every read re-parsed
decimal strings back into floats. The plan called this out as a suspected cost
and required it be *measured* before a storage migration, since arithmetic is not
evidence.

## The measurement

`BenchmarkVectorDecodeJSON` / `BenchmarkVectorDecodeBlob`, 1536 dimensions,
values at full float64 precision (round numbers would flatter the JSON path in a
way real embeddings never do):

| | JSON | float32 BLOB | |
|---|---|---|---|
| decode | 252,314 ns | 4,342 ns | **58×** |
| encode | 107,982 ns | 2,787 ns | 39× |
| allocations | 16 / 39.7 KB | 1 / 12.3 KB | |
| stored size | ~32 KB | 6.1 KB | 5.3× |

Comfortably past the bar. The estimate going in was "significant"; 58× is more
than that, and the reason is the one that matters: the frontier is decoded on
every corpus rebuild **and on every retrieval query** — `descend` calls
`EntryFrontier` per query. At a 200,000-entry frontier that is ~50 seconds of
pure number parsing before a single similarity is computed. Even at 4,000 it is
about a second per query.

## float32, and why that is safe

These are unit vectors compared by cosine similarity, which needs nowhere near 15
significant digits. A round trip moves a dot product by less than 1e-7
(`TestFloat32RoundTripPreservesCosine`), orders of magnitude below any threshold
the lattice compares against — the clustering floor is 0.30 and descent's is
0.35. Halving the width halves the read.

## The format is deliberately language-agnostic

Raw IEEE 754 binary32, explicitly little-endian, no header, no framing — the
layout numpy calls `<f4`. `np.frombuffer(blob, dtype='<f4')`,
`new Float32Array(buf)`, `f32::from_le_bytes`, `ByteBuffer.order(LITTLE_ENDIAN)`
all read it directly.

The endianness is pinned rather than native because native order makes stored
bytes correct only on the machine that wrote them, which is not a property a
durable format may have. The same reasoning rules out Go's own `gob`: leaving
embeddings readable by ordinary vector tooling is worth more than the
convenience, particularly with an approximate-nearest-neighbour index coming
that will want exactly this layout.

No version header. The dimension is `len(blob)/4` and `Source.Identity` already
records it, so a header would carry nothing not already knowable. A format that
later needs one gets a new column.

## Migrated, not dropped

Record 0134's schema notes explain why the node table is *dropped* when its shape
changes: the lattice is a projection, so letting the next add rebuild it is
cheaper and safer than a structural migration.

Embeddings are the exception. They cost real provider tokens, so
`backfillVectorBlobs` converts them in place.

It is **resumable rather than transactional**: each row converts on its own, and
`decodeStoredVector` prefers the BLOB while falling back to the legacy JSON. A
run that dies partway leaves converted rows converted and the rest readable, and
the next startup finishes. That also makes running it on every startup safe — it
selects only rows whose BLOB is still NULL.

A row whose JSON will not parse is skipped, not fatal. It is already unusable,
and failing startup over it would let one corrupt vector take down the server.

The legacy columns are not dual-written. Keeping both in step would double every
write to serve a read path that exists only for rows predating the BLOB column.

## Logging, and a gap it closed

The rebuild now reports what it cost, timed in two halves:

```text
info: knowledge: rebuilt the corpus tier for project 3e99… — 1 frontier entries
      in 1ms (load 1ms, cluster 0s), 0 node(s)
```

Split because the halves fail differently and are fixed differently: loading is
I/O plus vector decoding and grows linearly with the frontier; clustering is the
O(F²) ascent. One combined number would only ever say "slow".

It also closed a verification gap left open by record 0138. The job pool logs
nothing on success and retrieval degrades gracefully without a corpus tier, so a
rebuild that never fired was indistinguishable from one that ran — the live
suites passed either way. This line appearing in a live run is direct evidence
the enqueue → worker → handler chain works end to end.
