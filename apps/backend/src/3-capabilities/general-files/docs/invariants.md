# General Files invariants, guarantees, and limits

## Precondition → outcome guarantees

| Preconditions | Current guaranteed outcome | Boundary |
|---|---|---|
| Upload has a non-empty string filename and string content | Content is classified and assigned `id = contentHash = sha256(UTF8(content))` | Service plus SQL checks |
| Content hash already has an active row | Upload returns that row as `reused`; no second active row is created | Service lookup plus partial unique index |
| A new text upload completes | Active row has deterministic source ID and Knowledge add completed before activation | Service sequencing |
| A new other-kind upload completes | Active row has `knowledgeSourceId = null` and Knowledge was not called | Classifier/service |
| Update content hash equals source hash | No SQLite mutation; result is `unchanged`; text Knowledge add may self-heal | Service |
| Replacement transaction succeeds | Target is active, source is soft-deleted and links to target, and target links back when newly built | One SQLite transaction |
| Replacement loses the source's active expected revision | Target upsert and source retirement are rolled back together | SQLite transaction/guard |
| Delete completes | Knowledge removal (if applicable) completed before row tombstone | Service ordering |
| List returns a row | Row is active and response omits `content` | SQLite predicate/mapper |
| Upload follows delete with identical content | Deterministic row can reactivate at prior revision +1 | Service and store update |

## Identity and revision

- Identity depends only on content, not filename, extension, uploader, or time.
- Uploading the same content under another name returns the original active row and its original filename/kind.
- Replacement never changes an existing row's primary key; it creates/uses another content identity.
- A fresh row starts at revision 1; a replacement uses source revision +1; resurrection uses tombstone revision +1.
- Knowledge revision is the content hash, so matching active content is idempotent at Knowledge ingestion.
- There is at most one active row for a hash in one project table.

## Classification and encoding

- Extension comparison is lowercase and allowlist-based.
- Empty extensions are accepted as other kind.
- PDF and DOCX remain other kind; no extraction exists.
- `byteSize` is the UTF-8 byte count of the stored transport string and is checked by SQLite's BLOB length.
- This capability does not prove that an opaque string represents the original binary bytes. Base64 is an optional caller convention.
- JavaScript strings are not accepted as raw `Buffer`/byte arrays.

## Concurrency and atomicity

HTTP mutation jobs are serialized in one process. Direct callers and multiple processes still rely on SQLite:

- the active-content unique index arbitrates duplicate activation;
- `replace` guards the source ID, revision, and live state atomically;
- a competing replacement has one winner, and loser compensation checks current state before changing Knowledge;
- `softDelete` and tombstone `update` do not carry an expected revision; and
- no transaction spans General Files SQLite and Knowledge storage.

Knowledge compensation is best effort. A compensation failure is logged and can leave cross-store drift; a later repeated upload/update can self-heal adds, while removal drift requires another lifecycle operation or explicit Knowledge reconciliation.

## Limits and performance

There is no General Files-specific maximum filename length, content byte size, filter count, or line-read size in the service. The complete content string is held in memory for hashing, persistence, get responses, Knowledge admission, and resource-registry line splitting. Transport/server limits may apply elsewhere but are not this capability's guarantee.

SQLite uses WAL and `synchronous=NORMAL`. List filters are SQL-backed, but filename `LIKE` semantics inherit SQLite behavior. Filters combine with `AND`, not `OR`.

## Failure and logging behavior

- Knowledge admission failure prevents a new row from becoming active.
- Old-source removal failure prevents replacement SQLite changes and triggers candidate cleanup.
- SQLite replacement failure triggers candidate cleanup and conditional old-source restoration.
- Endpoint error logs contain operation/error metadata; content is excluded.
- Unknown store/Knowledge failures map to HTTP 500.
- Success logs occur after the capability's final primary step.

## Scope and security

- Project ID is hashed into a trusted table prefix at construction.
- Endpoints cannot select a project or table.
- General Files does not perform authentication, malware scanning, MIME verification, secret detection, or content moderation.
- Only active text-kind files are mapped into Context/Knowledge scope.
- Frozen Derived reads require exact manifest membership and revision equality, but that is a runtime scope boundary rather than user authorization.

## Regression coverage

[`general-files.test.ts`](../../../../test/capabilities/general-files.test.ts) covers serial mutation job selection, content addressing/idempotence, content-free listing, multibyte byte size, extensionless and binary-container classification, atomic replacement links, delete/resurrection, failed admission retry, reuse of existing target content, failed-removal rollback, and competing-update Knowledge safety.

## Non-goals

Current non-goals are multipart upload, streaming storage, binary-native persistence, parsing/extraction, MIME sniffing, renaming, metadata patches, per-file ACLs, hard deletion, historical-content endpoint exposure, distributed transactions, and automatic background reconciliation.
