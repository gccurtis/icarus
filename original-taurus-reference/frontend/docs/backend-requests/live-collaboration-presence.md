# Backend request — a push channel for document presence

**Priority:** Low · **Status:** Open, **substantially rewritten 2026-07-28** · **Filed:** 2026-07-27

This request was audited against Omega's source on 2026-07-28 and most of it turned out to be
**already built**. The original asked for three things; Omega shipped two of them on
**2026-07-26 — one day before we filed** — and nothing on our side re-checked. Only a push
channel and one field remain.

**Most of the remaining work is ours, not yours.** Alpha is still polling `GET /sessions` and
has never called the document-presence routes at all; adopting them is
[on our roadmap](../roadmap/README.md) and needs nothing from Omega.

---

## 1. What already works — including the parts we wrongly asked for

- **Per-document presence read: `GET /documents/:documentID/collaboration`.** Returns
  `lastEdit` (`at`, `actor{kind,id,name}`, `source`) and `openUsers[]`
  (`identity{kind,id,name}`, `access`, `seenAt`). Genuinely per-document, includes the caller,
  collapses a user's multiple tabs, enforces project access, capped at 20 open users. **This
  is exactly what the original §3.1 asked for.**
- **A server-side TTL.** `presence.DefaultTTL` is **30 seconds**, pruned lazily on read, so a
  crashed tab disappears with no `DELETE`. **This is what the original §3.3 asked for** — and
  it is 30s, not the 60s we proposed, so a client heartbeat must sit comfortably under 30s.
- **Heartbeat and leave writes**: `PUT` / `DELETE /documents/:documentID/presence`.
- `lastEdit` also covers something we never asked for: we currently derive last-editor
  attribution client-side from the document history, and this replaces that.

## 2. What is genuinely missing

### 2.1 A push channel

There is no SSE or WebSocket anywhere in Omega — a source-wide search for `text/event-stream`,
`websocket`, or a streaming flusher finds only an unrelated response-writer wrapper in the
request logger. Polling is the only mechanism available.

A stream of presence changes for the open document would make a collaborator's avatar appear
and disappear in about a second instead of on a poll boundary, and would let us drop the
polling loop rather than tuning its interval against the 30s TTL.

We are not prescribing the transport — SSE is the smaller change if the gate can hold a
long-lived response; a WebSocket is fine if it suits Omega better. What we need either way: an
event when a user joins, leaves, or moves to another document, scoped to one document and
authorized exactly as the existing read is.

### 2.2 An arrival timestamp on `openUsers[]`

`seenAt` is overwritten by every heartbeat, so it means "last seen", not "arrived". There is no
way to say *"joined 5 minutes ago"* — only *"was here a moment ago"*, which is trivially true
of everyone, since anyone stale is already pruned.

A `joinedAt` (set on first touch, preserved across later ones) would let the presence list
explain itself. Small field, not a mechanism.

Publishing the TTL in the response would help too: otherwise we hardcode `30` in the client and
break silently if it ever changes.

## 3. Rules that matter to us

- **Do not change the shape of `GET /documents/:documentID/collaboration`** — we are about to
  adopt it as-is, and a push channel should carry the same identity/access vocabulary so one
  mapping serves both.
- Presence stays project-authorized exactly as the read is today.
- If a push channel lands, **the polling read must keep working** — it is the fallback when a
  stream drops and the only path for a client that cannot hold a connection.

## 4. How we will verify

1. Two browsers open the same document; the second appears in the first's avatar strip within
   ~1s of joining, with no polling.
2. One closes its tab; it disappears from the other within ~1s — and in any case within the
   TTL if the stream is down.
3. A user switching to another document leaves the first document's presence.
4. `joinedAt` stays fixed across heartbeats while `seenAt` advances.
5. With the stream unavailable, the polling read still produces the same list.

## 5. Current front-end fallback

We poll `GET /sessions` (the project-wide session list) every 30 seconds and filter by
`currentDocumentId` — the pre-presence approach, still in
`src/lib/systems/documents/collaboration.ts`. Adopting the routes in §1 is **our** next step:
swap the poll for `GET /documents/:documentID/collaboration`, heartbeat well under 30s, and
drop the client-side last-editor derivation in favour of `lastEdit`.

## 6. Why this request was wrong for a day and a half

It was filed asserting Omega had no per-document presence read and no TTL. Both had shipped the
previous day. It also claimed *"Alpha calls all of these"* about the presence write routes —
Alpha has never called them.

Two lessons, now practice: **verify a request against Omega's source before filing**, not
against our memory of it; and **re-audit open requests periodically**, because an open ask for
something the backend already built is worse than no ask at all.
