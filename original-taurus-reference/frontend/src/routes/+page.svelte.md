# src/routes/+page.svelte — breakdown

Companion to [+page.svelte](+page.svelte). The entry gate: once the session has
hydrated, it routes to the project selection screen when signed in, or to sign-in
otherwise. (This replaced the earlier throwaway token showcase, which now lives at
`/components`.)

## Script

### Redirect once the session is ready

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { session } from '$data/session';

  // Entry gate: once the session has hydrated, route to the project selection
  // screen when signed in, or to sign-in otherwise.
  $effect(() => {
    if ($session.ready) {
      goto($session.user ? '/projects' : '/login', { replaceState: true });
    }
  });
</script>
```

The `$effect` waits for `$session.ready` (set once the root layout's `/auth/me`
hydration resolves), then navigates to `/projects` or `/login` based on whether a
user is present, using `replaceState` so the gate leaves no history entry.

## Markup

### A brief loading state

```svelte

<svelte:head><title>Taurus Alpha</title></svelte:head>

<div class="flex min-h-screen items-center justify-center bg-canvas text-muted">
  <span class="text-body-sm">Entering the citadel…</span>
</div>
```

A calm placeholder shown while the session hydrates and the redirect resolves.
