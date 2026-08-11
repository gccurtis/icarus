# 2026-07-29 — Members takes the rail's fourth slot; Personas leaves it

Last of five changes rebuilding the left rail's project-context set (plan, now archived:
[`docs/archive/plans/2026-07-29-project-context-rail.md`](../plans/2026-07-29-project-context-rail.md)).
The rail is now **Properties · All resources · History · Members**.

## Personas is gone from the rail

It was a read-only list of the project's AI personas. It stopped earning a rail slot when personality
authoring moved to the owner-scoped `/library/agents` console (2026-07-29) — a per-project directory is
now a strictly worse view of the same thing. The `personas` store is untouched: the dock's picker reads
it. `repairSection` is what keeps a workspace with a persisted `'personas'` section working — it no
longer resolves, so the rail normalizes to its first section.

## Members

Two groups, in the order the user specified: **On now**, then **Has access** — owner, then editors,
then viewers, alphabetical within a role. That ordering is `byAccess`, pure and unit-tested, because it
is the one detail specified exactly.

Membership is real (`GET /projects/:id/members` via the shared `roster` store). `Manage access` mounts
the same `ProjectSharing` the top-bar Share dialog and Project settings render, and `Done` forces a
roster refetch — that dialog writes membership, and a cache still serving the pre-edit list is exactly
the staleness worth being careful about.

A share link makes "who can reach this" bigger than the roster, so when `visibility === 'link'` the
lens says so in one attention-toned line rather than fudging the count upward by an unknown number of
link holders.

## Presence is mocked, per the user's call — and the mock is shaped for the real thing

Omega's presence capability is keyed by **document**:

```go
// core/capability/presence/presence.go
byDoc map[string]map[string]Entry // documentID -> userID -> Entry
```

…and Alpha only registers a session when a document opens. So today a member sitting on the project
overview is present to nobody, including themselves. The user's instruction was explicit: mock it, and
file the backend request, because *"you should see yourself."*

`systems/presence` is that mock, and three decisions make it honest:

- **What is mocked is the presence, not the people.** Entries are drawn from the real roster, so the
  lens never shows an invented colleague. Only "they are here right now" is fiction.
- **`mock` is per entry, not per list.** You are real (`mock: false`, from the session, and first in the
  list); everyone else is not. A list-level flag would have forced the UI to badge your own row as fake
  or to call the invented ones real.
- **Deterministic, never `Math.random()`.** FNV-1a over the project id and each member id. A presence
  list that reshuffled on every re-render would look like people walking in and out of the room, and
  nothing about it could be asserted in a test. Eight tests cover it, including "never includes you"
  for every member of the roster.

The store is a `derived` rather than a poller because there is nothing to poll — which also means no
timer to leak and nothing to stop on a project switch. When
[`project-level-presence.md`](../../backend-requests/project-level-presence.md) lands,
`systems/presence/store.ts` is the only file that changes: the badge and its sentence disappear on
their own because they are driven by `mocked`.

The request is row 10 of `docs/backend-requests/` and says plainly what **not** to rebuild (the TTL
tracker and sessions are good), what is missing (a project-keyed read, and a heartbeat that does not
require an open document), and why it is not row 6 — that one is a push channel for *document*
presence, a different question with a different key.

## Verification

`pnpm check` 0 errors / 0 warnings · `pnpm test` 434 → **442 passing** (8 new for the presence mock) ·
`verify-companions` OK on all seven touched sources · `pnpm build` clean · `pnpm exec playwright test
e2e/context-rail.spec.ts` 4/4, the new Members case asserting real membership, real self-presence, the
*absence* of a Mock badge in a single-member project, and that Personas is gone from the rail.
