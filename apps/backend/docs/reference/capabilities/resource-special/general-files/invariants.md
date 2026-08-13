# General Files invariants, guarantees, and limits

## Precondition → outcome guarantees

| Preconditions | Current guaranteed outcome | Boundary |
|---|---|---|
| Upload has a non-empty string filename and string content | Content is classified and assigned `id = contentHash = sha256(UTF8(content))` | Service plus SQL checks |
| Content hash already has a current row | Upload returns that row as `reused`; no second current row is created | Service lookup plus unique index |
| A new text upload completes | Current row has deterministic source ID and Knowledge add completed before insertion | Service sequencing |
| A new other-kind upload completes | Current row has `knowledgeSourceId = null` and Knowledge was not called | Classifier/service |
| Update content hash equals source hash | No SQLite mutation; result is `unchanged`; text Knowledge add may self-heal | Service |
| Replacement transaction succeeds | Target is current; source snapshot records its replacement, terminal history is appended, and source current row is removed | One SQLite transaction |
| Replacement loses the source's expected current revision | Target insert and source history/current mutation are rolled back together | SQLite transaction/guard |
| Delete completes | Knowledge removal completed first; snapshot `N` and terminal deletion `N + 1` are retained and no current row remains | Service ordering + SQLite transaction |
| List returns a row | Row is current and response omits `content` | Current table/mapper |
| Upload follows delete with identical content before purge | Deterministic ID is reused as a new current row at historical max revision +1 | History lookup + insert |
| Upload follows purge with identical content | Deterministic ID is reused at revision 1 because no allocation history remains | History lookup + insert |

## Identity and revision

- Identity depends only on content, not filename, extension, uploader, or time.
- Uploading the same content under another name returns the original current row and its original filename/kind.
- Replacement never changes an existing row's primary key; it creates/uses another content identity.
- A deterministic identity starts at revision 1 without history. Before purge,
  re-registration uses that identity's historical maximum +1. A replacement
  target uses its own identity history, not the source's revision.
- Knowledge revision is the content hash, so matching current content is
  idempotent at Knowledge ingestion.
- There is at most one current row for a hash in one project table.
- Purge rejects current rows, requires terminal deletion history, and removes
  all retained snapshots for that identity. Shared retention prunes old
  history for current files and purges deleted files after the cutoff.

## Classification and encoding

- Extension comparison is lowercase and allowlist-based.
- Empty extensions are accepted as other kind.
- PDF and DOCX remain other kind; no extraction exists.
- `byteSize` is the UTF-8 byte count of the stored transport string and is checked by SQLite's BLOB length.
- This capability does not prove that an opaque string represents the original binary bytes. Base64 is an optional caller convention.
- JavaScript strings are not accepted as raw `Buffer`/byte arrays.

## Concurrency and atomicity

HTTP mutation jobs are serialized in one process. Direct callers and multiple processes still rely on SQLite:

- the current-content unique index arbitrates duplicate insertion;
- `replace` guards the source ID and revision atomically;
- a competing replacement has one winner, and loser compensation checks current state before changing Knowledge;
- delete's lookup/history/current removal is one SQLite transaction; and
- no transaction spans General Files SQLite and Knowledge storage.

Knowledge compensation is best effort. A compensation failure is logged and
can leave cross-store drift; a later repeated upload/update can self-heal adds,
while removal drift requires another lifecycle operation or explicit Knowledge
reconciliation.

## Limits and performance

There is no General Files-specific maximum filename length, content byte size, filter count, or line-read size in the service. The complete content string is held in memory for hashing, persistence, get responses, Knowledge admission, and resource-registry line splitting. Transport/server limits may apply elsewhere but are not this capability's guarantee.

SQLite uses WAL and `synchronous=NORMAL`. List filters are SQL-backed, but filename `LIKE` semantics inherit SQLite behavior. Filters combine with `AND`, not `OR`.

## Failure and logging behavior

- Knowledge admission failure prevents a new row from becoming current.
- Old-source removal failure prevents replacement SQLite changes and triggers candidate cleanup.
- SQLite replacement failure triggers candidate cleanup and conditional old-source restoration.
- Endpoint error logs contain operation/error metadata; content is excluded.
- Unknown store/Knowledge failures map to HTTP 500.
- Success logs occur after the capability's final primary step.

## Scope and security

- Project ID is hashed into a trusted table prefix at construction.
- Endpoints cannot select a project or table.
- General Files does not perform authentication, malware scanning, MIME verification, secret detection, or content moderation.
- Only current text-kind files are mapped into Context/Knowledge scope.
- Frozen Derived reads require exact manifest membership and revision equality, but that is a runtime scope boundary rather than user authorization.

## Regression coverage

[`general-files.test.ts`](../../../../test/capabilities/general-files.test.ts)
covers serial mutation job selection, content addressing/idempotence,
content-free listing, multibyte byte size, extensionless and binary-container
classification, atomic replacement links, current/history deletion,
deterministic re-registration before and after purge, failed admission retry,
reuse of existing target content, failed-removal rollback, and competing-update
Knowledge safety.

## Non-goals

Current non-goals are multipart upload, streaming storage, binary-native
persistence, parsing/extraction, MIME sniffing, renaming, metadata patches,
per-file ACLs, public historical-content inspection, distributed transactions,
and automatic background Knowledge reconciliation.
