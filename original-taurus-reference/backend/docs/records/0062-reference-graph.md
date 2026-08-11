# Reference graph (BR-REFERENCES)

Documents can link to one another; the workspace needs to answer both "what does
this document point at?" and "what points at this document?" (backlinks). This
adds a project-scoped reference graph, derived automatically from the inline
links a document already carries.

## New capability: `core/capability/reference`

- **`Edge`** — one directed reference `{fromResource, toResource, kind, anchor}`,
  where each endpoint is a `Ref{kind, id, name}`. Today the only edge kind is
  `link`; mentions/embeds await a mention atom (noted in the BR).
- **`References`** service:
  - `ReindexDocument(scope, documentID, []LinkRef)` — replaces a document's
    outgoing edges from its current links. Each href is resolved to an in-project
    resource; **external URLs, dangling hrefs, and self-links are dropped**, and
    duplicate (target, anchor) pairs are collapsed.
  - `References(scope, kind, id)` / `Backlinks(scope, kind, id)` — the outgoing
    and incoming edges, with **names resolved at read time** so a renamed target
    shows its current name.
- **Ports:** `Store` (persist edges by each endpoint) and `Resolver` (href →
  resource, and resource → current name). The capability imports neither document
  nor resource — the composition root supplies the resolver.
- `MemoryStore` for tests.

## Extraction hook: `core/capability/document`

`ReferenceIndexer` port + `extractOutgoingLinks` walk. `Documents` calls the
indexer after **Create** and after every accepted **change set** (so undo/redo
re-index too), handing over each distinct `link` mark as `{href, anchor=blockID}`.
It is **best-effort**: the graph is a derived projection, so an indexing failure
never fails the edit. When no indexer is configured, extraction is skipped.

## Persistence: `resource_references`

`(project_id, from_kind, from_id, to_kind, to_id, kind, anchor)` with from/to
indexes; `ReplaceOutgoing` swaps a resource's outgoing edges in one transaction.

## Wiring

The document service and the reference graph reference each other (a document
re-indexes on save; resolving its links reads documents back). A **late-bound
indexer** (`lazyReferenceIndexer`) breaks the construction cycle — injected into
documents, pointed at the reference service once built. The resolver
(`documentResolver`) maps the editor's internal link forms
(`taurus://document/{id}`, `document:{id}`, `.../documents/{id}`, or a bare id) to
a document via `Documents.Summary`; external schemes are rejected.

## Routes

- `GET /documents/:documentID/references` — outgoing edges.
- `GET /documents/:documentID/backlinks` — incoming edges.

Both are project-scoped reads available to any member.

## Tests

- **Unit** (`reference_test.go`): resolve/drop/dedup, backlinks, replace-on-reindex,
  scope required. (`document/references_test.go`): link extraction order, dedup,
  non-link/blank-href skipping, external hrefs kept for the resolver to judge.
- **Integration** (`dev-test/references/run.sh`, no model, always runs): create a
  linking document → one outgoing edge (external link dropped), one backlink;
  rename the target → edge name updates; delete the linking block → the edge and
  its backlink disappear.
