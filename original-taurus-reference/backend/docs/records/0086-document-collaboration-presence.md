# Document collaboration + presence

The document top-bar can now show honest "Edited {relative} by {name}" attribution
that survives reload, plus live avatars of who currently has the document open.

## Endpoints (project-scoped; carry `:documentID`)

- **`GET /documents/:documentID/collaboration`** →
  `{ lastEdit: { at, actor: {kind, id, name}, source }, openUsers: [{ identity: {kind, id, name}, access, seenAt }] }`.
  - **`lastEdit`** is durable attribution: the newest activity event targeting the
    document (which spans content changes *and* resource renames), mapped to a
    `source` label (`document_change` / `resource_rename` / `created`). It falls
    back to the document's creation metadata when no event exists. This reuses the
    `targetID`-filtered activity feed (record 0085) — no new attribution store.
  - **`openUsers`** is the bounded, best-effort presence set.
- **`PUT /documents/:documentID/presence`** `{state:"open"}` → `204` — the caller's
  heartbeat; any project member may signal presence. **`DELETE …/presence`** →
  `204`, idempotent. Both `404` if the document isn't in the project (Get on
  DELETE is skipped — clearing your own presence needs no read).

## Presence capability (`core/capability/presence`)

A new **in-memory, ephemeral, TTL-pruned** tracker keyed per document — not
sqlite-backed, because presence *should* be lost on restart and must not persist
a stale "online" record. `Touch` upserts a `(user, seenAt, access)` entry;
`Clear` removes one; `Open` returns entries whose last heartbeat is within the
TTL (**`DefaultTTL` = 30 s**), newest-seen first and bounded (**`MaxOpenUsers` =
20**), pruning stale entries as a side effect. So an uncleanly closed browser
expires out instead of lingering.

## Wiring

New `collaboration` handler over `documents` + `activity` + `presence`;
`transport.Options.Presence`; routes registered alongside the document routes;
wiring builds `presence.New(presence.DefaultTTL)`. Actor `kind` is `system` for
the document system actor, `user` otherwise.

## Tests

- Unit (`core/capability/presence`): touch/clear, TTL expiry (injected clock),
  per-document isolation, newest-seen-first ordering.
- Dev-test (`dev-test/collaboration`): create + rename a document → collaboration
  reports the rename as `lastEdit` with the actor and zero viewers; a presence
  heartbeat adds the owner to `openUsers` (access `owner`); clearing (idempotent)
  empties it; an unknown document is `404`.

## Settled

- `lastEdit` is sourced from the activity feed (unifies content edits + renames),
  reusing the `targetID` filter; no second attribution store. ✓
- Presence is in-memory + TTL-backed (30 s) + bounded (20); ephemeral by design. ✓
- Any member may heartbeat; collaboration read is project-authorized via the doc. ✓
