# Access must not be opt-in: gate reads by caller, and define a redaction contract

**Priority:** high — this is a disclosure bug class, not a feature gap.
**Ask, in one line:** **access should not be opt-in.** Omega already knows the caller and the
project on every request; a project-scoped read should not be *expressible* without them. Make the
caller part of the read signature so forgetting is a compile error rather than a silent leak, and
define what a denied resource looks like on the wire.

---

## The shape of the problem

Omega has the right idea in one place already. `documentAccessGuard` is a middleware that enforces a
document's access scope on **every** route naming a `:documentID`, described in its own comment as
enforcing it "in one place … so a document restricted in the catalog cannot be opened, edited, or
read by URL either." That comment also says: *"Deeper paths (comments, agent tools) are a documented
follow-up."* This is that follow-up, plus what the audit below turned up.

But the guard keys on the resource named in the **URL**, and cannot see resources named in a
**response body** — which is where most identity actually escapes. Everything outside its reach is
enforced by a handler *choosing* to filter.

### Why it is opt-in, precisely

Not one project-scoped read in the capability layer takes the caller:

| Capability read | Signature | Filters? |
| --- | --- | --- |
| `Resources.List` | `(projectID string, req PageRequest)` | no — the handler must call `FilterAccessible` |
| `Documents.List` | `(projectID string)` | no — the handler loops over `canAccess` |
| `Activity.List` | `(projectID string, req PageRequest)` | **no, and no handler does either** |
| `Sessions.List` | `(projectID string)` | **no** |
| `Contexts.ResolveID` | `(projectID, id string)` | **no** |
| `References.References` / `Backlinks` | `(scope Scope, kind, id string)` where `type Scope struct{ ProjectID string }` | **no** |

That is the whole bug in one column. Access is applied entirely *above* these functions, by
remembering — so the endpoints that leak are exactly the ones nobody remembered. It is not a
coincidence that `/activity`, `/sessions`, `/contexts/:id/resolved`, and `/backlinks` are all in the
second half of that table.

The information needed is already present at every one of those call sites. The transport gate
resolves it and hands it to the handler:

```go
type Context struct {
    Session Session
    User    User      // ← the caller
    Project *Project  // ← the project
    Role    Role
}
```

and the handler then drops half of it on the floor:

```go
page, err := h.activity.List(ctx.Project.ID, pageReq)   // ctx.User.ID is right there
```

So this is not a case of the backend lacking the information, or of needing a new subsystem. It is a
case of the read APIs being *shaped* so that answering without an access check is the path of least
resistance.

That is why this is one enforcement request rather than five bug reports: patching the five below
leaves the sixth to be written next quarter by someone who did not know the rule — and the current
signatures give them no reason to learn it.

## What is already enforced — do not rebuild this

| Site | Mechanism |
| --- | --- |
| `resource.Resources.FilterAccessible` (`resource.go:307`) | `Access.permits(callerID, CreatorID, callerOrgIDs)` over a summary slice |
| `resource.Resources.CanAccessResource` (`resource.go:343`) | the singular check both paths resolve through |
| `handlers/resource/resource.go:124` (`resources.Get`) | `CanAccessResource`, 403 on deny |
| `handlers/document/document.go:42` (`documents.List`) | inline `canAccess` loop |
| `transport/middleware.go:73` (`documentAccessGuard`) | every scoped route with a `:documentID` |
| `handlers/comment` | `canAccess` on the parent document |

**The primitives are already right and should not change.** `CanAccessResource` and
`FilterAccessible` are correct, tested, and are what the catalog itself trusts. This request is not
about how access is *decided* — it is about where the decision is *required*. Note that the last four
rows are all handler-side: they are call sites that remembered, not enforcement.

## What is not enforced

Each of these returns a resource's identity to a project member who fails that resource's access
scope.

### 1. `GET /activity` — confirmed against a live stack

`Activity.List` takes no caller identity at all:

```go
func (a *Activity) List(projectID string, req PageRequest) (Page, error) {
    events, err := a.store.ListActivity(projectID, req.TargetID, boundary, limit+1)
```

and the handler serialises the target verbatim — `ctx.User.ID` is in scope and unused:

```go
events[i] = eventJSON{ID: event.ID, Actor: event.Actor, Action: event.Action, Target: event.Target, …}
```

`Target` is `ResourceSnapshot{ID, Kind, Name}`. Reproduced: owner creates a document, sets
`access = {projectWide:false, orgIds:[], userIds:[]}`, adds a second member; that member's
`GET /activity` returns the document's real name. Pinned by `e2e/overview-inspector.spec.ts` →
*"a restricted resource is absent from the table and redacted in the feed"*, which asserts the name
**is** in the response and that Alpha hides it anyway.

The `?targetID=` mode needs the same gate: passing a restricted resource's id returns that
resource's entire event history to someone who cannot open it.

### 2. `GET /documents/:documentID/references` and `/backlinks`

The middleware checks the document in the URL. It cannot check the one at the *other end of the
edge*, and nothing else does:

```go
edges, err := h.refs.Backlinks(refcap.Scope{ProjectID: ctx.Project.ID}, refcap.KindDocument, req.Param("documentID"))
…
type Edge struct { From Ref; To Ref; Kind string; Anchor string }
type Ref  struct { Kind string; ID string; Name string `json:"name,omitempty"` }
```

A restricted document that links to one you *can* read therefore discloses its name to you through
that document's backlinks. Same class as #1, and arguably worse: a backlink also tells you the two
are related.

### 3. `GET /contexts/:contextID/resolved`

```go
leaves, err := h.contexts.ResolveID(ctx.Project.ID, id)
return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"origins": refsOut(leaves)}}
```

A context is a set expression over project resources. Resolving it emits the leaf refs with no
access filter, so a context including a restricted resource resolves it by name for anyone allowed
to read the context.

### 4. `GET /sessions`

```go
sessions, err := h.sessions.List(ctx.Project.ID)
return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"sessions": sessions}}
```

`Session` carries `CurrentDocumentID`, `CaretAtomID`, `CaretOffset`, and the selection atom ids. For
a document you may not open, this discloses that it exists, who is currently in it, and **where
their caret is inside it**. Presence is the one case where the leak is also a live feed.

### 5. `GET /notifications` — lower confidence

`toastJSON` carries `Title` and `Body`, free text that today can name a resource. Worth a look
rather than a fix; it depends on what the producers put there.

## What we are asking for

**a. Make the caller part of every project-scoped read, so access cannot be skipped.** This is the
main ask; the rest are details.

Concretely: thread the caller into the capability read signatures, the way `reference` is already
shaped to accept:

```go
type Scope struct {
    CallerID  string   // ← add
    ProjectID string
}
```

`Activity.List`, `Sessions.List`, `Contexts.ResolveID`, `Documents.List`, and `Resources.List` take
the same treatment — a `Scope` (or just a leading `callerID string`, whichever fits the house style).
Then apply the filter *inside* the read, using the two primitives that already exist:

- `Resources.CanAccessResource(callerID, projectID, kind, id)` — the singular check
- `Resources.FilterAccessible(callerID, summaries)` — the plural filter

Both are already written, already tested, and already the resolver the catalog trusts. Nothing new
has to be invented; the filters that exist today are inline reimplementations of `FilterAccessible`
sitting in handlers instead of one call inside the read.

The point of moving it into the signature rather than adding five more handler-side filters is that
**it changes what happens when someone forgets.** Today forgetting produces a silent disclosure that
ships. With the caller in the signature, a new endpoint that ignores access does not compile, and
every existing call site gets visited once by the compiler during the change. Access stops being a
thing you remember and becomes a thing you cannot avoid.

It also puts the decision where the data is. A response-body middleware would have to re-parse
resource references out of arbitrary JSON to find what to redact; the capability already holds them
as typed values.

Two call sites are worth calling out because they are the ones that make this pay for itself:
`References`/`Backlinks` currently take a `Scope` that carries only the project, so the *other end*
of every edge is unchecked — adding `CallerID` to that one struct fixes both endpoints and forces
every caller to be revisited. And `Activity.List` is the only read here with no access story at all
at any layer, so it is the natural first one to convert.

**b. Define the redaction contract, and put it in `backend-guide.md`.** Today a client cannot tell
"restricted" from "deleted" from "never existed", so it guesses. Either treatment works, as long as
it is stated and uniform:

- **Drop** the item from the collection — cleanest, but keyset pagination must stay correct when a
  page is filtered (a page returning 6 of 8 rows still has to produce a usable cursor), or
- **Return it redacted**: the item stays so counts and ordering hold, identity fields blanked —
  e.g. `{"id": "", "kind": "", "name": "", "redacted": true}`.

We would prefer the second. An explicit `redacted: true` is something a UI can render honestly
("Redacted") rather than inferring from absence — and inference is exactly what Alpha is stuck doing
today.

**c. Fail closed.** `documentAccessGuard` passes the request through when the resolver errors:

```go
allowed, err := resources.CanAccessResource(…)
if err != nil {
    return next(c)   // ← an access check that answers "allow" when it fails
}
```

The intent is reasonable — a not-found document should 404 from the handler rather than 403 from the
guard — but "resource missing" and "the store errored" are different conditions and should not share
an outcome. Distinguish `ErrNotFound` (pass through) from every other error (deny). For a check
whose only job is to withhold, erring toward disclosure is the wrong default.

**d. Cover the by-id paths, not just the collections.** A filter on lists that leaves the singular
fetch open only moves the leak — that is precisely the shape of #1, where `/activity` and
`/activity?targetID=` are the same handler and both are open.

## What Alpha does meanwhile

Alpha redacts client-side **for the activity feed only**.
`features/stages/overview/lens-helpers.ts` treats the access-filtered catalog as the authority on
what a user may know exists; an event target absent from it — and not proven deleted by a `deleted`
event in the same feed — renders as the word **Redacted**, unlinked, with no metadata in the
inspector lens. It fails closed and is held behind a `resourcesLoaded` flag so no name renders
before the decision can be made.

**This is a screen-level patch and is not a fix.** The name is already in the browser's memory and
in the network log; anyone who opens devtools reads it.

Alpha has deliberately **not** built the same workaround for references, backlinks, resolved
contexts, or presence. Four more client-side reimplementations of one access rule is how the rule
ends up inconsistent, and the client cannot make the guarantee anyway. Those surfaces are waiting on
the server.

---

## Two small unrelated asks, both nearly free

These are not access issues. They are bundled here only because they were found in the same audit;
split them out if that is easier.

### 1. Serialise `sourceKind` / `sourceID` on activity events — ~2 lines

An earlier draft of this request claimed these fields are never populated. **That was wrong**, and
the correction makes this much cheaper than it looked. They are set, persisted, and read back:

```go
// core/capability/document/service_submit.go
createdAt := d.now().UTC()
changeSet.CreatedAt = createdAt
cs, err := d.store.AppendChangeSet(changeSet, admissionRevision,
    newActivityFact(doc, actor, ActivityEdited, createdAt, "document.change_set", changeSet.ID))
```

```sql
-- core/platform/storage/sqlite/sqlite_migrate.go
source_kind TEXT NOT NULL,
source_id   TEXT NOT NULL,
UNIQUE (source_kind, source_id)
```

and `sqlite_activity.go` scans them straight back into `event.SourceKind` / `event.SourceID`. The
**only** thing missing is that `eventJSON` in `core/handlers/activity/activity.go` does not include
them.

That `UNIQUE` constraint is the valuable part: a document `edited` event is **exactly one change
set**, not a roll-up. Alpha's activity inspector wants to show the change behind the event a user
clicked, and today it has to match the event to a change set by **exact timestamp** — which works
only because both come from the same `createdAt` variable in one atomic `AppendChangeSet` call.
That is a real invariant, but it is an accident we are leaning on: two change sets landing in the
same millisecond would tie, and nothing stops the two timestamps diverging later. Adding the two
fields to `eventJSON` replaces the inference with the id you already store.

### 2. Return the prior value on the change-set detail endpoint

`GET /documents/:documentID/history/:changeSetID` returns the whole `ChangeSet`, whose forward ops
carry the *new* text but never the old one:

```go
// InverseOps is the server-computed compensation stored with this revision.
// It is private persistence state used by undo, not part of the public response.
InverseOps []ChangeOp `json:"-"`
```

For a `set_atom_text` op the inverse **is** the previous text. So the value needed to render a real
before/after is already computed and already stored — it is just marked private, on the reasoning
that it is undo's implementation detail.

That reasoning is about provenance, not sensitivity. Either exposing `inverseOps`, or deriving a
small `before` alongside the existing ops, would turn a half-diff into a diff. Alpha currently
renders the result and says plainly that the previous text is not returned, because inventing a
"Before" it does not have would be worse — and reconstructing it by walking older change sets would
cost a request per hop and break the moment history is pruned.
