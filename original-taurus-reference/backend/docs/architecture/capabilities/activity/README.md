# Activity

Activity is the immutable, Project-scoped read model of confirmed user-visible
Resource effects. It is intentionally narrower than request logging, audit,
Document history, or agent memory.

## Event model

Each event stores a stable ID, Project ID, the action (`created`, `edited`,
`renamed`, or `deleted`), an actor ID/display-name snapshot, a target
ID/kind/name snapshot, the occurrence time, and a unique owner-source identity.
Snapshots keep deleted or later-renamed Resources understandable without
retaining their content. Events never contain document bodies, prompts,
provider responses, errors, or arbitrary JSON.

## Write path

There is no Activity append endpoint and the Activity service exposes only
reads. Document create, change-set append, rename, and delete construct a closed
Document fact. The SQLite Document store commits that fact to
`activity_events` in the same transaction as the canonical mutation. If either
write fails, neither survives. Rebase is representation maintenance and emits
nothing.

This owner-transaction rule is the central invariant: the feed describes
effects that actually committed, never claims made after the fact by a client,
handler, or model.

## Read path and paging

`GET /activity?limit=8&cursor=…` requires a selected Project. The default is 8,
the maximum is 100, and ordering is `occurredAt DESC, id DESC`. The opaque
versioned cursor encodes only the last ordering tuple; it conveys no authority.
Malformed cursors and out-of-range limits return 400.

The feed returns historical actor and target snapshots, so drawing one page
never requires live joins. Clients may resolve an actor only when inspected via
`GET /users/:userID` (a safe `{id,name}` projection for current selected-Project
members) and a target only when opening it via
`GET /resources/:kind/:resourceID` (current canonical metadata). A 404 is
expected for departed members and deleted targets; the stored snapshot remains
the correct history in that case. These point reads do not make Activity an
owner of User or Resource state.

`LatestByProjects` performs the batched latest-event read used by Project
responses to compose aggregate `updatedAt` values.

## Persistence

SQLite indexes `(project_id, occurred_at DESC, id DESC)` and uniquely constrains
`(source_kind, source_id)`. Activity remains after its target Document is
deleted, while deleting a Project removes its usefulness through Project scope.
The deterministic in-memory store accepts initial events for isolated paging
tests but provides no production writer.
