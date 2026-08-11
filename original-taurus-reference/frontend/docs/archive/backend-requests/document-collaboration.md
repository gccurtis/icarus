# Backend request — document edit attribution and presence

**Priority:** Medium · **Status:** Partially shipped
**Unblocks:** unified "edited by" metadata across content changes and resource renames,
plus live open-user avatars in the document top bar.

The person summaries should use the same stable actor references and public-profile
shape needed by comments, Activity, document creation attribution, and AI-persona
surfaces. Alpha will resolve and cache those references through the
[identity profile manager](../plans/2026-07-23-identity-profile-manager.md), keeping
presence transport out of avatar/profile components.

## What the front-end needs

The document bar now has the intended collaboration shape:

- a real resource name, renamed in place through the shipped Resource endpoint;
- a real last-edit time from Resource/document timestamps, rendered relatively with
  the full timestamp available on hover;
- the user responsible for that latest edit; and
- the bounded set of project members who currently have the document open, including
  enough public profile data for avatar hover cards.

Omega supplies the first two pieces. Its shipped document-history summaries also
provide trusted author snapshots for content revisions, so content-edit attribution
does not need a new history API. What is still missing is one latest-mutation
projection that accounts for both document changes and Resource renames, plus
ephemeral document presence. Alpha therefore badges the attribution/presence region as
**Mock** and supplies its placeholder people through
`src/lib/data/document-collaboration.ts`.

## Proposed contract

Omega owns the final shape. One workable boundary is:

```http
GET /documents/:documentID/collaboration
  -> 200 {
       "lastEdit": {
         "at": "2026-07-23T16:21:00Z",
         "actor": { "kind": "user", "id": "user-id", "name": "Maya Chen" },
         "source": "document_change"
       },
       "openUsers": [
         {
           "identity": { "kind": "user", "id": "user-id", "name": "Maya Chen" },
           "access": "editor",
           "seenAt": "2026-07-23T16:21:08Z"
         }
       ]
     }

PUT /documents/:documentID/presence
  { "state": "open" }
  -> 204

DELETE /documents/:documentID/presence
  -> 204
```

Presence should be project-authorized, ephemeral, bounded, and TTL-backed so an
uncleanly closed browser cannot leave a durable "online" record. Alpha can heartbeat
the `PUT` while the stage is mounted and poll the collaboration projection initially;
Omega may replace polling with a project-authorized stream later without changing the
UI shape.

`lastEdit` should reflect the latest canonical content change or Resource rename and
carry a stable actor reference plus a historical display-name snapshot. It is durable
historical attribution, unlike the best-effort `openUsers` projection. Alpha resolves
richer current cards through the shared
[identity-profile request](identity-profiles.md); collaboration transport should not
invent a second profile schema.

## What it unblocks

- Honest "Edited {relative time} by {name}" document metadata after reload.
- Real stacked avatars and profile hover cards for people currently viewing/editing.
- Later cursor/selection presence without overloading document change-set history.

## Front-end follow-up when it lands

Replace `documentBarCollaboration`'s placeholder records with the real projection,
remove the **Mock** badge, start/stop the presence heartbeat with `DocumentStage`, and
add multi-session tests for TTL expiry and project authorization.
