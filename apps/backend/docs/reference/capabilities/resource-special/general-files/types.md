# General Files types and persistence

## Domain types

All domain types live in `domain/model.ts` and are exported from `index.ts`.

### Kinds and classifier

```ts
type GeneralFileKind =
  | "general::file::text"
  | "general::file::other";

function kindFromExtension(ext: string): GeneralFileKind;
```

The classifier expects an already-lowercased extension. The upload service supplies that normalization; direct callers of `kindFromExtension` do not receive implicit lowercasing.

### `GeneralFile`

```ts
interface GeneralFile {
  readonly id: string;
  readonly kind: GeneralFileKind;
  readonly fileName: string;
  readonly extension: string;
  readonly content: string;
  readonly byteSize: number;
  readonly contentHash: string;
  readonly revision: number;
  readonly knowledgeSourceId: string | null;
  readonly replacesId?: string;
  readonly replacedById?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
```

`id` and `contentHash` are equal. `byteSize` is `Buffer.byteLength(content, "utf8")`, not JavaScript string length. `content` is prose for text-kind rows and opaque for other-kind rows; base64 is a caller convention, not a tagged encoding.

### Requests and results

| Type | Shape / meaning |
|---|---|
| `GeneralFileUploadRequest` | `{fileName, content}` |
| `GeneralFileUpdateRequest` | `{content}`; filename and extension cannot change |
| `GeneralFileUploadResult` | `created` with optional Knowledge result, or `reused` with fixed message |
| `GeneralFileUpdateResult` | `updated` with optional Knowledge result, or `unchanged` with fixed message |

The optional `knowledge` field is present only when a text-kind `Knowledge.add` returns a result. An other-kind creation/update can be successful without it.

### Filters

```ts
type GeneralFileFilter =
  | { kind: "by-kind"; value: GeneralFileKind }
  | { kind: "by-extension"; value: string }
  | { kind: "by-name-contains"; value: string }
  | { kind: "by-name-starts-with"; value: string }
  | { kind: "by-name-ends-with"; value: string };
```

Multiple filters are combined with SQL `AND`. List results are `Omit<GeneralFile, "content">[]`; endpoint responses are a bare array, not `{files}`.

## Errors

| Error | Code | Meaning | HTTP status |
|---|---|---|---:|
| `GeneralFileNotFoundError` | `not_found` | ID has no current row | 404 |
| `GeneralFileEncodingError` | `encoding_error` | Invalid filename/content shape or failed text round-trip | 400 |
| Other errors | none | SQLite, Knowledge, or unexpected application failure | 500 |

The service does not expose a stale-revision error because update requests do
not carry an expected revision. The repository's current-revision guard can
still reject a lost replacement as an ordinary `Error`.

## Store contract

`GeneralFileStore` is a synchronous, project-bound persistence port:

| Method | Contract |
|---|---|
| `getById` | Returns the current row by content ID |
| `getByHash` | Returns the current row by hash |
| `list` | Returns current metadata only, optionally filtered |
| `insert` | Writes one complete current row |
| `nextRevision` | Returns 1 without retained history, otherwise historical max +1 |
| `replace` | Atomically inserts a target and moves the expected current source to snapshot + terminal history |
| `linkReplacement` | Atomically moves the current source to history in favor of an already-current target |
| `delete` | Archives current snapshot, appends terminal revision, and removes current |
| `purge` | Rejects a current row; removes terminally deleted history |
| retention methods | Prune old current-identity snapshots and purge expired deleted identities |

## SQLite representation

`SQLiteGeneralFileStore` opens
`./data/general-files.db` in WAL mode with `synchronous=NORMAL`. Its current
table is `gf_${sha256(projectId).slice(0,16)}_files`; matching `_history`
stores complete snapshots and terminal deletion records.

Important SQL constraints:

- IDs and hashes are 64 lowercase hexadecimal characters.
- `content_hash = id`.
- kind is one of the two domain values.
- trimmed filename is non-empty.
- extension may be empty.
- `byte_size` equals `length(CAST(content AS BLOB))`.
- revision is at least 1.
- a unique index permits at most one current row per content hash.

There is no legacy-schema migration. Row mappers convert nullable SQL fields
to optional/null domain fields.

## Wire and Knowledge representations

The HTTP layer returns domain/result objects directly as JSON. It performs TypeScript casts rather than a dedicated runtime wire schema. Knowledge receives a different, narrow `AddItem` representation containing only source identity, label, content revision, and text. Content never appears in `list` responses but does appear in upload/update/get results.
