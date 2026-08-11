# Backend request — compact project member summaries

**Priority:** Low · **Status:** ✅ **Shipped** — `GET /projects` returns a bounded `members` summary; Alpha renders the avatar cluster from it
**Unblocks:** truthful member avatar clusters on the projects list without issuing one
`GET /projects/:projectID/members` request per row.
**Current fallback:** [discrepancies/projects.md](../discrepancies/projects.md).

## What already shipped

Omega's dedicated member endpoints are complete and Alpha uses them in Project
Settings. `GET /projects` also returns the current user's role, but it does not include
the other members needed by the list-level avatar cluster.

## Required capability

Return a bounded member summary with each project list item, or expose an equivalent
batch projection. One workable additive shape is:

```http
GET /projects
  -> {
       "projects": [{
         "id": "...",
         "members": {
           "items": [{ "userId": "...", "name": "Maya Chen", "avatarUrl": null }],
           "total": 7
         }
       }]
     }
```

The summary should be deliberately small—enough profiles for the visible stack plus
an exact total—and must follow the same project authorization and safe public-profile
rules as the full member endpoint. Alpha does not need roles or emails for this list.

## Front-end follow-up when it lands

Map the summary in `src/lib/data/projects.ts`, render its profiles in the existing
avatar stack, and replace the current signed-in-user-only fallback. Project Settings
continues to use the full member endpoint.
