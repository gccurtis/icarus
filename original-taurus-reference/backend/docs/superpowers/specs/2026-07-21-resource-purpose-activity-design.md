# Resource, Project purpose, and Activity design

**Status:** implemented on `feature/backend-requests-audit` and verified by
unit, SQLite, transport, restart, race, and dev-test coverage.

This design completes the three deterministic Taurus Alpha backend workstreams
accepted for `feature/backend-requests-audit`:

1. unified Resource identity, catalog reads, and lifecycle routing;
2. persisted Project purpose and precise Project `updatedAt` semantics; and
3. a Project-scoped, cursor-paginated semantic Activity feed.

It does not implement AI generation, merge or rebase Quarterback/Slides, create
placeholder content families, add download/export, or change frontend code.

## Design summary

- A Resource is identified by the tagged canonical family identity
  `(kind, id)`. A Document Resource's ID is its real Document ID. There is no
  second metadata identity and no persisted generic Resource row.
- The Resource capability is a bounded catalog/orchestrator over a fixed set of
  family adapters. Reads merge owner-supplied summaries; create/rename/delete
  route to the one canonical owner.
- The first registered family is Documents. Recognized but unavailable kinds
  fail explicitly. A later Slides integration adds a Deck adapter without
  changing Resource identity or catalog semantics.
- `Project.Purpose` is ordinary persisted Project profile data. Owners and
  editors may change purpose; only owners may change name, icon, or visibility.
- The persisted Project `UpdatedAt` remains profile modification time. The wire
  `updatedAt` is the later of that value and the most recent Resource Activity
  time, giving Alpha the requested aggregate “last edited” meaning without
  forcing every Resource capability to mutate the Project row.
- Activity stores safe semantic Resource facts. A fact is inserted in the same
  owner-store transaction as its Document create/edit/rename/delete effect.
  There is no public append-event endpoint and no client/model-authored event.

## Resource ownership and identity

### The tagged family identity is canonical

The cross-family identity is:

```text
ResourceRef {
  kind: document | spreadsheet | slides | chat | general
  id:   opaque family-owned stable ID
}
```

Identity is the pair, even though IDs are currently UUID-like and collisions
between families are unlikely. APIs and internal operations always carry the
kind alongside the ID. A Document summary uses `Document.ID`; a future Slides
summary uses `Deck.ID`. `general` will map to Files rather than a metadata-only
object.

This decision means:

- existing Documents immediately have valid Resource identities;
- Alpha can replace name-based Document lookup with the Resource ID;
- no migration manufactures a second ID for existing content;
- name, timestamps, and lifecycle remain owned by Documents/Decks/etc.; and
- two family objects are never joined merely because their display names match.

### The unified catalog is composition, not storage

The Resource capability owns the common summary contract, stable kind
vocabulary, paging rules, validation, and lifecycle dispatch. It does not own a
`resources` table.

```go
type Summary struct {
	ID        string
	Kind      Kind
	Name      string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Family interface {
	Kind() Kind
	List(projectID string, page FamilyPage) ([]Summary, error)
	Create(projectID string, actor Actor, name string) (Summary, error)
	Rename(projectID string, actor Actor, id, name string) (Summary, error)
	Delete(projectID string, actor Actor, id string) error
}
```

The exact Go spelling may change during implementation, but the dependency
direction does not: Resource defines the consumer interface; an adapter in the
composition layer implements it over Documents. Resource never imports the
Document package, and Documents never imports Resource.

The family set is frozen when the service is constructed. There is no runtime
registration endpoint or model-visible discovery. `document`, `spreadsheet`,
`slides`, `chat`, and `general` are recognized wire kinds. Only kinds with a
real injected family adapter are available for lifecycle operations.

### Honest availability

The first implementation registers only Documents because that is the only
canonical family on `main` with a complete application surface. The list
response reports `availableKinds`, initially `['document']`.

- An unknown kind is invalid input.
- A recognized but unregistered kind returns a typed unavailable-kind error.
- No empty spreadsheet/chat/general record is persisted as a substitute for a
  missing content capability.
- Slides becomes available only after the existing Slides branch is separately
  evaluated, merged/rebased, and given an application adapter.

This leaves Alpha free to display every known create card while disabling or
truthfully labeling the ones the backend cannot yet fulfill.

### Catalog paging and ordering

`GET /resources` is Project-scoped through the selected session Project. It
accepts a bounded `limit` and opaque `cursor`; the initial default is 100 and
maximum is 500.

```json
{
  "resources": [
    {
      "id": "…",
      "kind": "document",
      "name": "Product Vision",
      "createdAt": "2026-07-20T09:10:00Z",
      "updatedAt": "2026-07-21T14:05:00Z"
    }
  ],
  "availableKinds": ["document"],
  "nextCursor": null
}
```

The global deterministic order is:

```text
updatedAt descending, kind ascending, id ascending
```

The cursor is a versioned base64url encoding of the last sort tuple. It is
untrusted input, strictly decoded, and never contains authority. Each family
adapter receives the global boundary and at most `limit + 1`; the Resource
service merges the already ordered family pages and returns one page plus
`nextCursor`. Adding a family therefore does not change identity or require a
catalog-table migration.

Catalog pages are a live view, not a frozen snapshot. A concurrent rename/edit
can move a Resource across an `updatedAt` boundary; clients that need a fully
fresh table reload from the first page. The cursor provides bounded stable
keyset traversal, not snapshot isolation across several family owners.

The first API intentionally omits server-side free-text search and arbitrary
sort expressions because Alpha already performs those over the loaded list.
They can be added as closed query fields later. The backend still pages and
bounds reads so “list all” never means unlimited allocation.

### Lifecycle operations

The application surface is:

```http
GET    /resources?limit=<n>&cursor=<opaque>
POST   /resources                         { "kind", "name" }
PATCH  /resources/:kind/:resourceID       { "name" }
DELETE /resources/:kind/:resourceID
```

All routes are Project-scoped. Any member may list. Owner/edit may create,
rename, or delete; read may not. Cross-Project targets return not found.

For Documents:

- create produces an ordinary blank Document and returns its summary;
- rename updates the canonical `Document.Name` and `Document.UpdatedAt`;
- delete uses the ordinary Document deletion path; and
- the existing `/documents` endpoints remain valid and participate in the same
  activity/timestamp behavior.

There is no Resource-level content mutation. After opening a summary, the
frontend uses the family endpoint/tool for content.

## Document changes required by Resource semantics

Documents already own ID, name, created time, and updated time, but three gaps
must be closed:

1. there is no rename operation;
2. accepted change sets do not update `Document.UpdatedAt` until a rebase; and
3. background rebase currently updates `UpdatedAt` even though it is only
   representation maintenance.

The implementation adds Project-scoped rename, updates `UpdatedAt` in the same
transaction as an accepted change set, and makes rebase preserve the current
user-visible timestamp. Create, rename, delete, and append-change methods accept
trusted actor identity so their store mutations can commit an Activity fact.

Document summary paging is a bounded owner query ordered by the common Resource
tuple. The existing Document list route may continue returning its current
shape, but the adapter uses the bounded summary query.

## Project purpose

### Data and validation

`access.Project` gains:

```go
Purpose string
```

The SQLite `projects` table gains a non-null `purpose` column defaulting to the
empty string. Every Project response includes `purpose`; no value is represented
as `''`, not omitted/null.

Purpose is trimmed, empty clears it, and content is limited to 1,000 Unicode
runes. The value is plain text: no Markdown, HTML, Prompt, Formula, provider
state, or evidence is stored in the Project profile.

### Field-specific authorization

The existing partial Project patch is retained:

```http
PATCH /projects/:projectID { "purpose": "…" }
```

Authorization is based on the complete requested field set:

| Caller role | Purpose only | Name/icon/visibility, alone or mixed |
| --- | --- | --- |
| owner | allowed | allowed |
| edit | allowed | forbidden; no fields applied |
| read | forbidden | forbidden |

An empty patch is rejected. A normalized no-op returns the current Project and
does not advance its profile timestamp. A mixed unauthorized patch fails as a
whole; the service never applies the purpose while silently dropping an owner
field.

AI purpose drafting is not part of this mutation. A later workflow may return a
draft, but persistence still occurs through this explicit ordinary patch.

## Project `updatedAt`

The product meaning is “latest committed user-visible Project or Resource
change,” while capability ownership remains separated:

```text
wire updatedAt = max(Project profile UpdatedAt, latest Resource Activity time)
```

`access.Project.UpdatedAt` continues to mean Project-profile modification time:
create, purpose, name, icon, or visibility. Membership/session operations and
background maintenance do not update it.

Resource Activity covers Document create, edit, rename, and delete in this
increment. A Project handler consumes a narrow batch `LatestByProjects` reader
and decorates Project responses. The Access capability does not import Activity,
and Resource owners do not write the Project row. This avoids a hot Project row,
lost timestamp updates, and cross-capability transactions whose only purpose is
a list projection.

For pre-existing data, SQLite migration/repair computes each Document's visible
`UpdatedAt` as the later of its stored timestamp and newest retained change-set
time, then raises the Project profile timestamp to at least the newest current
Document timestamp. It does not invent historical Activity rows.

If Activity decoration fails, Project list/read fails rather than returning a
timestamp advertised as aggregate but known to be stale.

## Activity ownership and model

Activity is a safe human-facing semantic journal, not request logging, security
Audit, canonical Resource history, or model memory.

```go
type Event struct {
	ID         string
	ProjectID  string
	Actor      ActorSnapshot
	Action     Action
	Target     ResourceSnapshot
	OccurredAt time.Time
	SourceKind string
	SourceID   string
}
```

Initial actions are `created`, `edited`, `renamed`, and `deleted`. `shared` is
reserved for a future real Resource-sharing effect; Project visibility or member
changes are not mislabeled as Resource sharing.

The event stores actor ID/display-name and target ID/kind/name snapshots. The
trusted handler uses the account display name and falls back to its email when
the optional name is blank; the event exposes only the resulting display string,
not a separate email field. Internal user-visible effects use a closed stable
system actor snapshot rather than impersonating the requester; representation-
only maintenance such as rebase emits nothing. A deleted Resource therefore
remains understandable, and later actor/target renames do not rewrite history.
It stores no Resource body, prompt, source text, provider result, arbitrary JSON,
secret, or error message.

`SourceKind + SourceID` identifies the confirmed owner fact, such as a Document
change-set ID, and is unique. It supports safe retry/idempotent projection
without making Activity an authority over that source.

### Atomic owner facts

There is no public/internal generic append API used by handlers after the fact.
Documents defines its own bounded semantic fact in Document vocabulary and
passes it to its Store mutation. The SQLite Document Store performs, in one
transaction:

```text
canonical Document effect
        +
insert safe activity_events row
```

If either write fails, neither commits. Failed validation, conflicts, forbidden
requests, and normalized no-ops produce no event. The Resource orchestrator does
not emit a second event because the family owner already did.

This pattern is reusable: a future Deck Store defines a Deck fact and the SQLite
adapter maps it to the same closed Activity row. Product capabilities do not
import Activity merely to persist their own effects; the shared storage adapter
is where owner-specific facts become Activity rows.

### Feed query and cursor

```http
GET /activity?limit=8&cursor=<opaque>
```

The route is Project-scoped and readable by every Project member. Results are
ordered by `occurredAt DESC, id DESC`. The versioned opaque cursor contains only
that last tuple; SQL always filters by the trusted selected Project before
applying it. Default limit is 8 and maximum is 100.

```json
{
  "events": [
    {
      "id": "…",
      "actor": { "id": "…", "name": "Maya Chen" },
      "action": "edited",
      "target": { "id": "…", "name": "Product Vision", "kind": "document" },
      "at": "2026-07-21T14:05:00Z"
    }
  ],
  "nextCursor": null
}
```

Invalid cursors return bad request. Cursors cannot cross Project scope because
Project ID comes only from the resolved access context and every store query
filters it. The initial implementation retains all events and exposes no
rebuild/admin endpoint; retention/compaction is added only when an actual volume
requires it.

### Current-target behavior

Activity is a historical statement, not proof that a target remains openable.
The snapshot tells the frontend what happened. Opening a non-delete event uses
its tagged Resource identity and performs an ordinary currently authorized
Resource/family read; a later deletion naturally returns not found. The feed
does not perform N live target lookups or claim current availability.

## Concurrency and failure semantics

- Resource list is read-only composition. Any registered family failure fails
  the page; it is never presented as a successful empty family.
- Family writes are serialized/validated by their existing stores. Resource
  dispatch does not add a second write or weaker validation path.
- Activity events share the owner transaction, so an accepted effect never has
  a crash window with a missing feed fact.
- Activity ordering uses a time-plus-ID tie-break and never claims to order
  canonical concurrent mutations beyond their committed timestamps.
- Project aggregate `updatedAt` is a read projection, so concurrent Resource
  edits do not contend on or overwrite the Project profile row.
- No-op Project or Resource renames do not advance timestamps or create events.
- Deleting a Document removes its content/change sets but retains its bounded
  Activity snapshots.

## HTTP and capability boundaries

```text
selected access.Context
        │
        ├── Project handlers ── Access + ActivityLatestReader
        ├── Resource handlers ─ Resource service ─ fixed Family adapters
        │                                      └─ Document owner
        └── Activity handlers ─ Activity read service

SQLite implements Access/Document/Activity stores and the atomic mapping from
Document semantic facts into activity_events.
```

Handlers enforce role shape and translate errors. Capabilities validate domain
values and scope every operation by Project. Wiring supplies concrete adapters;
requests cannot register a family, select a Project through arguments, write an
Activity event, or choose a storage path.

## Explicitly deferred

- AI creation/generation and purpose drafting.
- Rebase/merge of Quarterback or Slides branches.
- Spreadsheet, Slides, Chat, and General/File lifecycle adapters.
- Generic upload, download, export, archive/restore, favorites, or templates.
- Resource sharing distinct from Project membership/link access.
- Activity search/filter, coalescing, retention, rebuild, or security Audit.
- A persisted cross-family catalog cache; current owner composition is the
  source-correct initial implementation.

## Acceptance criteria

The increment is complete when:

- owner/edit can persist/clear purpose, while field-specific authorization and
  no-op behavior are enforced and survive SQLite restart;
- existing and newly created Documents appear under their real IDs in the
  unified Resource page;
- unified create/rename/delete changes the canonical Document and read-only
  members cannot mutate it;
- unavailable kinds fail explicitly and are reported as unavailable;
- Document create/edit/rename/delete commits exactly one Activity event in the
  same SQLite transaction, including stable actor/target snapshots;
- Activity pages are deterministic, cursor-bounded, Project-isolated, and keep
  deleted-target history;
- Project `updatedAt` reflects later profile or Resource Activity without
  background rebase advancing it;
- concurrent/race tests and restart tests pass; and
- every changed non-test Go source has a byte-exact companion document, with
  architecture docs, backend guide, dev walkthroughs, and change records current.
