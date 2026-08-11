# src/routes/join/[token]/+page.svelte — breakdown

Companion to [+page.svelte](+page.svelte). The share-link landing route: a user
who follows a `/join/<token>` invite arrives here, and the page redeems the token
and drops them straight into the shared project. It waits for the session to
hydrate, bounces signed-out visitors through sign-in with a return-to, and shows
a calm "opening…" placeholder (or a friendly error) while the redemption runs.

## Script — imports and state

### Imports, the derived token, and reactive state

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { session } from '$data/session';
  import { joinByToken, openProject } from '$data/projects';
  import { isApiError } from '$data/api';

  const token = $derived($page.params.token ?? '');
  let error = $state('');
  let started = $state(false);
```

`token` is derived from the `[token]` route param (defaulting to an empty string).
`error` holds a user-facing failure message when redemption fails, and `started`
is a one-shot guard so the join runs exactly once even as the effect re-fires.

## Script — the gate effect

### Wait for hydration, then bounce or join

```svelte

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
```

The effect no-ops until the session is `ready` (or if a join already `started`),
so it never bounces to `/login` on the pre-hydration flicker. A signed-out visitor
is sent to `/login?next=/join/<token>` (URL-encoded return-to) with `replaceState`
so the invite URL never lingers in history. A signed-in visitor sets the `started`
guard and fires `join` for the captured token.

## Script — redeeming the token

### join — redeem, best-effort open, then navigate

```svelte

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
```

`joinByToken` redeems the invite and returns the project id. Selecting the cell via
`openProject` is best-effort — a failure is swallowed because the workspace route
resolves it too — then we navigate into `/projects/:id`, again replacing history so
Back leaves the join flow entirely. On failure the catch maps a `404` to the
friendly "invalid or turned off" message, surfaces any other `ApiError`'s message,
and falls back to a generic line for non-API errors.

## Template — head

### The document title

```svelte

<svelte:head><title>Joining… · Taurus</title></svelte:head>
```

Sets the tab title to "Joining… · Taurus" for the brief moment this route is on
screen.

## Template — status

### Error message or the "opening" placeholder

```svelte

<div class="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas px-4 text-center">
  {#if error}
    <p class="text-body text-primary">{error}</p>
    <a href="/projects" class="text-body-sm text-action hover:underline">Go to your projects</a>
  {:else}
    <span class="text-body-sm text-muted">Opening the shared project…</span>
  {/if}
</div>
```

A full-height centered column on the canvas. When `error` is set it shows the
message plus an escape hatch to `/projects`; otherwise it shows the muted "Opening
the shared project…" placeholder that covers the redemption-and-redirect window.
