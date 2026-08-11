# src/routes/+layout.svelte — breakdown

Companion to [+layout.svelte](+layout.svelte). The root layout wrapping every
route: it loads the global stylesheet, hydrates the session once app-wide, keeps
watching for session expiry, and renders the active page.

## Script

### Import styles, hydrate session, watch for expiry, receive children

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import '$lib/theme'; // activate the theme store (mirror to <html data-theme> + storage)
  import { hydrateSession, watchSessionExpiry } from '$data/session';
  import { Toaster } from '$lib/components';

  let { children } = $props();

  onMount(() => {
    const teardown = watchSessionExpiry();
    hydrateSession();
    return teardown;
  });
</script>
```

Importing `../app.css` applies fonts, Tailwind, and theme globally. The side-effect
import of [`$lib/theme`](../lib/theme.ts) activates the theme store's subscription so
light/dark changes mirror to `<html data-theme>` and persist app-wide. `onMount`
(client only) installs the session-expiry watcher **before** hydrating, then calls
`hydrateSession()` once so every route sees a populated (or resolved-signed-out)
session. The watcher (see [`$systems/session/expiry`](../lib/systems/session/expiry.ts.md),
added 2026-07-28) is why an expired session no longer lingers as stale signed-in UI:
any mid-session 401, or a lapsed session discovered when the tab becomes visible
again, hard-bounces to `/login?expired=1&next=…`. Hydration's own anonymous 401 is
exempt inside the watcher (no user in the store yet), so the install order is safe.

## Markup

### Render the active page, plus the one toast outlet

```svelte

{@render children()}

<Toaster />
```

Renders the current route's content with no surrounding chrome, so pages own their
full-screen structure. After it, the app-wide `Toaster` — the single subscriber of the
`$lib/toast` store, a fixed bottom-right overlay. **Until 2026-07-28 it was mounted only on
the `/components` showcase**, so every `toast()` the real app fired (import confirmations,
sharing errors, rename failures…) rendered to nothing; the library pass's e2e was the first
test to assert a toast and caught it.
