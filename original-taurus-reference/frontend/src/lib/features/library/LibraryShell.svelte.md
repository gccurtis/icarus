# `LibraryShell.svelte` — the frame every library space shares

Top bar (Back, the space nav, the Mock badge, theme, account), the auth bounce, and the
three-column body the space fills. `LibraryConsole` (Context/Templates) and `AgentsConsole` both
render inside it, so the spaces cannot drift apart in chrome. Extracted when the Agents space
arrived — its rail and center are a different shape, and duplicating the top bar was the wrong
kind of sharing.

## Routes, not tabs

```svelte
$effect(() => { if ($session.ready && !$session.user) goto('/login', { replaceState: true }); });
```

The library spaces are user- and organization-scoped, so they must be reachable from project
selection — where there is no workspace shell and no tab strip. The shell therefore owns its own
top bar and its own auth bounce (the same rule `/projects` uses).

It deliberately does **not** mount a `Toaster`: the root layout already mounts the app-wide one
(the 2026-07-28 fix), and a second mount renders every toast twice — the agents e2e caught
exactly that, as a strict-mode violation on a toast locator resolving to two elements.

## The space nav

**Agents, Context, Templates — in that order.** Agents leads because monitoring live work is the
most time-sensitive thing the libraries hold. The active space renders `text-primary`, the others
`text-muted`. The `MockBadge` sits beside the nav because every space currently runs on fixtures;
it moves out per-space as real data lands.

## Back means "back to the project"

```svelte
const projectId = $workspace?.projectId;
goto(projectId ? `/projects/${projectId}` : '/projects');
```

Not `history.back()` — the spaces cross-link, so walking history mostly landed on another library
space. `workspace` still holds the last project entered this session (library routes never call
`enterProject`); a cold deep link has none, so the project list is the honest destination. The
button's `title` says which of the two it will do.
