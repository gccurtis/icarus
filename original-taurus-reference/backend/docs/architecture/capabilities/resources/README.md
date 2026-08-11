# Resources

Resources is the unified Project catalog and lifecycle router. It provides one
cross-family API without becoming a second owner of Document, Deck, Workbook,
Chat, or File state.

## Canonical identity and ownership

A Resource is identified by `(kind, family-owned ID)`. A Document Resource uses
the real `Document.ID`; there is no generic `resources` table, duplicate ID, or
name-based binding. The common `Summary` contains ID, kind, name, and timestamps,
all projected by the canonical family owner.

The Resource service is constructed with a fixed set of `Family` adapters. It
owns the closed kind vocabulary, validation, global paging, and dispatch. Each
adapter owns list/get/create/rename/delete translation to its family capability.
`document`, `connector`, and `file` are currently registered. Uploaded Files
are read-only through this catalog because upload owns their lifecycle;
`spreadsheet`, `slides`, `chat`, and `general` remain recognized but unavailable
until real owners are integrated.

## API

All routes require a selected Project:

| Route | Behavior |
| --- | --- |
| `GET /resources?limit&cursor` | Any member lists common summaries and `availableKinds`. |
| `GET /resources/:kind/:resourceID` | Any member reads one current canonical metadata summary. |
| `POST /resources` | Owner/edit creates through `{kind,name}`. |
| `PATCH /resources/:kind/:resourceID` | Owner/edit renames the canonical target. |
| `DELETE /resources/:kind/:resourceID` | Owner/edit deletes through the canonical owner. |

Read members cannot mutate. Missing or foreign targets return 404, unknown kinds
400, recognized unavailable kinds 409, and empty names 400.

## Paging

Global order is `updatedAt DESC, kind ASC, id ASC`. The default page is 100 and
the maximum 500. A strict versioned base64url cursor carries the last tuple.
Each adapter receives the common boundary and a bounded request; Resource merges
the already bounded family pages. Pages are live keyset traversal, not a frozen
multi-request snapshot.

## Document adapter

The composition adapter maps Resource actors to trusted Document actor
snapshots, projects bounded Document summaries (including point metadata reads),
and maps Document not-found/name errors into Resource errors. Create produces an
ordinary blank Document; rename and delete use the same canonical paths as
`/documents`. Activity is therefore written exactly once by Documents rather
than duplicated by Resource.

## Exact reading

`resource.list` and `resource.read` are the model-facing catalog tools. A read
is closed over the trusted Project and caller, resolves by stable ID (or exact
visible name), reauthorizes before origin I/O, and returns a bounded UTF-8 text
projection with direct provenance, version, hash, and one-based line range.
Opaque encrypted cursors bind caller, Project, Resource, projection, version,
and limit policy; a changed version fails rather than mixing pages.

Document reads flatten the current resolved Document, File reads use the stored
textual content type, and Connector reads open one provider item through the
point-read port. Knowledge search may provide a Resource locator, but that is a
discovery hint only: Resource always performs current authorization and reading.
