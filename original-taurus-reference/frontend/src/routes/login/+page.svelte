<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { signIn } from '$data/session';
  import { isApiError } from '$data/api';
  import { theme, toggleTheme } from '$lib/theme';
  import { Button, Field, Input, Alert } from '$lib/components';

  let email = $state('');
  let password = $state('');
  let loading = $state(false);
  let emailError = $state('');
  let passwordError = $state('');
  let formError = $state('');
  // Set when the session-expiry watcher bounced us here (?expired=1) — tells
  // the user WHY they are back at sign-in. Cleared on the next attempt so it
  // never stacks with a credentials error.
  let expiredNotice = $state($page.url.searchParams.get('expired') === '1');

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validate(): boolean {
    emailError = !email.trim()
      ? 'Email is required.'
      : !EMAIL_RE.test(email.trim())
        ? 'Enter a valid email address.'
        : '';
    passwordError = password ? '' : 'Password is required.';
    return !emailError && !passwordError;
  }

  async function submit(e: Event) {
    e.preventDefault();
    formError = '';
    expiredNotice = false;
    if (!validate()) return;
    loading = true;
    try {
      await signIn(email.trim(), password);
      // Honor a same-site ?next= (e.g. a /join/:token deep link), else the projects screen.
      const next = $page.url.searchParams.get('next');
      await goto(next && next.startsWith('/') ? next : '/projects');
    } catch (err) {
      formError =
        isApiError(err) && err.status === 401
          ? 'Invalid email or password.'
          : isApiError(err)
            ? err.message
            : 'Something went wrong signing in. Please try again.';
      loading = false;
    }
  }
</script>

<svelte:head><title>Sign in · Taurus</title></svelte:head>

<div class="flex min-h-screen items-center justify-center bg-canvas px-4">
  <div class="w-full max-w-sm">
    <div class="mb-6 flex flex-col items-center gap-3 text-center">
      <span class="flex size-12 items-center justify-center rounded-overlay bg-action/10">
        <svg class="size-6 text-focus" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <circle cx="16" cy="16" r="9" stroke="currentColor" stroke-width="2.5" />
          <circle cx="16" cy="16" r="2.5" fill="currentColor" />
        </svg>
      </span>
      <div>
        <h1 class="text-h3 font-semibold text-primary">Sign in to Taurus</h1>
        <p class="mt-1 text-body-sm text-muted">Enter the citadel.</p>
      </div>
    </div>

    <form onsubmit={submit} class="surface-elevated space-y-4 p-6" novalidate>
      {#if expiredNotice}
        <Alert tone="attention">Your session expired — sign in to continue.</Alert>
      {/if}
      {#if formError}
        <Alert tone="danger">{formError}</Alert>
      {/if}
      <Field label="Email" error={emailError}>
        {#snippet children({ id, describedby })}
          <Input
            {id}
            aria-describedby={describedby}
            type="email"
            bind:value={email}
            invalid={!!emailError}
            oninput={() => (emailError = '')}
            placeholder="you@example.com"
            autocomplete="email"
          />
        {/snippet}
      </Field>
      <Field label="Password" error={passwordError}>
        {#snippet children({ id, describedby })}
          <Input
            {id}
            aria-describedby={describedby}
            type="password"
            bind:value={password}
            invalid={!!passwordError}
            oninput={() => (passwordError = '')}
            placeholder="••••••••"
            autocomplete="current-password"
          />
        {/snippet}
      </Field>
      <Button type="submit" {loading} class="w-full">Sign in</Button>
    </form>

    <!-- The label names the mode you are currently seeing; clicking switches.
         Sign-in is the one screen with no other route to the theme control. -->
    <div class="mt-6 text-center">
      <button
        type="button"
        onclick={toggleTheme}
        class="dur-micro text-caption text-muted transition-colors hover:text-primary"
      >
        {$theme === 'eclipse' ? 'Dark mode' : 'Light mode'}
      </button>
    </div>
  </div>
</div>
