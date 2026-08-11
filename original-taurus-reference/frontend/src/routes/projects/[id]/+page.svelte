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

<svelte:head><title>{project?.name ?? 'Project'} · Taurus</title></svelte:head>

{#if $session.user}
  <AppShell projectId={id} projectName={project?.name ?? 'Project'} projectIcon={project?.icon ?? 'focus'} />
{:else}
  <div class="flex min-h-screen items-center justify-center bg-canvas text-muted">
    <span class="text-body-sm">Loading…</span>
  </div>
{/if}
