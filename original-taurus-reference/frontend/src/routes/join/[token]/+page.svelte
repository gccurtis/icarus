<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { session } from '$data/session';
  import { joinByToken, openProject } from '$data/projects';
  import { isApiError } from '$data/api';

  const token = $derived($page.params.token ?? '');
  let error = $state('');
  let started = $state(false);

  // Once the session has hydrated: if signed out, bounce through sign-in with a
  // return-to; if signed in, join by the token and open the project.
  $effect(() => {
    if (!$session.ready || started) return;
    const tok = token;
    if (!$session.user) {
      goto(`/login?next=${encodeURIComponent('/join/' + tok)}`, { replaceState: true });
      return;
    }
    started = true;
    void join(tok);
  });

  async function join(tok: string) {
    try {
      const projectId = await joinByToken(tok);
      try {
        await openProject(projectId);
      } catch {
        // selecting the cell is best-effort; the workspace route handles it too
      }
      await goto(`/projects/${projectId}`, { replaceState: true });
    } catch (e) {
      error =
        isApiError(e) && e.status === 404
          ? 'This link is invalid or has been turned off.'
          : isApiError(e)
            ? e.message
            : 'Could not open this shared project.';
    }
  }
</script>

<svelte:head><title>Joining… · Taurus</title></svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas px-4 text-center">
  {#if error}
    <p class="text-body text-primary">{error}</p>
    <a href="/projects" class="text-body-sm text-action hover:underline">Go to your projects</a>
  {:else}
    <span class="text-body-sm text-muted">Opening the shared project…</span>
  {/if}
</div>
