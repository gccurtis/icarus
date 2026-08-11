# REFERENCE — the directed graph between resources

REFERENCE maintains the project-scoped **graph of directed references between
resources**: today, the inline links a document points at, and the backlinks that
answer "what points at this?". It exists so a document can be read as a node in a
web rather than an island, without the document capability having to know what a
link resolves to.

Its defining constraint is that it **imports neither [document](documents/README.md)
nor [resource](resources/README.md)**. It stores edges as bare `(kind, id)` pairs
and resolves display names at *read* time through an injected `Resolver`. That one
decision is what keeps a graph over documents from becoming a dependency on
documents.

- **Domain, ports, and in-memory store** —
  [`core/capability/reference`](../../../core/capability/reference/reference.go).
  A single file; the `MemoryStore` lives at its foot rather than in a separate
  `memory.go`, a minor departure from the usual layout.
- **Application handlers** —
  [`core/handlers/reference`](../../../core/handlers/reference/reference.go).

## The model

```go
type Scope struct{ ProjectID string }   // trusted context from the access gate

const (
	KindDocument = "document"
	EdgeLink     = "link"    // an inline hyperlink; mention/embed await a mention atom
)

type Ref struct {                        // one endpoint of an edge
	Kind, ID string
	Name     string                      // resolved at read, omitted when unresolvable
}

type Edge struct {                       // what a reader sees
	From, To Ref
	Kind     string
	Anchor   string                      // the block the link sits in
}

type StoredEdge struct {                 // what is persisted — ids and kinds only
	FromKind, FromID string
	ToKind, ToID     string
	Kind, Anchor     string
	UpdatedAt        time.Time
}

type LinkRef struct{ Href, Anchor string }   // one raw outgoing link, pre-resolution
```

The split between `StoredEdge` and `Edge` is the whole trick. **Names are never
stored.** A renamed document does not require a graph rewrite, and a deleted one
yields an edge whose `Name` is simply absent rather than a stale string.

## Ports, and who satisfies them

```go
type Resolver interface {
	Resolve(projectID, href string) (kind, id, name string, ok bool)
	Name(projectID, kind, id string) (string, bool)
}

type Store interface {
	ReplaceOutgoing(projectID, fromKind, fromID string, edges []StoredEdge) error
	Outgoing(projectID, kind, id string) ([]StoredEdge, error)
	Incoming(projectID, kind, id string) ([]StoredEdge, error)
}
```

- **`Store`** — the shared `*sqlite.Store`
  ([`core/platform/storage/sqlite/sqlite_reference.go`](../../../core/platform/storage/sqlite/sqlite_reference.go)).
- **`Resolver`** — `documentResolver` in
  [`core/wiring/wiring.go`](../../../core/wiring/wiring.go), a thin adapter over
  `*document.Documents`. `normalizeDocumentHref` rejects external schemes
  (`http`, `https`, `mailto`, `tel`), recognizes the internal forms the editor
  emits (`taurus://document/…`, `document://…`, `document:…`, a trailing
  `/documents/<id>`), then confirms the candidate names a real document via
  `docs.Summary` — which also re-scopes it to the project.

The reverse direction uses a port too: `document` declares its own
`ReferenceIndexer` ([`core/capability/document/references.go`](../../../core/capability/document/references.go))
and wiring's `lazyReferenceIndexer` satisfies it — so neither package imports the
other. That pair is one of the two **deliberate late-binding cycles** in
composition: documents need an indexer, references need documents to resolve
names. Wiring builds an empty `lazyReferenceIndexer{}`, passes it into
`documents`, then back-patches `.refs` once `references` exists; until it is
patched, indexing is a silent no-op. This is unguarded ordering-by-convention,
tracked as `DEF-4` in [issues-and-gaps](../issues-and-gaps.md).

## Operations

| Method | Behaviour |
|---|---|
| `ReindexDocument(scope, documentID, links)` | Resolve every href, drop what does not resolve and any self-link, de-duplicate on `(kind, id, anchor)`, and **replace** the document's whole outgoing set. |
| `References(scope, kind, id)` | The resource's outgoing edges, names resolved. |
| `Backlinks(scope, kind, id)` | The resource's incoming edges, names resolved. |

Both reads sort by `From.ID` then `To.ID` so output is stable. A blank
`Scope.ProjectID` is `ErrInvalidScope` on every method.

### Replace, not diff

Re-indexing never computes a delta. `ReplaceOutgoing` deletes every edge with the
given `(project, from_kind, from_id)` and inserts the new set inside one
transaction. The source resource is the unit of replacement, so the stored edges
for a document are always *exactly* the links its current content contains —
there is no accumulated drift to reconcile, and a link removed from a paragraph
vanishes from the graph on the next save with no deletion bookkeeping.

The write path is driven from the document side: `extractOutgoingLinks` walks the
resolved base (rows, header, and footer) for link marks, anchoring each at the id
of the block that carries it, and `reindexReferences` hands the result to the
indexer after a document is created and after a change set folds.

### A derived projection, not a source of truth

Indexing is **best-effort** — the document capability discards the error, so a
failure to index never fails the edit that produced the content. That is only safe
because the graph holds nothing that cannot be recomputed: every edge is a
function of some document's current content, and names are resolved fresh on each
read. If the table were dropped, re-indexing every document would rebuild it
exactly. Treat it as a cache with a derivation rule, not as data.

## HTTP surface

Two reads on the **project-scoped** group, available to any project member,
registered only when a reference service is wired.

| Method & path | Handler | Purpose |
|---|---|---|
| `GET /documents/:documentID/references` | `References` | The document's outgoing edges. → `200 {references:[…]}` |
| `GET /documents/:documentID/backlinks` | `Backlinks` | The edges pointing at it. → `200 {backlinks:[…]}` |

Both return `[]` rather than `null` when empty. `ErrInvalidScope` maps to `400`;
anything else is a `500` with a generic message.

## Persistence

One table in the shared SQLite [store](../persistence.md):
**`resource_references`**, keyed `(project_id, from_kind, from_id, to_kind, to_id, anchor)`
with `kind` and `updated_at`, and indexed **both ways** —
`idx_resource_references_from` for outgoing reads, `idx_resource_references_to`
for backlinks — which is what makes the reverse query as cheap as the forward
one. `ReplaceOutgoing` runs its delete-then-insert in a single transaction. A
`MemoryStore` provides the same contract for unit tests.

## Status

**Wired and reachable over HTTP today**, though only document→document link edges
are produced: `EdgeLink` is the only edge kind and `KindDocument` the only
resource kind emitted, with mention and embed edges awaiting a mention atom in the
document model. Both ports are already kind-generic, so a second resource family
joins the graph without a schema change.

## Related

- [Documents](documents/README.md) — the source of link marks and the only node kind today.
- [Resources](resources/README.md) — the catalog the graph will generalize across.
- [Persistence](../persistence.md) — the `resource_references` schema.
- [Issues and gaps](../issues-and-gaps.md) — `DEF-4`, the unguarded late binding.
