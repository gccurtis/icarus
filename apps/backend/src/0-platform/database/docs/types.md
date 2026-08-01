# Database types and schema

## Port values

[`SQLiteKnowledgeStore`](../knowledge-store.ts) implements [`KnowledgeStore`](../../knowledge/store.ts) and persists types from [`knowledge/types.ts`](../../knowledge/types.ts).

| Domain type | Stored in | Encoding notes |
| --- | --- | --- |
| `SourceRecord` | sources | Dates stored with `toISOString()` and reconstructed with `new Date()` |
| `KnowledgeWindow` | windows | `start`/`end` stored in columns named `start_byte`/`end_byte`; vectors JSON-stringified |
| `KnowledgeNode` | nodes | absent `sourceId` stored as SQL `NULL`; centroid/member IDs JSON-stringified |
| `FrontierEntry` | frontier | vector JSON; boolean stored as integer 0/1 |
| `StoredLevelIndex` | level indices | whole object JSON-stringified into one `data` column |

Despite the column names, Knowledge currently supplies JavaScript string character offsets, not UTF-8 byte offsets.

## Physical schema

Every name below is prefixed with `kn_<projectHash>_`.

### `sources`

| Column | SQLite declaration | Domain field |
| --- | --- | --- |
| `source_id` | `TEXT PRIMARY KEY` | `sourceId` |
| `label` | `TEXT NOT NULL` | `label` |
| `revision` | `TEXT NOT NULL DEFAULT ''` | `revision` |
| `window_count` | `INTEGER NOT NULL DEFAULT 0` | `windowCount` |
| `size_bytes` | `INTEGER NOT NULL DEFAULT 0` | `sizeBytes` |
| `added_at` | `TEXT NOT NULL` | `addedAt` |
| `synced_at` | `TEXT NOT NULL` | `syncedAt` |

### `windows`

| Column | SQLite declaration | Domain field |
| --- | --- | --- |
| `id` | `TEXT PRIMARY KEY` | `id` |
| `source_id` | `TEXT NOT NULL` | `sourceId` |
| `label` | `TEXT NOT NULL` | `label` |
| `ordinal` | `INTEGER NOT NULL` | `ordinal` |
| `start_byte`, `end_byte` | `INTEGER NOT NULL` | `start`, `end` |
| `text` | `TEXT NOT NULL` | `text` |
| `embedding` | `TEXT NOT NULL` | JSON `number[]` |

Index: `windows_source(source_id)`.

### `nodes`

| Column | SQLite declaration | Domain field |
| --- | --- | --- |
| `id` | `TEXT PRIMARY KEY` | `id` |
| `source_id` | `TEXT` | `sourceId`; null denotes corpus tier |
| `level` | `INTEGER NOT NULL` | `level` |
| `centroid` | `TEXT NOT NULL` | JSON `number[]` |
| `count` | `INTEGER NOT NULL` | `count` |
| `cohesion` | `REAL NOT NULL` | `cohesion` |
| `member_ids` | `TEXT NOT NULL` | JSON `string[]` |

Index: `nodes_source(source_id)`.

### `frontier`

| Column | SQLite declaration | Domain field |
| --- | --- | --- |
| `id` | `TEXT PRIMARY KEY` | `id` |
| `vector` | `TEXT NOT NULL` | JSON `number[]` |
| `is_window` | `INTEGER NOT NULL` | `isWindow` (`1` means true) |

### `level_indices`

| Column | SQLite declaration | Domain field |
| --- | --- | --- |
| `level` | `INTEGER PRIMARY KEY` | `StoredLevelIndex.level` |
| `data` | `TEXT NOT NULL` | Entire `StoredLevelIndex` JSON |

## Internal row types

`RawSource`, `RawWindow`, `RawNode`, and `RawFrontier` model driver rows. `rowToSource`, `rowToWindow`, and `rowToNode` map them to domain values. Frontier mapping is inline in `getFrontier`; the stored level index is asserted after `JSON.parse` without structural validation.

## Serialization helpers

| Helper | Encoding |
| --- | --- |
| `serializeVec` / `deserializeVec` | JSON `number[]` |
| `serializeIds` / `deserializeIds` | JSON `string[]` |

Deserialization uses TypeScript assertions only. Invalid JSON throws; valid JSON of the wrong shape passes through at runtime.

## Schema constraints not present

The current tables do not declare:

- foreign keys or cascades;
- unique `(source_id, ordinal)` window positions;
- checks for nonempty IDs/labels;
- nonnegative counts, sizes, offsets, or levels;
- `end >= start`;
- valid JSON checks;
- `is_window IN (0, 1)`;
- cohesion bounds.

Those values are expected to be valid because the Knowledge runtime constructs them. Direct database writes are not protected by equivalent SQL constraints.
