# Deferred — notifications feed

**Decided:** 2026-07-27 · **Backend ready:** ✅ yes, and unused · **Revisit:** no trigger set

## The decision

Alpha is **not building a notifications feed**, even though Omega ships one.

## What exists

Omega serves `GET /notifications` (a drain-style endpoint — reading consumes). It landed as gap
**G2** in the 2026-07-25 backend push, before this decision.

Alpha has no notifications UI. Earlier planning documents listed it as a "still mock / deferred"
surface, which read like unfinished work; it is not.

## Why we are not building it

The **Activity feed** on the Overview stage already answers "what happened in this project" — who
did what to which resource, when, paged. A notifications feed would be a second, less complete
answer to the same question, with the extra burden of unread state, a badge, and a read model.

Nothing in the product currently *generates* a notification a user could not see more usefully in
Activity. Building the surface first would mean inventing the events to fill it.

## What this means for the backend

**Nothing is requested.** `GET /notifications` can stay as it is; Alpha simply does not call it.
This is explicitly *not* a backend request — see
[`docs/backend-requests/README.md`](../backend-requests/README.md) → "Deliberately not requested".

## What would change our mind

Notifications become worth building when there is something to notify *about* that Activity cannot
carry — work that finishes while you are elsewhere and needs your attention:

- an agent **task** completing, failing, or asking a question hours later;
- someone **@-mentioning** you in a comment;
- a **share invitation** or role change affecting your access.

The first of those is the likely trigger, since agent tasks are already durable and long-running.
When one of these lands, move this file out of `deferred/` with a dated note.
