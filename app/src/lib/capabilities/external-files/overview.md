# External files

Anything that arrives as a file. Every upload is one, and so is every file a
connector pulls, an agent produces, or research captures off the web.

One table for all of them: a PNG, a PDF, and a CSV are the same object with a
different `kind`, because everything done with a file before anyone looks inside
it — store it, name it, scope it to a project, list it, delete it — is identical.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `list` | query | one project's files |
| `ingest` | mutation | records an arrived file, returning its id |
| `recordExtraction` | mutation | keeps what an extractor read out of one |
| `remove` | mutation | deletes a file and its bytes |

Registered in
[`src/convex/capabilities/externalFiles.ts`](../../../convex/capabilities/externalFiles.ts),
all four built from `projectQuery` / `projectMutation`.

There is no `rename` and no `update`. A file's bytes are immutable and its
metadata describes them, so the one edit that makes sense — a new version — is
`ingest` again with `supersedes`.

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `externalFiles` | one row per file: what it is, where its bytes came from, what we read out of it |

The bytes themselves are Convex storage, named by `storageId`. Nothing here reads
them.

## Kind is derived on ingest and stored

The extension decides the kind, using the obvious mapping and nothing cleverer.
It is **stored rather than computed on read** so it can be indexed, and so a
correction — a mislabelled extension, a better classifier later — is a write
rather than a change in behaviour for every file already here.

**An unknown extension is `ext-unknown`, never a refusal.** A file we cannot
classify is still a perfectly good file: it is stored, offered for download, and
nothing else happens to it.

**The `ext-` prefix is not decoration.** `ext-document` is an uploaded PDF;
`document` is an Icarus document. Kinds travel into resource sets, lattice
sources, and comment anchors where they are matched against kinds from every
other domain, so a kind is only safe as a discriminator if it is unique across
all of them.

## Versions are new files

Bytes are immutable, so a new version is a new row with `supersedes` pointing at
the one it replaces. The superseded row is not touched: it still exists in full,
and every reference already made to it still resolves.

A connector re-sync uses the same mechanism without being told to. It cannot name
our row — it holds the provider's id — so `by_connector_external` matches the new
file to the last one that connector sent, and a changed remote file becomes a
version rather than a duplicate.

## Capability Invariants

- **`kind` and `extension` are derived from the name, never accepted.** Two
  fields describing the same thing can disagree, and the one a caller sends is
  the one that would be wrong.
- **Uploads come from people.** An agent has no source to upload *from*; what it
  can do is produce a file, which is the `generated` origin. An upload origin
  with a non-user actor is refused.
- **`origin` and `createdBy` both stay.** `createdBy` answers who put the file
  here; `origin` answers where the bytes came from and carries the per-case data
  that answer needs — the provider's id for matching a re-sync, the URL for
  opening it at the source. Collapsing them would drop that.
- **A refusal is "not found", never "forbidden".** A file in another project
  answers exactly as one that never existed.
- **Every mutation records its activity in the same transaction**, and `remove`
  reads the name first so the entry can still say what was deleted.
- **All three refusals are thrown as `ExternalFilesError`.** Convex serializes a
  `ConvexError`'s payload and redacts everything else, so a refusal thrown as a
  plain `Error` arrives as a server fault and stops being a refusal.

## Deferred to later passes

| Today | When | Becomes |
| --- | --- | --- |
| `origin.connectorId` is `v.string()` | pass 8 | `v.id("connectors")` |
| only the door's `upload` origin is reachable | when a runner exists | connector sync and [agent tasks](../agent-tasks/overview.md) call `ingest` with their own origin and actor |

## Related

[external file](../../../../../docs/data-models/special-resources/external-file.md) —
the model this implements ·
[connector](../../../../../docs/data-models/special-resources/connector.md) —
what a re-sync matches against ·
[resource set](../../../../../docs/data-models/special-resources/resource-set.md) —
the kinds `ext-` is namespaced apart from
