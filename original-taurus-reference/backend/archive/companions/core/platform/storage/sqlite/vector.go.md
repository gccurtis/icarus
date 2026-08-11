# `vector.go`

How embeddings and centroids are stored: fixed-width little-endian float32,
rather than the JSON text they used to be.

## The measurement that justified the migration

A storage-format change is expensive enough that it should not be done on a
hunch. `BenchmarkVectorDecodeJSON` / `BenchmarkVectorDecodeBlob` at 1536
dimensions:

| | JSON | float32 BLOB | |
|---|---|---|---|
| decode | 252,314 ns | 4,342 ns | **58×** |
| encode | 107,982 ns | 2,787 ns | 39× |
| allocations | 16 / 39.7 KB | 1 / 12.3 KB | |
| stored size | ~32 KB | 6.1 KB | 5.3× |

The gap matters because vectors are not read occasionally. The frontier is
decoded on every corpus rebuild **and on every retrieval query** (`descend` calls
`EntryFrontier` per query), so at a 200,000-entry frontier the JSON path spent
roughly 50 seconds parsing decimal strings before computing a single similarity.

## The format is deliberately language-agnostic

Raw IEEE 754 binary32, explicitly little-endian, no header and no framing —
the layout numpy calls `<f4`. The bytes are readable without a Go runtime and
without a schema:

| language | read it with |
|---|---|
| Python | `np.frombuffer(blob, dtype='<f4')` |
| JavaScript | `new Float32Array(buf)` / `DataView.getFloat32(i, true)` |
| Rust | `f32::from_le_bytes` |
| Java | `ByteBuffer.order(LITTLE_ENDIAN).asFloatBuffer()` |
| C | `memcpy` into `float[]` |

The endianness is **pinned rather than native** for exactly that reason: native
order makes stored bytes correct only on the machine that wrote them, which is
not a property a durable format may have. The same reasoning rules out Go's own
encodings (`gob`) — leaving embeddings readable by ordinary vector tooling is
worth more than the convenience.

There is no version header. The dimension is recoverable as `len(blob)/4`, and
`Source.Identity` already records it independently, so a header would carry
nothing not already knowable. A format that later needs one gets a new column.

## Code breakdown

### `encodeVector` / `decodeVector`

The codec. float32 rather than float64 because these are unit vectors compared
by cosine similarity, which needs nowhere near 15 significant digits — a round
trip moves a dot product by less than 1e-7
(`TestFloat32RoundTripPreservesCosine`), orders below any threshold the lattice
compares against. Halving the width halves the read.

### `encodeMatrix` / `decodeMatrix`

The same float32 convention with a `[rows u32][cols u32]` shape prefix, so a
projection basis or an IVF centroid set travels as one BLOB
(`knowledge_corpus_index`). nil and empty matrices encode as nil, and a
malformed header decodes as nil rather than panicking on a short buffer.

### `decodeStoredVector`

Reads a vector from a row that may predate the BLOB column: the BLOB when
present, the legacy JSON otherwise.

It exists for two windows — between a database being opened and its backfill
completing, and for whatever rows a failed backfill left behind. Preferring the
BLOB means a converted row never pays the JSON cost again, and the fallback means
a half-migrated database is never unreadable.

The backfill itself lives in `sqlite_migrate.go`, and is resumable for the same
reason: embeddings cost real provider tokens, so unlike the node table (which is
dropped and recomputed when its shape changes) they are migrated in place.
