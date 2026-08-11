# 2026-07-29 — Overview inspector lenses, and closing an activity-feed disclosure

Overview had no inspector. Selecting things on it did nothing, and the right rail said "Nothing to
inspect yet — open a resource" even while you were looking at a table full of resources. This adds
three lenses (one resource, the checkbox set, one activity event) and, in the course of deciding
what a lens may show, closes a real disclosure in the activity feed.

## Overview contributes a Details lens, and only that

```ts
activeSurface.set({
  id: `overview:${projectId}`,
  scope: projectName,
  inspector: [
    { id: 'details', label: 'Details', icon: SlidersHorizontal, content: OverviewDetailsPanel }
  ]
});
```

`OverviewStage` now publishes a surface contribution the way `DocumentStage` and `SlideStage` do.
Leaving `context` undefined is the load-bearing detail: `contextSectionsFor` reads
`surface?.context ?? projectContext`, so an omitted set keeps the project-context rail on the left,
while an empty array would have replaced it with nothing. The contributed `details` id overrides the
shell's universal fallback for as long as Overview is the active surface.

`OverviewDetailsPanel` is a 20-line dispatcher over `lenses/{Resource,Resources,Activity}Lens`,
following the rule the document stage's inspector arrived at the hard way (910 lines before
workstream A): a new selection mode is a new file, not another branch of markup.

## Row click and the checkbox are two selections, deliberately

```ts
export type OverviewSelection =
  | { mode: 'none' }
  | { mode: 'resource'; resourceId: string }
  | { mode: 'resources'; resourceIds: string[] }
  | { mode: 'activity'; event: ActivityEvent; redacted: boolean };
```

Clicking a row inspects it. Ticking a checkbox builds the bulk set for Download/Import. They are
kept apart because merging them means glancing at a resource silently arms a bulk action — so the
checkbox set got its own lens instead (a count, a kind breakdown, the update span, how many are
access-restricted), and whichever the user touched last is what the inspector shows.

The resource modes hold **ids**, not snapshots, so a lens reads the live catalog row: a rename shows
up while the lens is open, and a resource deleted underneath the selection degrades to an honest
message instead of stale facts.

Every selecting action calls `setPanel('inspector', { section: 'details', collapsed: false })`.
Selecting is an explicit "show me this", and the failure worth preventing is a click that appears to
do nothing because the rail happens to be collapsed.

## The activity feed was disclosing restricted resource names

This was found while deciding what the lenses may show, and it is the substantive part of this
change.

Omega filters `GET /resources` by access scope:

```go
if summaries[i].Access.permits(callerID, summaries[i].CreatorID, callerOrgIDs) {
    out = append(out, summaries[i])
}
```

`GET /activity` does not. `Activity.List(projectID, req)` takes no caller identity at all, and the
handler serialises `event.Target` — `{ID, Kind, Name}` — verbatim. So any project member was being
told the **name** of every resource touched in the project, including ones whose access scope exists
precisely to hide them from that member. The resource table was never the leak; the feed was.

Alpha now treats the access-filtered catalog as the authority on what a user may know exists:

```ts
export function isTargetRedacted(event, visibleIds, deletedIds): boolean {
  if (visibleIds.has(event.target.id)) return false;
  return !deletedIds.has(event.target.id);
}
```

It **fails closed** — anything not positively known to be visible or deleted is redacted, rendering
as the single word *Redacted*, unlinked, with a lens that discloses only that someone acted.

Two details make this work without extra requests or a flash of the name it hides. Deleted resources
are also absent from the catalog, so they would redact too; they are rescued by
`deletedTargetIds(events)`, which works because the feed is newest-first — a resource's `deleted`
event always loads *before* the older events naming it. And the list is held behind a new
`resourcesLoaded` flag, because rendering first and redacting once the catalog arrives would put the
very names this hides on screen.

`e2e/overview-inspector.spec.ts` proves both halves: it asserts the member's `GET /activity`
response *does* contain the restricted name, then that no surface in the app ever shows it.

This is a screen-level patch. The name is already in the browser and in the network log; only the
server can withhold it. Filed as `docs/backend-requests/resource-access-enforcement.md`, which also
notes that `activity.Event.SourceKind`/`SourceID` are declared but never populated or serialised —
the reason the activity lens lists a document's recent change sets rather than claiming which one
produced the event.

## Per-resource timelines, using a filter Omega already had

```ts
void loadActivityPage(projectId, null, 5, id);   // → /activity?targetID=<id>
```

`loadActivityPage` gained a `targetId` argument. Omega's handler has always accepted it
(`PageRequest.TargetID`); Alpha simply never sent it. This is the timeline source for both lenses
because it works for **every** resource kind — change-level history with real before/after and undo
exists only for documents, and a lens rich for one kind and empty for the rest reads as broken
rather than as an honest limit. For document targets the activity lens additionally lists recent
change sets, each fetching its before/after only when expanded.

Verified directly against the running stack before building on it, rather than trusted from the
docs: a probe confirmed `?targetID=` returns exactly that resource's events.

## Rows became click targets without losing their controls

```svelte
<div role="grid" aria-label="Resources">
  <div role="row" tabindex="0" aria-selected={isInspected}
       onclick={(e) => inspectRow(e, r)} onkeydown={(e) => inspectRowKey(e, r)}>
```

```ts
function inspectRow(e: MouseEvent, r: Resource) {
  if ((e.target as HTMLElement).closest('button, a')) return;
  oninspect?.(r);
}
```

The guard is what lets the row be clickable while the checkbox, the name, and the two menus keep
their own meanings. `role="button"` on the row would have satisfied the a11y check more cheaply but
announces the whole row as a button and buries the controls inside it; `row` within `grid` is the
pattern that exists for a tabular list with selectable rows. The activity feed does the same, with
the role on a wrapper inside each `<li>` — a list item is not an interactive element.

Both table props are optional, so `NewTabStage`, which renders the same table with no inspector, is
unchanged. `setSelection` became the single writer for the checkbox set so all four mutation paths
notify the host.

## Supporting changes

- **`Resource.createdAt`** — Omega has always sent it on the catalog page and `toResource` dropped
  it. Keeping it spares the lens a second per-resource fetch to fill one line.
- **`SidePanel` body is a labelled `<aside>`** (`Context panel` / `Inspector panel`). Both rails
  render the same component, so without a label they are indistinguishable to anything navigating by
  structure — including a test that needs to assert a name appears *in the inspector* rather than in
  the table below it.
- **`ActivityFeed`'s list carries `aria-label="Project activity"`**, for the same addressability
  reason.
- The activity lens deliberately shows **no** resource Created/Updated block: it put a heading
  "Created" (the action) above a field "Created" (the creation date). Two meanings, one word; an
  e2e assertion tripped over it before a reader could.
- Timeline and recent-activity entries put the **action** on the first line and the actor beneath.
  A single line truncates away the word that carries the meaning, because actor names are often long
  (an email, for the dev account). This was visible in the first screenshot of the lens.

## Follow-up: the request became an enforcement ask, not a bug report

`activity-feed-access-scope.md` → **`resource-access-enforcement.md`**. Filing one endpoint's leak
invites one endpoint's patch, and the leak is not really about the activity feed — it is about
*where* access is enforced. So the request was rewritten around that, backed by an audit of every
project-scoped read in Omega.

The audit found the enforcement is real but opt-in. Five sites do it — `resources.List` (an inline
`permits` loop), `resources.Get`, `documents.List` (another inline loop), the `documentAccessGuard`
middleware, and comments — and the middleware is the right idea already, enforcing "in one place …
so a document restricted in the catalog cannot be opened, edited, or read by URL either."

The gap is that it keys on the resource named in the **URL**, and cannot see resources named in a
**response body**. Four more leaks of the same class follow directly from that:

- **`/documents/:id/references` and `/backlinks`** — the guard checks the document in the URL; the
  other end of each edge is a `Ref{Kind, ID, Name}` and is checked by nothing. A restricted document
  that links to one you can read discloses its name through that document's backlinks.
- **`/contexts/:id/resolved`** — resolves a set expression to leaf refs with no filter.
- **`/sessions`** — carries `CurrentDocumentID`, `CaretAtomID`, `CaretOffset` and the selection atom
  ids, so a restricted document discloses that it exists, who is in it, and where their caret is.
- **`/notifications`** — `Title`/`Body` are free text that can name a resource (lower confidence).

### The ask sharpened again: access should not be opt-in at all

The first draft asked Omega to "move the check to a chokepoint" and offered a menu of mechanisms.
That was too soft, and a second look at the capability layer showed why — the opt-in-ness is
visible in the type signatures:

| Capability read | Signature | Filters? |
| --- | --- | --- |
| `Resources.List` | `(projectID, req)` | no — handler must call `FilterAccessible` |
| `Documents.List` | `(projectID)` | no — handler loops over `canAccess` |
| `Activity.List` | `(projectID, req)` | no, and no handler does either |
| `Sessions.List` | `(projectID)` | no |
| `Contexts.ResolveID` | `(projectID, id)` | no |
| `References.References`/`Backlinks` | `(Scope{ProjectID}, kind, id)` | no |

**Not one project-scoped capability read takes the caller.** Access is applied entirely above them,
by handlers choosing to — so the endpoints that leak are exactly the ones nobody remembered, and
that is not a coincidence. Meanwhile `access.Context` already carries both `User` and `Project`, the
transport gate resolves them on every request, and the handler drops half of it:
`h.activity.List(ctx.Project.ID, pageReq)`.

So the ask is now: **thread the caller into the read signature** — `Scope` already exists in
`reference` and just needs a `CallerID` field — and apply the filter inside the read using the two
primitives Omega already has (`CanAccessResource`, `FilterAccessible`). Nothing new is invented; the
existing handler-side filters are inline reimplementations of `FilterAccessible`. The reason to put
it in the signature rather than add five more handler filters is what happens when someone forgets:
today a silent disclosure ships, whereas with the caller in the signature it does not compile.

Two other additions beyond "filter these five". First, a **redaction contract** in
`backend-guide.md`: today a client cannot distinguish restricted from deleted from never-existed, so
it guesses — Alpha's `deletedTargetIds` heuristic exists only because the wire says nothing. An
explicit `{"redacted": true}` with blanked identity is something a UI can render honestly. Second,
**fail closed**: `documentAccessGuard` currently returns `next(c)` when the resolver errors, so an
access check answers "allow" when it fails. `ErrNotFound` passing through is right; every other
error should deny.

The request also records what Alpha deliberately did **not** do — build the same client-side
workaround for references, backlinks, contexts, or presence. Four more reimplementations of one
access rule is how the rule ends up inconsistent, and the client cannot make the guarantee anyway.

## Follow-up: the activity lens shows THE change, not a list of them

First cut put a "Changes" list (the document's recent change sets) and a "Timeline" in the lens.
Wrong emphasis: you click one edit because you want to know what *that* edit was, and you are
already looking at a feed, so a second timeline competes with the answer.

The reordering is now **who → what document → the change → other activity**, with the change open
rather than behind a disclosure.

That required settling a question first: **is an activity event one change set, or a roll-up?** It
is exactly one, and this record's earlier claim that `SourceKind`/`SourceID` are never populated was
**wrong**:

```go
createdAt := d.now().UTC()
changeSet.CreatedAt = createdAt
cs, err := d.store.AppendChangeSet(changeSet, admissionRevision,
    newActivityFact(doc, actor, ActivityEdited, createdAt, "document.change_set", changeSet.ID))
```

One atomic write, one shared timestamp, and `activity_events` carries
`UNIQUE (source_kind, source_id)`. The fields are populated, persisted, and scanned back — only
`eventJSON` omits them. So the lens matches an event to its change set by exact `occurredAt`, which
is sound today but leans on an invariant nothing enforces; serialising the id is a ~2-line backend
change and is now filed as such rather than as "populate these fields".

It also explains the "so many edited entries" — one event per change set, and the editor flushes as
you type, so a typing session legitimately produces several.

**"Before" was fake, and is gone.** `fetchChangeSetDetail` pushed the literal word `"text"` into
`before` for a `setText` op, which rendered as a diff while saying nothing. The real prior value is
computed and stored — the change set's `InverseOps` is exactly it — but withheld:

```go
// InverseOps is the server-computed compensation stored with this revision.
// It is private persistence state used by undo, not part of the public response.
InverseOps []ChangeOp `json:"-"`
```

So it never reaches us. The function now returns an empty `before`, both
consumers drop the Before panel, label the remaining one **Result**, and say plainly that the
previous text is not returned. An empty red "Before" box would have asserted the document had been
empty beforehand — a different and false claim. Reconstructing the value by walking older change
sets was rejected: a request per hop, and wrong once history is pruned.

The document editor's own history modal shares that function and got the same treatment, so the two
surfaces cannot disagree about what a change looked like.

Both activity lists — the resource lens's "Recent activity" and the activity lens's "Other activity
on this document" — are now **clickable**, selecting that event. That answers the urge the list
creates (read "edited", want to see the edit) without turning a calm list into a stack of
dropdowns, and it makes the lens navigable rather than terminal.

## Gates

`pnpm check` 0/0 · `pnpm vitest run` 373 passed (31 files, +14 new in `lens-helpers.test.ts`) ·
`pnpm build` clean · companions OK for all 15 touched/added sources · **e2e 24/24**.

Not touched: `docs/backend-requests/README.md`, whose index would normally gain a row for the new
request. It is mid-edit in unrelated uncommitted work (the library/agents console pass, which is
adding its own rows 7 and 8), and editing it would have swept that work into this commit.
