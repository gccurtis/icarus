# General Files

*Verified against source at commit ef6d462, 2026-08-09.*

General Files stores whole files that the project owns directly — as opposed to Connector, which
points at files the project does *not* own. Identity is the content itself:
`id = sha256(content)`, so uploading the same bytes twice yields one row and one identity. Files
whose extension is on the capability's prose allowlist are admitted to the Knowledge lattice;
everything else is stored opaquely and never indexed. There is no patch operation — `update`
replaces a file wholesale with a new content-addressed identity and links the two together through
history.

---

## 1 · At a glance

| | |
| --- | --- |
| **Shape** | Layered — `domain/ application/ ports/ persistence/`. No `wire/`, no `projections/` |
| **Endpoints** | **6**, all `POST`, all `responseMode: "inline"` (4 serial, 2 concurrent) |
| **DB file** | `./data/general-files.db` — cwd-relative, opened at [`1-init/create/generalFiles.ts:6`](../../../apps/backend/src/1-init/create/generalFiles.ts) |
| **Tables** | **2** — `gf_<p>_files`, `gf_<p>_history` (`p = sha256(projectId).hex.slice(0,16)`) |
| **Revision model** | Content-addressed id + `nextRevisionAfterHistory`. A brand-new hash starts at 1; a hash whose identity was deleted but not purged resumes at `MAX(history revision)+1`; after purge it returns to 1. Replacement archives the old identity with `replacedById` patched in and tombstones it |
| **Tests** | [`test/capabilities/general-files.test.ts`](../../../apps/backend/test/capabilities/general-files.test.ts) — 291 lines, **11 tests**, all passing |
| **Source** | **6 files / 871 lines** in the capability directory; plus wiring `registerGeneralFileEndpointMappings.ts` (135) and factory `create/generalFiles.ts` (14) |
| **Config** | None. General Files has no section in `etc/configuration.yaml` and no entry in `BackendConfig`. **There is no size limit anywhere** |
| **Module docs** | `src/3-capabilities/general-files/docs/` — six files, 611 lines. Accurate; two small imprecisions noted in §8 |
| **Status** | Complete and wired. No known correctness defect. The gaps are absent limits, an unused exported type, and a line-splitting divergence it shares with Connector |

Per-file sizes:

| File | Lines |
| --- | ---: |
| `application/generalFileService.ts` | 385 |
| `persistence/sqliteGeneralFileRepository.ts` | 331 |
| `domain/model.ts` | 79 |
| `ports/repository.ts` | 40 |
| `index.ts` | 20 |
| `domain/errors.ts` | 16 |

---

## 2 · Domain model

### 2.1 Content-addressed identity

[`generalFileService.ts:26-28`](../../../apps/backend/src/3-capabilities/general-files/application/generalFileService.ts):

```ts
function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
```

`const contentHash = hashContent(content); const id = contentHash;`
(`generalFileService.ts:154-155`). Identity depends on **content and nothing else** — not the
filename, not the extension, not the uploader, not the time. Three SQL constraints hold the
invariant from the other side
([`sqliteGeneralFileRepository.ts:29-30, 39-40, 49`](../../../apps/backend/src/3-capabilities/general-files/persistence/sqliteGeneralFileRepository.ts)):

```sql
CHECK (length(id) = 64 AND id NOT GLOB '*[^0-9a-f]*')
CHECK (length(content_hash) = 64 AND content_hash NOT GLOB '*[^0-9a-f]*')
CHECK (content_hash = id)
```

Byte size is `Buffer.byteLength(content, "utf8")` (`generalFileService.ts:174`), cross-checked in
SQL by `CHECK (byte_size = length(CAST(content AS BLOB)))` (`:48`).

Knowledge source id is `general-file:${id}` for text-kind files and `null` for everything else
(`generalFileService.ts:185, 288`).

### 2.2 `GeneralFileKind` — a two-arm union

`domain/model.ts:14`: `"general::file::text" | "general::file::other"`.

Classification is a single function (`domain/model.ts:16-18`):

```ts
export function kindFromExtension(ext: string): GeneralFileKind {
  return PROSE_TEXT_EXTENSIONS.has(ext) ? "general::file::text" : "general::file::other";
}
```

Extension extraction lives in the *service*, not the model (`generalFileService.ts:142-143`):
`lastIndexOf(".")`, `slice(lastDot + 1)`, `toLowerCase()`. No dot → `""`; a trailing dot → `""`;
both classify as `other`. A leading-dot dotfile such as `.gitignore` yields the extension
`gitignore` → `other`. `general-files.test.ts:90` pins the extensionless case.

### 2.3 `GeneralFile`

`domain/model.ts:20-47`. Every field is `readonly`.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | *"Content-addressed: SHA-256(content), hex-encoded."* |
| `kind` | `GeneralFileKind` | derived from the extension at upload; **never recomputed on update** |
| `fileName` | `string` | the filename of the **first** upload of these bytes |
| `extension` | `string` | lowercased; may be `""` |
| `content` | `string` | *"Full UTF-8 transport string. Text-kind content is prose; other-kind content is opaque and may, by caller convention, contain base64."* |
| `byteSize` | `number` | UTF-8 byte length of `content` |
| `contentHash` | `string` | equals `id` |
| `revision` | `number` | ≥ 1 |
| `knowledgeSourceId` | `string \| null` | `general-file:<id>` for text kind |
| `replacesId?` | `string` | set on a current row only by the replace branch |
| `replacedById?` | `string` | **never set on a current row** — see §5.3 |
| `createdAt`, `updatedAt` | `string` | ISO-8601 |

### 2.4 Request and result types — both unions enumerated in full

`domain/model.ts:49-65`:

```ts
export interface GeneralFileUploadRequest { fileName: string; content: string; }
export interface GeneralFileUpdateRequest { content: string; }

export type GeneralFileUploadResult =
  | { kind: "created"; file: GeneralFile; knowledge?: AddResult }
  | { kind: "reused";  file: GeneralFile; message: "identical content already exists" };

export type GeneralFileUpdateResult =
  | { kind: "updated";   file: GeneralFile; knowledge?: AddResult }
  | { kind: "unchanged"; file: GeneralFile; message: "new content identical to current" };
```

The two `message` values are **string literal types**, not free text — they are the exact wire
strings a client receives, and changing either is a type-level breaking change.

`GeneralFilesListRequest = { filters?: GeneralFileFilter[] }` (`domain/model.ts:76-79`) is exported
from the barrel and **constructed nowhere** (§8).

### 2.5 `GeneralFileFilter` — a five-arm union

`domain/model.ts:69-74`:

| Arm | SQL clause |
| --- | --- |
| `{ kind: "by-kind"; value: GeneralFileKind }` | `kind = ?` |
| `{ kind: "by-extension"; value: string }` | `extension = ?` |
| `{ kind: "by-name-contains"; value: string }` | `file_name LIKE ? ESCAPE '\'` with `%term%` |
| `{ kind: "by-name-starts-with"; value: string }` | `file_name LIKE ? ESCAPE '\'` with `term%` |
| `{ kind: "by-name-ends-with"; value: string }` | `file_name LIKE ? ESCAPE '\'` with `%term` |

Clauses are joined with `" AND "` and the result is always `ORDER BY created_at DESC`
(`sqliteGeneralFileRepository.ts:125-168`). An **unknown `filter.kind` falls through the `switch`
and is silently ignored** — no clause is added and no error is raised.

### 2.6 The prose allowlist

`domain/model.ts:8-12` — nine extensions: `txt, md, markdown, rst, org, tex, html, htm, log`.
This set is byte-for-byte the same as Connector's. The duplication is a decision, not an oversight;
both comments are quoted in §7.

### 2.7 Errors

`domain/errors.ts` — exactly two classes, 16 lines, no trailing newline:

| Class | `code` | Message |
| --- | --- | --- |
| `GeneralFileNotFoundError` | `not_found` | `General file not found: ${id}` |
| `GeneralFileEncodingError` | `encoding_error` | caller-supplied |

**There is no stale-revision error** because `update` carries no `expectedRevision`. There is no
validation error class either, so `GeneralFileEncodingError` does double duty: it is thrown for a
blank `fileName` and a non-string `content` (`generalFileService.ts:133-138, 218-220`) as well as
for genuine UTF-8 failures. A client that sends `{}` to `/general-files/upload` receives
**400 `encoding_error`, "fileName must be a non-empty string"**.

---

## 3 · Operations

`GeneralFileService` (`generalFileService.ts:45-54`) — eight methods:

| Method | Sync? | What it does |
| --- | :-: | --- |
| `upload(request)` | async | Validate → classify → hash → reuse-if-present → admit to Knowledge → insert |
| `update(id, request)` | async | Wholesale replacement; three branches (§3.3) |
| `get(id)` | **sync** | Full row **including `content`**; throws `GeneralFileNotFoundError` |
| `list(filters?)` | **sync** | `Omit<GeneralFile,"content">[]` — the mapper strips content at `sqliteGeneralFileRepository.ts:87-91` |
| `delete(id)` | async | Remove from Knowledge, then archive + tombstone + delete the row |
| `purge(id)` | async | Erase the history series; `"current"` → 409, `"missing"` → 404 |
| `pruneHistory(cutoff)` | **sync** | Retention port half |
| `purgeExpired(cutoff)` | **sync** | Retention port half |

### 3.1 `upload`

1. `fileName` must be a non-empty trimmed string; `content` must be a string
   (`generalFileService.ts:133-138`).
2. Extract the extension; `kindFromExtension`.
3. **Text-kind content must round-trip through `Buffer`** (`:149-151`); other-kind content is never
   validated.
4. `contentHash = sha256(content)`; `id = contentHash`.
5. `store.getByHash(contentHash)` — if a current row exists, take **the reuse path** (§3.2).
6. Build the row with `revision: store.nextRevision(id)`.
7. `admitToKnowledge(file)` **then** `store.insert(file)` — in that order
   (`generalFileService.ts:190-194`).
8. If `insert` throws: re-read by id. If a concurrent writer won, return `{kind:"reused"}`
   (`:196-199`). Otherwise remove the source that was just admitted and rethrow.

`general-files.test.ts:156`, *"a failed Knowledge admission leaves no active file and can be
retried"*, pins step 7/8.

### 3.2 The reuse path

`generalFileService.ts:158-171`. When the hash already has a current row the call does **not**
create anything. It re-admits to Knowledge first:

```
        // Upsert into Knowledge as a cheap self-heal for records left behind by
        // an earlier failed ingestion. Matching revisions are skipped.
```

The self-heal is cheap because `Knowledge.add` is called with `revision: file.contentHash`
(`generalFileService.ts:70`) and Knowledge skips a matching revision. Then it logs
`general-files.upload.reused` and returns:

```ts
return { kind: "reused", file: existing, message: "identical content already exists" };
```

Three consequences a caller must know:

- **The returned `file` is the existing row, with its original `fileName`.** Uploading the same
  bytes under a different name renames nothing and creates nothing.
- Because `fileName` and therefore `extension` and `kind` come from the *first* upload,
  `report.md` uploaded first and then `report.bin` with identical bytes leaves one row of kind
  `general::file::text`.
- The same self-heal fires on `update` when the new content hashes identical to the current one
  (`generalFileService.ts:229-237`), which returns `{kind:"unchanged"}` and writes nothing to
  SQLite.

There is a **second** reuse path — the concurrent-writer arbitration in `upload`'s failure handler
(`:195-202`), where the primary key and the unique content index decide the winner and the loser
reports `reused` rather than compensating.

### 3.3 `update` is a wholesale replace, never a patch

`generalFileService.ts:216-319`. Three branches:

| # | Condition | Effect | Result |
| --: | --- | --- | --- |
| 1 | `newHash === existing.contentHash` | Re-admit to Knowledge; **no SQLite write** | `{kind:"unchanged", file: existing, message:"new content identical to current"}` |
| 2 | `existingByHash && existingByHash.id !== id` (the new content is already a live file) | Admit the target, remove the *old* file's Knowledge source, then `store.linkReplacement(existing, existingByHash.id, createdAt)` | `{kind:"updated", file: existingByHash}` |
| 3 | otherwise | Build `newFile` with `replacesId: id` and `revision: store.nextRevision(newId)`, admit it, remove the old source, then `store.replace(existing, newFile, createdAt)` | `{kind:"updated", file: newFile}` |

Notes that matter:

- The **kind is taken from the existing file's extension** (`:240-241`), not recomputed from any
  new name — `update` carries only `content`.
- In branch 2 the pre-existing target row is **not modified**; it gains no `replacesId`. The link
  is recorded only on the retiring identity's history snapshot.
- In branch 3 `revision` comes from the *target's own* history (`nextRevision(newId)`), not from
  the source file's revision. Two identities, two independent revision series.
- Every failure path compensates. The three helpers (`generalFileService.ts:91-128`) are
  state-aware rather than blind:

| Helper | Behaviour |
| --- | --- |
| `compensateKnowledge(file, "add" \| "remove")` | Best effort; a failure is logged as `general-files.knowledge.compensation-failed` and swallowed |
| `restoreKnowledgeIfStillActive(file)` | Re-adds **only** if `store.getById` still returns the same `revision` **and** `contentHash`; otherwise logs `general-files.knowledge.compensation-skipped { reason: "source-no-longer-active" }` |
| `removeKnowledgeIfNotActive(file)` | Removes **only** if `store.getById(file.id)` finds nothing |

  These are what make `general-files.test.ts:232` — *"a losing competing update cannot resurrect
  the replaced Knowledge source"* — hold.

---

## 4 · Endpoints

Registered by
[`registerGeneralFileEndpoints`](../../../apps/backend/src/4-job-wiring/general-files/registerGeneralFileEndpointMappings.ts).
All six are `POST` and `responseMode: "inline"`.

| # | Method + path | Job name | Queue | Line | Success | What it does |
| --: | --- | --- | --- | --: | --- | --- |
| 1 | `POST /general-files/upload` | `general-files.upload` | **serial** | 37 | 200 `GeneralFileUploadResult` | Create or reuse by content hash |
| 2 | `POST /general-files/update` | `general-files.update` | **serial** | 53 | 200 `GeneralFileUpdateResult` | Wholesale replace |
| 3 | `POST /general-files/get` | `general-files.get` | concurrent | 70 | 200 `GeneralFile` | **Includes `content`** |
| 4 | `POST /general-files/list` | `general-files.list` | concurrent | 87 | 200 bare array of `Omit<GeneralFile,"content">` | Filtered metadata |
| 5 | `POST /general-files/delete` | `general-files.delete` | **serial** | 104 | 200 `{status:"deleted", id}` | Logical delete |
| 6 | `POST /general-files/purge` | `general-files.purge` | **serial** | 120 | 204 `null` | Physical erase of the history series |

`general-files.test.ts:45`, *"all General Files mutation endpoints use the serial queue"*, pins the
queue assignment.

**Error ladder** (`registerGeneralFileEndpointMappings.ts:11-22`):

| Error | Status | `error` code |
| --- | ---: | --- |
| `GeneralFileNotFoundError` | 404 | `not_found` |
| `GeneralFileEncodingError` | 400 | `encoding_error` |
| `ResourceNotDeletedError` | 409 | `not_deleted` |
| `ResourceHistoryNotFoundError` | 404 | `not_found` |
| anything else | 500 | `internal_error` |

Every caught error is also logged as `general-files.<operation>.error`
(`registerGeneralFileEndpointMappings.ts:24-29`). The last two rows are the shared
cross-capability contract described in [07-capabilities/README.md](README.md) §5.

**Body handling.** `upload` is `service.upload(request.body as any)` (line 43) — the service is the
only validator. The other five destructure `(request.body ?? {}) as { … }` at lines 59, 76, 93,
110, 126. Notably `list` is `const { filters } = (request.body ?? {}) as { filters?: any };` (line
93) and passes the value straight into the SQL builder; unknown filter kinds are silently dropped
there (§2.5).

---

## 5 · Persistence

`SQLiteGeneralFileStore` opens `./data/general-files.db`, sets `journal_mode = WAL` and
`synchronous = NORMAL`, creates the schema, then sets `foreign_keys = ON`
(`sqliteGeneralFileRepository.ts:98-107`). **`busy_timeout` is not set** — one of three stores in
the backend that omits it.

### 5.1 `gf_<p>_files` — one row per live file

| Column | Type / constraint |
| --- | --- |
| `id` | `TEXT PRIMARY KEY CHECK (length(id) = 64 AND id NOT GLOB '*[^0-9a-f]*')` |
| `kind` | `TEXT NOT NULL CHECK (kind IN ('general::file::text','general::file::other'))` |
| `file_name` | `TEXT NOT NULL CHECK (length(trim(file_name)) > 0)` |
| `extension` | `TEXT NOT NULL` — may be empty |
| `content` | `TEXT NOT NULL` |
| `byte_size` | `INTEGER NOT NULL CHECK (byte_size >= 0)` |
| `content_hash` | `TEXT NOT NULL CHECK (length(content_hash) = 64 AND content_hash NOT GLOB '*[^0-9a-f]*')` |
| `revision` | `INTEGER NOT NULL CHECK (revision >= 1)` |
| `knowledge_source_id` | `TEXT` nullable |
| `replaces_id` | `TEXT` nullable |
| `replaced_by_id` | `TEXT` nullable — **always NULL in practice** (§5.3) |
| `created_at`, `updated_at` | `TEXT NOT NULL` |
| table-level | `CHECK (byte_size = length(CAST(content AS BLOB)))`, `CHECK (content_hash = id)` |

Indexes: `gf_<p>_files_kind_created` on `(kind, created_at DESC)`; `gf_<p>_files_extension` on
`(extension)`; `gf_<p>_files_file_name` on `(file_name COLLATE NOCASE)`;
`gf_<p>_files_active_content` **UNIQUE** on `(content_hash)`.

The unique content index is **redundant**: `id` is already the primary key and
`CHECK (content_hash = id)` forces the two equal. It is belt-and-braces, not the sole guarantee.
The module's own constraint list (`docs/types.md:104-110`) carries both `content_hash = id` and
the unique index but does not note that the second follows from the first.

The `file_name` index is `COLLATE NOCASE` but the `LIKE` predicates declare no collation, so
matching follows SQLite's default `LIKE` behaviour (ASCII case-insensitive). The two are
consistent; nothing documents the pairing.

### 5.2 `gf_<p>_history`

The shared schema from `initializeResourceHistorySchema`
([`0-utils/persistence/resourceHistory.ts:43-65`](../../../apps/backend/src/0-utils/persistence/resourceHistory.ts)),
with `resource_kind = "general-file"`. The snapshot payload is a whole `GeneralFile`, content
included.

### 5.3 The revision model, and where the backward link actually lives

`nextRevision(id)` is `nextRevisionAfterHistory(db, historyTable, "general-file", id)`
(`sqliteGeneralFileRepository.ts:194-196`) — `MAX(revision)+1` over that identity's history rows,
or 1 when there are none.

`replace` and `linkReplacement` (`:198-270`) perform the same three-part transaction:

1. Re-`SELECT` the previous row `WHERE id = ? AND revision = ?`; throw
   `General file replacement lost its current source: ${previous.id}` if it is gone.
   (`replace` additionally inserts the new row first, at `:214-228`.)
2. `insertHistorySnapshot` of the previous row **with `replacedById` patched in**:
   `{ ...rowToFile(previousRow), replacedById: replacement.id, updatedAt: replacedAt }`
   (`:229`, `:258`).
3. `insertHistoryDeletion` at `previous.revision + 1`, then
   `DELETE … WHERE id = ? AND revision = ?`.

**Therefore `replaced_by_id` is never non-NULL on a current row.** The column exists, and
`insert`/`replace` always bind `file.replacedById ?? null`, but no code path sets it on a live
file. The forward link `replaces_id` **is** set on current rows, and only by branch 3 of `update`.
The backward link lives exclusively inside the archived history snapshot's JSON —
`general-files.test.ts:119` asserts exactly that:

```ts
store.history(original.file.id)[0]?.snapshot?.replacedById === updated.file.id
```

`delete(id, deletedAt)` (`:272-295`) archives snapshot `N`, appends a `deleted` record at `N + 1`,
removes the row, and returns the deleted revision (`undefined` if there was no row). Unlike
Connector's delete there is **no revision guard and no claim** — the `SELECT` and `DELETE` are by
`id` alone.

`purge(id)` (`:297-302`) returns `"current"` when a live row exists → `ResourceNotDeletedError` →
409; `"missing"` when no terminal `deleted` record exists → `ResourceHistoryNotFoundError` → 404;
otherwise `"purged"`.

**Identity resumption.** Because the id is the content hash, deleting a file and re-uploading the
same bytes reuses the id, and `nextRevision` resumes at `terminal + 1`. After a purge the series is
gone and a re-upload starts at 1. `general-files.test.ts:124` — *"delete removes Knowledge and
deterministic re-registration advances until purge"* — pins both halves.

Retention: `bindResourceRetentionPort("general-files", generalFiles)` at `startBackend.ts:142`,
ninth of eleven ports. `pruneHistory` supplies the `isCurrent` callback
(`(_kind, id) => Boolean(this.getById(id))`, `:313-320`), which is what lets a re-uploaded identity
shed its stale tombstone.

---

## 6 · Invariants

| Invariant | Enforced at |
| --- | --- |
| `id === contentHash === sha256(content)` | `generalFileService.ts:154-155` + SQL `CHECK (content_hash = id)` at `sqliteGeneralFileRepository.ts:49` |
| `byte_size` equals the UTF-8 byte length of `content` | `sqliteGeneralFileRepository.ts:48` (SQL CHECK) + `generalFileService.ts:174` |
| Non-empty trimmed filename | `generalFileService.ts:133-135` + SQL CHECK at `sqliteGeneralFileRepository.ts:34` |
| Text-kind content must round-trip as UTF-8 | `generalFileService.ts:149-151` (upload), `:244-246` (update) |
| At most one live row per content hash | `sqliteGeneralFileRepository.ts:61-62` (UNIQUE) + `generalFileService.ts:158` (pre-check) + PK |
| Text-kind rows get `general-file:${id}`; other-kind get `null` | `generalFileService.ts:185, 288` |
| Knowledge admission precedes the row becoming current | `generalFileService.ts:192-194` |
| An insert failure with no concurrent winner removes the admitted source | `generalFileService.ts:195-202` |
| Replacement requires the previous row at its exact revision | `sqliteGeneralFileRepository.ts:208-213`, `:250-253` |
| The old Knowledge source is removed **before** the SQLite replacement | `generalFileService.ts:256`, `:296` |
| Delete removes Knowledge before removing the row | `generalFileService.ts:355-358` |
| Compensation only re-adds a source still current at the same revision **and** hash | `generalFileService.ts:108-122` |
| Compensation only removes a candidate that did not become current | `generalFileService.ts:124-128` |
| Name filters are LIKE-escaped with an explicit `ESCAPE` clause | `sqliteGeneralFileRepository.ts:145-156` |
| `purge` refuses a live row and requires a terminal history record | `sqliteGeneralFileRepository.ts:298-301` → `generalFileService.ts:372-373` |

**Not enforced anywhere**: any bound on `content` length (§8.2); that `kind` still matches the
filename after an update; that `filters[].kind` is one of the five known arms.

---

## 7 · Design decisions worth preserving

**The deliberately duplicated extension list.** This is a considered rejection of premature
sharing, and both halves say so. General Files —
[`domain/model.ts:1-7`](../../../apps/backend/src/3-capabilities/general-files/domain/model.ts):

```
/**
 * Prose-text extensions — files with these extensions are classified as
 * "general::file::text" and admitted to the Knowledge lattice.
 *
 * Standalone copy owned by this capability. Not imported from any other
 * capability — lists may intentionally diverge.
 */
```

Connector —
[`connector/domain/model.ts:1-4`](../../../apps/backend/src/3-capabilities/connector/domain/model.ts):

```
/**
 * Prose-text extensions — standalone copy owned by this capability.
 * Not imported from any other capability. Lists may intentionally diverge.
 */
```

The shared sentence is *"Standalone copy owned by this capability. Not imported from any other
capability"* plus the divergence clause; the two comments are **not** identical — General Files
adds the Knowledge framing and uses an em dash where Connector uses a full stop. The two `Set`
objects currently hold the same nine strings in the same order, and neither file imports the other
(verified by grep). Say **"separately owned, currently identical"** — not "they differ", and not
"they are shared".

**The transport-string contract** — `general-files/domain/model.ts:28-31`:

```
  /**
   * Full UTF-8 transport string. Text-kind content is prose; other-kind
   * content is opaque and may, by caller convention, contain base64.
   */
```

That "by caller convention" is the whole binary story: nothing decodes, validates or even inspects
other-kind content. `general-files.test.ts:99`, *"binary document containers stay out of Knowledge
until extraction exists"*, is the behavioural statement of the same decision.

**Why the UTF-8 check is written the way it is** — `generalFileService.ts:30-35`:

```
/**
 * Check if a string is valid UTF-8.
 * In Node.js, strings are always UTF-16 internally, but we trust the caller
 * to provide valid bytes. For text-kind files we validate that the content
 * round-trips through Buffer without loss.
 */
```

In practice `Buffer.from(s,"utf8").toString("utf8") === s` fails only for an unpaired surrogate,
which round-trips as U+FFFD. `general-files.test.ts:80` covers the multibyte-success side.

**Admit first, then commit** — `generalFileService.ts:190-191`:

```
      // Admit first, then make the row active. If persistence fails, remove
      // the newly admitted source so a retry starts from a coherent state.
```

**The reuse path is a self-heal, not an optimisation** — `generalFileService.ts:160-161`:

```
        // Upsert into Knowledge as a cheap self-heal for records left behind by
        // an earlier failed ingestion. Matching revisions are skipped.
```

**The LIKE bug, described by its own fix** — `sqliteGeneralFileRepository.ts:141-144`:

```
          // Escaped, and ESCAPE declared. Without it a filename filter stops
          // being a filename filter: `_` matches any character and `%` matches
          // everything, so searching for "report_final" also found
          // "reportXfinal" and searching for "50%" found every file.
```

The escaper itself lives outside the capability, and its header is the codebase's clearest
statement of its storage-ownership rule *and its single exception* —
[`0-utils/persistence/likePattern.ts:1-21`](../../../apps/backend/src/0-utils/persistence/likePattern.ts):

```
/**
 * SQL `LIKE` treats `%` and `_` as wildcards, so caller-supplied text used as a
 * substring filter has to be escaped or it silently stops being a substring
 * filter: searching for `50%` matches every row, and `report_final` also matches
 * `reportXfinal`.
 *
 * **This lives in `0-utils` rather than in each capability's persistence**, which
 * is the one place this codebase's "capabilities own their own storage" rule
 * gives way. The reason is history: Templates and General Files each grew a name
 * filter independently, and they disagreed — one escaped and one did not, so the
 * same query returned different results depending on which capability answered
 * it. Four copies of a four-line function is cheap; four copies that disagree is
 * a class of bug nobody goes looking for.
 *
 * Every call site must also declare the escape character, because SQLite has no
 * default one:
 *
 * ```sql
 * WHERE name LIKE ? ESCAPE '\'
 * ```
 */
```

and the ordering note on the escaper itself (`likePattern.ts:24-28`):

```
/**
 * `\` is replaced first. Doing it later would escape the backslashes this
 * function itself just added, turning `50%` into `50\\%` — a literal backslash
 * followed by a live wildcard.
 */
```

**Why the store port is synchronous** — `ports/repository.ts:4-8`:

```
/**
 * GeneralFileStore — persistence interface for General Files.
 * All methods are synchronous (SQLite via better-sqlite3).
 * Project isolation is encoded in the store instance.
 */
```

---

## 8 · Known gaps and defects

Items with an entry in [11-known-issues.md](../11-known-issues.md) are cross-referenced there.

### 8.1 Two resource families, two line semantics, one `read()` tool

`ResourceReader.read(resourceId, resourceKind, startLine, endLine, scope)` is a single tool
surface. Behind it:

| Resource family | Splitter | Location |
| --- | --- | --- |
| General File content (and Finding claims) | `text.split(/\r?\n/u)` | [`1-init/create/resource-reader.ts:37`](../../../apps/backend/src/1-init/create/resource-reader.ts) |
| Connector item | `full.split("\n")` | [`connector/providers/filesystem.ts:137`](../../../apps/backend/src/3-capabilities/connector/providers/filesystem.ts) |

So **a CRLF connector item returns lines with a trailing `\r`; a CRLF General File does not** —
same request shape, same tool, different answers. Line 1 of a CRLF file read through General Files
is `"hello"`; through Connector it is `"hello\r"`. Each module states its own half accurately —
General Files' `docs/concepts.md:104-105`: *"General File line reads split the stored string on
CRLF/LF and return the requested slice joined with LF"*; Connector's `docs/runtime.md:93`: *"call
`readAll`, split LF, slice"*. **Neither says the two disagree**, and nothing in `0-platform` or
`1-init` reconciles them. → [11-known-issues.md](../11-known-issues.md)

### 8.2 No size limit, anywhere

There is no cap on `content` at the wire, in the service, or in SQL. The whole string is held in
memory for hashing, for the SQLite bind, for the `get` response body, and for Knowledge admission —
four full copies of the payload in flight for a single upload. Contrast Connector, whose reader
caps a full read at 16 MiB. The module's own `docs/invariants.md:60` states the absence.
→ [11-known-issues.md](../11-known-issues.md)

### 8.3 `GeneralFileEncodingError` is the only rejection channel

There is no validation error class, so structural rejections (`fileName` blank, `content` not a
string) arrive as `400 encoding_error` with a message about a field name rather than an encoding.
A client cannot distinguish "your JSON was wrong" from "your text was not UTF-8" by code alone.

### 8.4 `GeneralFilesListRequest` is dead

Declared at `domain/model.ts:76-79`, exported from `index.ts:10`, and **constructed and consumed
nowhere**. The endpoint destructures a bare `filters` array and calls `service.list(filters)`.

### 8.5 Filter escaping has no regression coverage at all

`grep -rln "escapeLikeTerm|likePattern" apps/backend/src apps/backend/test` matches three source
files (`0-utils/persistence/likePattern.ts`,
`general-files/persistence/sqliteGeneralFileRepository.ts`,
`templates/persistence/sqliteTemplateStore.ts`) and **no test file**. The LIKE-escaping fix whose
rationale is preserved verbatim in the comment at `sqliteGeneralFileRepository.ts:141-144` — a bug
that had already shipped once — is protected by nothing but that comment.
→ [11-known-issues.md](../11-known-issues.md)

### 8.6 An unknown filter kind is silently ignored

`sqliteGeneralFileRepository.ts:132-157` has no `default:` arm and the endpoint types `filters` as
`any`. `{"filters":[{"kind":"by-author","value":"x"}]}` returns **every file**, with a 200.

### 8.7 `ContentHash` reuse hides a rename

Because the first upload's `fileName` wins permanently and the reuse path returns the existing row,
there is no way to rename a General File. `update` takes only `content`. The only way to change a
displayed name is to delete, purge, and re-upload — and only purge, because a delete alone leaves
the identity resumable at the same content hash with the same stored filename.

### 8.8 Content-bearing values are logged with no `detail` label

`general-files.upload` and `general-files.upload.reused` log `fileName`
(`generalFileService.ts:163-169, 204-211`); `general-files.get` logs `byteSize`. `grep -rn
"detail:"` across `3-capabilities/general-files`, its wiring file and its factory returns
**nothing**, so every record is unlabelled — treated as `shape` and never dropped even under
`logging.detail: "shape"`. File content itself is never logged. Same posture as Connector and
Context; see [09-configuration.md](../09-configuration.md).

### 8.9 `replaced_by_id` is a column that is never written

Covered in §5.3. It is not a bug — the backward link is deliberately recorded on the archived
snapshot — but the live schema advertises a relationship the live table never carries, and nothing
in the module's `docs/` says so.

### 8.10 Module docs pointing into `scratch/`

`src/3-capabilities/general-files/docs/README.md:56-57` links to `scratch/general-files-design.md`
and `scratch/recent-capabilities-fixes-2026-08-01.md`. Those are the owner's live drafts,
deliberately ahead of the code, and are not authority for anything on this page.

---

**See also**: [connector.md](connector.md) for the other resource family behind the same
`ResourceReader` · [context.md](context.md) for how a General File is named in a Knowledge scope ·
[04-state-and-persistence.md](../04-state-and-persistence.md) for the shared history table and the
retention sweep · [06-platform-services.md](../06-platform-services.md) for Knowledge.
