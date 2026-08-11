# Change record — 2026-07-21 — Role-carrying share links (front end)

Omega now backs sharing a project by role-carrying links (record `0033` in
taurus-omega). This wires the cockpit to it: owners mint and manage a **read** and an
**edit** link in project settings, and opening a link signs you in (if needed) and
joins you at the link's role. The old "copy the `/projects/:id` URL" affordance — which
never actually granted access — is gone.

## Share-link data functions

```ts
// src/lib/data/projects.ts
export type ShareLink = { role: 'read' | 'edit'; token: string; url: string };
fetchLinks(projectId)          // GET    /projects/:id/links   (owner)
rotateLink(projectId, role)    // PUT    /projects/:id/links/:role → {role, token}
disableLink(projectId, role)   // DELETE /projects/:id/links/:role
joinByToken(token)             // POST   /join/:token → refetch projects, return id
```

**Why:** the old `shareLink()` built a `/projects/:id` URL that Omega no longer honors.
**Purpose:** a thin client over the real link endpoints; `linkUrl` turns a token into a
`/join/:token` URL. **Why this way:** links carry the role; `joinByToken` refreshes the
project store so the newly-joined project appears immediately.

## Read/edit links in project settings

```svelte
<!-- ProjectSettingsDialog.svelte -->
// owner-only "Share links" section: read + edit rows (copy / rotate / turn off), or a
// "Create link" button; a muted note when Access isn't "Anyone with link".
// $effect on open: if (isOwner) loadLinks(id)
```

**Why:** the single mock share link becomes the real, role-carrying pair. **Purpose:**
owners see each link's `/join/` URL and can copy it, rotate it (fresh token, the old one
dies), or turn it off. **Why this way:** owner-gated (`fetchLinks` 403s otherwise), and
because visibility is the master switch, a note explains links won't work while private.

## The /join/:token landing route + sign-in return-to

```svelte
<!-- src/routes/join/[token]/+page.svelte (new) -->
// signed out → /login?next=/join/:token ; signed in → joinByToken → open the project
<!-- src/routes/login/+page.svelte -->
// after signIn, honor a same-site ?next= (else /projects)
```

**Why:** a recipient opening a link must end up in the project, signing in on the way if
needed. **Purpose:** the landing route joins by token and opens the workspace; login
returns them to the deep link. **Why this way:** a `started` guard avoids a double-join;
an unknown or disabled token (404) shows a friendly message; `next` is restricted to
same-site paths to avoid open redirects.

## Retire the dead "Copy link" list action

```svelte
<!-- src/routes/projects/+page.svelte -->
// removed the shareLink import, copyShare(), and the "Copy link" row-menu item
```

**Why:** it copied a URL that no longer grants access. **Purpose:** sharing now lives in
the settings dialog's read/edit links. **Why this way:** the row menu keeps Open (plus
Settings for owners / Leave for others) — no misleading affordance remains.

Verified: `pnpm check` (0/0) + `pnpm build`; `e2e/share-links.spec.ts` exercises the
owner's link controls and an unauthenticated `/join/:token` deep link that signs in and
lands in the project as **editor** (via the edit link), with screenshots. Full e2e suite
green.
