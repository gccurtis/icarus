# ProjectSharing.svelte

Everything about **who can reach a project**: its access mode, its role-carrying share links, and
its members. Rendered by *both* the top-bar Share dialog and Project settings.

## Why it exists

The top bar's Share dialog was a **41-line mock** that copied a fixed `/join/mock-share-token` and
changed no access — while `ProjectSettingsDialog`, a few files away, did the whole thing for real
against Omega. Two surfaces for one concept, one of them lying.

This component is that logic, extracted once. Both dialogs render it, so they **cannot drift**, and
un-mocking Share required no backend work at all — every call it makes was already shipped and
already in use (workstream E).

## Lazy by construction

```svelte
$effect(() => {
  const id = projectId;
  members = []; shareLinks = []; membersError = '';
  if (!id) return;
  void loadMembers(id); void loadLinks(id);
});
```

`Modal` renders its children behind `{#if open}`, so **mounting this component is the lazy load** —
there is no `open` prop and no open-guard. The settings dialog used to carry that guard itself; it
is gone.

Every write re-checks `projectId === id` before committing, so switching projects mid-flight cannot
land the previous project's members in the list.

## The three sections

**Access** is the master switch (`private` / `link`) — the share links do nothing while a project is
private, and the panel says so rather than letting a user mint a link that silently won't work.
Non-owners see the control disabled with a one-line reason.

**Share links** are owner-only, one per role (`read`, `edit`). `rotate` doubles as create — Omega's
`PUT /links/:role` is an upsert, so "Create read link" and "Rotate" are the same call. Turning one
off is `DELETE`. `loadLinks` swallows its error on purpose: the route is owner-only, and a non-owner
simply gets no link controls rather than an error they can do nothing about.

**Members** is the real `GET`/`POST`/`PATCH`/`DELETE /projects/:id/members`. The signed-in user
renders as "You" and cannot change their own role or remove themselves — an owner locking
themselves out of their own project is the one irreversible mistake here.

## The `compact` prop

`compact` drops the member list, leaving access + links. Nothing passes it today; it exists because
the Share dialog is the obvious place to want a links-only view, and the alternative — a second
trimmed copy of this markup — is exactly what this component was created to prevent.
