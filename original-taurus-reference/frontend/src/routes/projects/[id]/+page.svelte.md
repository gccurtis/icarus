# src/routes/projects/[id]/+page.svelte — breakdown

Companion to [+page.svelte](+page.svelte). The project workspace route: it resolves
the project by id and renders the [AppShell](../../../lib/features/shell/AppShell.svelte)
(the full shell replaced the earlier "coming soon" stub).

## Script

### Resolve project, guard auth, load if needed

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { session } from '$data/session';
  import { projects, fetchProjects, openProject } from '$data/projects';
  import AppShell from '$lib/features/shell/AppShell.svelte';

  const id = $derived($page.params.id ?? '');
  const project = $derived($projects.find((p) => p.id === id) ?? null);
  let loaded = $state(false);
  let selectedId = $state('');

  // Client-only (ssr=false layout): guard auth, and load projects if we arrived
  // here directly (so the project name resolves).
  $effect(() => {
    if (!$session.ready) return;
    if (!$session.user) {
      goto('/login', { replaceState: true });
    } else if (!loaded && $projects.length === 0) {
      loaded = true;
      fetchProjects().catch(() => {});
    }
  });

  // Select the project on the session (idempotent) — project-scoped APIs like
  // /documents 409 without a selected project, e.g. on a direct reload.
  $effect(() => {
    if ($session.user && id && selectedId !== id) {
      selectedId = id;
      openProject(id).catch(() => {});
    }
  });
</script>
```

`id` comes from the route; `project` is derived from the projects store. The first
`$effect` waits for session hydration, redirects anonymous users, and — if you
navigated straight here (empty store) — loads projects once so the name resolves. The
second **selects the project on the session** (`POST /session/project`, once per id):
project-scoped APIs like `/documents` answer 409 without a selected project, which
otherwise breaks a direct reload of a workspace URL.

## Markup

### Render the shell (or a loading fallback)

```svelte

<svelte:head><title>{project?.name ?? 'Project'} · Taurus</title></svelte:head>

{#if $session.user}
  <AppShell projectId={id} projectName={project?.name ?? 'Project'} projectIcon={project?.icon ?? 'focus'} />
{:else}
  <div class="flex min-h-screen items-center justify-center bg-canvas text-muted">
    <span class="text-body-sm">Loading…</span>
  </div>
{/if}
```

When signed in, it mounts `AppShell` with the project id and name (falling back to
"Project" until the name loads); otherwise a brief loading fallback shows while the
session resolves / redirects.
