# General Files concepts

## Purpose and outcomes

Given a non-empty filename and a string, General Files can persist the full string, return it by stable content identity, list metadata, replace an active version wholesale, retire a version, and keep eligible prose synchronized with Knowledge.

It is intentionally a general storage surface, not a document parser. PDF, DOCX, image, archive, code, data, and extensionless payloads are accepted as opaque `general::file::other` values. Nothing attempts to extract prose from those formats.

## Vocabulary

| Term | Current meaning |
|---|---|
| Transport string | The JavaScript `string` received as `content`; stored verbatim as SQLite `TEXT` |
| Content identity | Lowercase hex SHA-256 of the UTF-8 encoding of `content` |
| Text kind | `general::file::text`; extension is in this capability's prose allowlist |
| Other kind | `general::file::other`; persisted but not admitted to Knowledge |
| Active row | A row whose `deleted_at` is null |
| Reused upload | Active content with the same hash already exists; first stored metadata wins |
| Replacement | New content identity activated and old identity retired as one SQLite transaction |
| Resurrection | A soft-deleted deterministic ID is overwritten as active at its prior revision +1 |
| Knowledge source | `general-file:${file.id}` for a text-kind row |
| Compensation | Best-effort inverse Knowledge operation after a later cross-store step fails |

## Architecture and authority

```mermaid
flowchart LR
  HTTP["General Files endpoints"] --> JOB["inline jobs"]
  JOB --> SVC["GeneralFileService"]
  SVC --> CLASS["extension classification"]
  SVC --> HASH["SHA-256 content identity"]
  SVC --> STORE["SQLiteGeneralFileStore"]
  SVC --> KNOW["Knowledge add/remove"]
  SVC --> LOG["shared Logger"]
  REG["RuntimeResourceRegistry"] -->|"get/list text files"| SVC
  REG --> DERIVED["Derived scope and line reads"]
```

The SQLite database and Knowledge database are separate authorities. A General File replacement transaction is atomic only within the General Files database. The service sequences Knowledge work around that transaction and attempts compensation; it does not claim a distributed transaction.

## Classification

The prose allowlist is owned locally by [`domain/model.ts`](../domain/model.ts): `txt`, `md`, `markdown`, `rst`, `org`, `tex`, `html`, `htm`, and `log`. The extension is the substring after the final dot in the upload filename, lowercased. No dot yields an empty extension. A trailing dot also yields empty extension.

Classification is fixed by the stored filename on upload and preserved during update because update changes only content. The Connector capability owns a separate copy of its allowlist; the two may intentionally diverge.

## Content-addressed lifecycle

```mermaid
stateDiagram-v2
  [*] --> Active: upload new hash
  Active --> Active: upload same hash → reused
  Active --> Retired: update to different hash
  [*] --> ActiveReplacement: replacement target inserted/reactivated
  Retired --> Active: upload same deleted hash → resurrect
  Active --> Deleted: delete
  Deleted --> Active: upload same content → resurrect
```

An update does not mutate the old row's identity or content. It either:

1. links the old row to an already-active row with the requested hash; or
2. inserts/reactivates a replacement row and links both directions (`replacesId` / `replacedById`).

The old row is soft-deleted in either case. Active reads reject it, while the repository retains it for lineage and resurrection.

## Knowledge lifecycle

Text rows are added with:

```ts
{
  sourceId: `general-file:${id}`,
  label: "general-file",
  revision: contentHash,
  text: content
}
```

A repeated add with the same Knowledge revision is a cheap no-op. Uploading or unchanged-updating an already-active file therefore also acts as a self-heal request without necessarily spending embedding tokens.

Other-kind rows always have `knowledgeSourceId: null`. The resource registry maps and reads only rows that expose a Knowledge source, so opaque files are stored but excluded from Derived Output retrieval scope.

## Resource-read lifecycle

The resource registry describes an indexed file as `{sourceId, resourceId: file.id, resourceKind: file.kind, resourceRevision: file.revision}`. It will read only a descriptor present in the frozen scope and only while the active file's revision still matches. General File line reads split the stored string on CRLF/LF and return the requested slice joined with LF.
