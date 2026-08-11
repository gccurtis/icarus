# Activity reference resolution design

**Status:** implemented in the paired `codex/activity-omega` and
`codex/activity-alpha` worktrees; pending review and merge.

This follow-up makes Taurus Alpha's Overview Activity feed real and makes its
actor and target references selectively resolvable without turning Activity
into a duplicate owner of User or Resource state.

It builds on the implemented Resource and Activity design. The existing event
shape is already the correct historical projection:

```text
Activity Event
  actor  = { id, name snapshot }
  target = { kind, id, name snapshot }
  action + occurredAt
```

The snapshots make the feed renderable in one bounded request and preserve what
the event meant after later renames, membership changes, or deletion. The IDs
are references the client may resolve against current authorized state when a
person selects the actor or target.

## Decisions

### Documents keep Document changes

Document change sets remain canonical Document history. They contain the
ordered content operations required to reconstruct and synchronize a Document;
they are not moved into User or Activity storage.

A User does not own copies of every change they authored. Duplicating change
sets under both User and Document would introduce two histories that can drift,
complicate deletion and authorization, and make cross-Project queries too easy
to expose accidentally.

### Activity is the cross-family semantic change projection

Activity is the separate capability for the cross-Resource question “who did
what to which item, and when?” Each canonical family owner emits a bounded
semantic fact in the same transaction as its accepted effect. Documents already
do this for create, edit, rename, and delete.

Activity keeps no Resource body or generic serialized change payload. It keeps:

- a stable actor reference plus historical display-name snapshot;
- a tagged Resource reference `(kind, id)` plus historical name snapshot;
- a closed semantic action;
- occurrence time; and
- internal source-fact identity for idempotence.

This is the useful part of the proposed “changes capability,” with a narrower
name and contract: Document changes remain with Documents, while Activity owns
the cross-family human-facing journal.

### Resolve references on selection, not while listing

`GET /activity` remains sufficient to draw the feed. The server does not perform
live User and Resource joins for every event, and Alpha does not issue an N+1
burst after loading a page.

When a user selects an actor, Alpha may resolve the current safe profile. When a
user selects a target, Alpha resolves current Resource metadata before opening
it. Resolution may return not found because historical Activity survives a User
leaving the Project or a Resource being deleted. The UI retains and displays the
event snapshot in that case.

## Safe User projection

Add a selected-Project-scoped query:

```http
GET /users/:userID
  -> 200 { "id": "...", "name": "Current display name" }
  -> 404 when the User is not a current member of the selected Project
```

The response is deliberately not “all User data.” It excludes email, password
state, identity-provider links, sessions, Organization data, timestamps, and
roles. Role and email remain part of the explicitly Project-authorized member
management surface.

The transport's selected-Project gate proves the caller is a current member.
The Access capability then proves the target User is also a current member
before returning the bounded projection. Random IDs are not treated as
authorization. A system actor or departed member therefore remains visible by
the Activity snapshot but does not resolve to a current profile.

## Resource metadata projection

Add the missing point read alongside the implemented unified lifecycle routes:

```http
GET /resources/:kind/:resourceID
  -> 200 { "id", "kind", "name", "createdAt", "updatedAt" }
```

The query is selected-Project scoped. Unknown kinds return 400, recognized but
unavailable kinds return 409, and missing, deleted, or cross-Project resources
return 404 without confirming foreign existence.

The Resource `Family` port gains a point `Get` operation. The Document adapter
resolves it through a small metadata-only `Documents.Summary(projectID, id)`
method over the existing canonical Document record. It does not resolve the
Document body or replay pending content changes merely to answer metadata.

Resource remains a router/projection rather than a generic metadata table. Each
future family implements the same bounded summary operation from its canonical
owner.

## Alpha integration

Alpha replaces its generated Overview activity stream with:

```http
GET /activity?limit=8&cursor=<opaque>
```

The data boundary maps the nested actor and target snapshots and parses
`occurredAt`. `ActivityFeed` keeps the server cursor rather than deriving an
offset, loads asynchronously, prevents duplicate concurrent page requests, and
shows bounded empty/error/loading states.

Actor hover/selection lazily calls `GET /users/:userID` and uses the current name
when available, falling back to the event snapshot on not found. Target
selection calls `GET /resources/:kind/:resourceID`; on success it opens the
canonical Resource ID and current name. A deleted or inaccessible target stays
historically readable and is not opened.

Resource tabs gain an optional serialized `resourceKind`. Existing callers and
persisted tabs remain compatible. Activity supplies the known kind directly,
allowing the stage router to open a canonical Document without depending on the
still-mocked Resource catalog.

## Non-goals

- Moving or duplicating Document change sets.
- A generic endpoint that exposes arbitrary User, Resource, or database fields.
- Loading current User/Resource metadata for every activity row.
- Integrating the complete Resource table; that remains a separate Alpha slice.
- Adding Activity filters, coalescing, realtime updates, or new action kinds.
- Exposing deleted Resource content or former-member private profile data.

## Acceptance criteria

1. Activity pages render from one cursor-paginated request with real actors,
   targets, actions, and times.
2. Selecting a live target resolves current metadata and opens the canonical
   Document ID; rename between event and selection uses the current name.
3. Deleted and cross-Project targets return 404 and the historical row remains
   understandable.
4. Current Project members resolve to `{id,name}`; foreign or departed Users do
   not resolve, while their snapshots remain visible.
5. No endpoint exposes password, session, provider, or unbounded Resource data.
6. Omega unit, transport, SQLite/restart, race, vet, and focused dev-test checks
   pass; Alpha check/build and focused browser coverage pass.
