# Backend request — shared identity profiles

**Priority:** Medium · **Status:** Partially shipped
**Unblocks:** one truthful, reusable source for person and AI-persona avatars, names,
and hover cards across document presence, creation attribution, comments, history,
AI tasks, and Activity.
**Current fallbacks:** [discrepancies/documents.md](../discrepancies/documents.md) and
[discrepancies/ai-agent.md](../discrepancies/ai-agent.md).

## What already shipped

Omega provides several useful but source-specific identity shapes:

- `GET /users/:userID` returns the selected project's safe current-member summary
  `{id,name}`.
- Project membership returns `{userId,name,email,role}`.
- Activity and document history retain bounded actor snapshots.

Alpha can display a name from those sources, but it cannot resolve one stable identity
reference into the common person/persona card described by the
[identity profile manager](../plans/2026-07-23-identity-profile-manager.md). There is
also no AI-persona profile source.

## Required capability

Omega should define stable discriminated identity references and a batchable,
project-authorized resolver. One possible boundary is:

```http
POST /projects/:projectID/identities/resolve
  {
    "identities": [
      { "kind": "user", "id": "user-id" },
      { "kind": "persona", "id": "persona-id" }
    ]
  }
  -> {
       "profiles": [{
         "id": "user-id",
         "kind": "user",
         "name": "Maya Chen",
         "email": null,
         "avatarUrl": null,
         "role": "Editor",
         "description": "",
         "createdAt": null
       }],
       "unavailable": []
     }
```

The exact route is Omega's choice. The important properties are stable typed
references, bounded batch resolution, nullable optional fields, project authorization,
safe behavior for deleted/inaccessible historical actors, and a real persona source.
Email, creation time, and other profile fields must be returned only when policy
allows them; every caller must tolerate their absence.

Feature APIs should carry identity references plus any immutable historical display
snapshot they need. They should not invent unrelated person schemas independently.

## Front-end follow-up when it lands

Replace the mock records in `src/lib/data/identity-directory.ts` with a deduplicating,
bounded profile cache. Adapt collaboration, creator attribution, comments, history,
AI tasks, and Activity at their data boundaries, keeping hover-card components
presentation-only.
