# Backend request — project activity feed

**Priority:** Medium · **Status:** **Shipped** (real Omega `/activity` feed, integrated on Alpha main).
**Unblocks:** the **Activity** channel on the Overview stage. See
[discrepancies/overview.md](../discrepancies/overview.md).

## What the front-end needs

A **paginated activity feed** per selected project: a reverse-chronological stream of events —
who did what to which resource, and when. The Overview stage renders each as
`<actor> <action> <resource>` with a "time · day" stamp, and pages in more as the user
scrolls. `src/lib/data/overview.ts` now maps the real API into the UI shape.

Each event needs: an **actor** (id + historical display name), an **action**
(created / edited / renamed / deleted), a
**target** (the resource: id + name + kind), and a **timestamp**.

## Shipped API

```http
GET /activity?limit=8&cursor=<opaque>
  -> 200 {
       "events": [
         { "id", "actor": { "id", "name" }, "action": "edited",
           "target": { "id", "name", "kind" }, "occurredAt": "<iso8601>" }
       ],
       "nextCursor": "<opaque|null>"    # null when exhausted
     }
```

The event's snapshots make the page immediately renderable. Alpha resolves a current
actor only when it is inspected (`GET /users/:userID`) and a current target only when it
is opened (`GET /resources/:kind/:resourceID`); a 404 falls back to the snapshot.

## Front-end follow-up — done

The paired Alpha worktree implements this contract with opaque cursor paging, a
generation guard for project changes, no activity mock badge, lazy actor resolution,
and metadata resolution before opening a non-deleted target.
