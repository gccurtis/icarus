# General Files types and persistence

## Domain types

All domain types live in [`domain/model.ts`](../domain/model.ts) and are exported from [`index.ts`](../index.ts).

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
  readonly deletedAt?: string;
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
| `GeneralFileNotFoundError` | `not_found` | ID is absent or soft-deleted at service boundary | 404 |
| `GeneralFileEncodingError` | `encoding_error` | Invalid filename/content shape or failed text round-trip | 400 |
| Other errors | none | SQLite, Knowledge, or unexpected application failure | 500 |

The service does not expose a stale-revision error because update requests do not carry an expected revision. The repository's active revision guard can still reject a lost replacement as an ordinary `Error`.

## Store contract

[`GeneralFileStore`](../ports/repository.ts) is a synchronous, project-bound persistence port:

| Method | Contract |
|---|---|
| `getById` | Returns any row by content ID, including deleted rows |
| `getByHash` | Returns an active row by hash |
| `list` | Returns active metadata only, optionally filtered |
| `insert` / `update` | Writes one complete row; `update` is unconditional by ID |
| `replace` | Atomically upserts target and retires active expected-revision source |
| `linkReplacement` | Atomically retires source in favor of an already-active target |
| `softDelete` | Marks a row deleted by ID |

## SQLite representation

[`SQLiteGeneralFileStore`](../persistence/sqliteGeneralFileRepository.ts) opens `./data/general-files.db` in WAL mode with `synchronous=NORMAL` and foreign keys enabled after schema setup. The table is `gf_${sha256(projectId).slice(0,16)}_files`.

Important SQL constraints:

- IDs and hashes are 64 lowercase hexadecimal characters.
- `content_hash = id`.
- kind is one of the two domain values.
- trimmed filename is non-empty.
- extension may be empty.
- `byte_size` equals `length(CAST(content AS BLOB))`.
- revision is at least 1.
- replacement links are self-referencing foreign keys.
- a partial unique index permits at most one active row per content hash.

The constructor detects the early character-count/required-extension schema and transactionally rebuilds it. Row mappers convert nullable SQL fields to optional/null domain fields.

## Wire and Knowledge representations

The HTTP layer returns domain/result objects directly as JSON. It performs TypeScript casts rather than a dedicated runtime wire schema. Knowledge receives a different, narrow `AddItem` representation containing only source identity, label, content revision, and text. Content never appears in `list` responses but does appear in upload/update/get results.
