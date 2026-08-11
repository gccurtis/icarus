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

<svelte:head><title>Taurus Alpha</title></svelte:head>

<div class="flex min-h-screen items-center justify-center bg-canvas text-muted">
  <span class="text-body-sm">Entering the citadel…</span>
</div>
