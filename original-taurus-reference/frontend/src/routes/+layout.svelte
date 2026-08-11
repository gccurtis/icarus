<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import '$lib/theme'; // activate the theme store (mirror to <html data-theme> + storage)
  import { hydrateSession, watchSessionExpiry } from '$data/session';
  import { Toaster } from '$lib/components';

  let { children } = $props();

  // Load the current user from the session cookie once, app-wide — and keep
  // watching: a mid-session 401 (or a lapsed session discovered when the tab
  // becomes visible again) hard-bounces to /login?expired=1 instead of letting
  // the UI keep running on stale signed-in state.
  onMount(() => {
    const teardown = watchSessionExpiry();
    hydrateSession();
    return teardown;
  });
</script>

{@render children()}

<!-- The one app-wide toast outlet. Until 2026-07-28 it was mounted only on the
     /components showcase, so every toast() in the real app rendered to nothing. -->
<Toaster />
