# Presence keyed by project, not only by document

**Priority: Medium — one shipped surface runs on a mock.**

The context rail's **Members** lens (2026-07-29) shows who is on a project right now. Alpha can tell
the truth about exactly one person — the current user — so everyone else in its `On now` group is
placeholder data carrying a `Mock` badge and a sentence explaining why. This request is what removes
both.

## What exists today (do not rebuild it)

Omega's presence is **per document** and it is good:

```go
// core/capability/presence/presence.go
type Presence struct {
	mu    sync.Mutex
	ttl   time.Duration
	now   func() time.Time
	byDoc map[string]map[string]Entry // documentID -> userID -> Entry
}

const (
	DefaultTTL   = 30 * time.Second
	MaxOpenUsers = 20
)
```

TTL-pruned, in-memory, bounded — the right durability for presence, and Alpha's document bar already
uses it. Sessions are the other half: `GET /sessions` returns active project sessions with
`userId`, `userName`, `currentDocumentId`, `startedAt`, `lastActivityAt`.

**None of that needs changing.** The gap is narrower than it looks.

## The gap

Two things make "who is on this project" unanswerable:

1. **Presence is keyed by document id.** A user looking at the project overview, the resource table,
   or a settings dialog has no document open, so there is no entry for them anywhere — they are
   invisible to a project-scoped question.
2. **A session is only registered when a document opens.** Alpha calls `POST /sessions` from
   `DocumentStage`. That is Alpha's choice and Alpha can change it, but it only helps if there is
   something project-keyed to register *into* — otherwise a session with an empty
   `currentDocumentId` still lands nowhere useful.

The user's framing, which is the acceptance test for this request: **"you should see yourself."** A
person sitting on the project overview is present on that project, and today they cannot be told so.

## What we need

**One endpoint**: `GET /projects/:projectID/presence` (or a `projectID` filter on `/sessions` that
returns the same shape), answering with the users seen on that project inside the TTL:

```json
{
  "present": [
    { "userId": "u_123", "name": "Ada Lovelace", "since": "2026-07-29T17:58:03Z", "currentDocumentId": "d_9" }
  ]
}
```

- `currentDocumentId` optional/empty — "on the project, not in a document" is a valid, common state
  and must be representable.
- `since` lets the UI say "here for 20 minutes" rather than only "here".
- Access-filtered like the rest: a caller sees only members of a project they belong to.
- Bounded like `MaxOpenUsers`, with a total, if truncation is possible.

**One heartbeat that does not require a document.** Whatever registers presence must accept a
project-level touch — the existing `PUT /sessions/current` with an empty `currentDocumentId` is fine
if that counts as project presence rather than "no presence".

## What Alpha does when it lands

`src/lib/systems/presence/store.ts` is the only file that changes: it is a `derived` store today
precisely because there is nothing to poll. It becomes a polled read (30s, matching the TTL), the
`mock` flag on each entry goes false, and the badge and its explanatory sentence disappear from
`MembersPanel`. The `ProjectPresence` shape and the lens are already the right shape for real data.

## Related, but not the same ask

[`live-collaboration-presence.md`](live-collaboration-presence.md) (row 6) asks for a *push channel*
and `joinedAt` for the **document** presence that already exists. This one asks for a **project-keyed**
list, which is a different question with a different key. Doing row 6 does not deliver this, and doing
this does not deliver row 6 — though a push channel would obviously serve both if it is built after.
