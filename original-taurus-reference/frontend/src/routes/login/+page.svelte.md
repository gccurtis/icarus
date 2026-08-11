# src/routes/login/+page.svelte — breakdown

Companion to [+page.svelte](+page.svelte). The sign-in screen: a simple, calm
email + password form with client-side validation feedback that authenticates
against Omega. The error structure mirrors the Omega auth contract: field-level
format errors plus a form-level alert for the backend's `401 invalid email or
password`.

## Script — state and validation

### Form state, email pattern, and the validator

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { signIn } from '$data/session';
  import { isApiError } from '$data/api';
  import { Button, Field, Input, Alert } from '$lib/components';

  let email = $state('');
  let password = $state('');
  let loading = $state(false);
  let emailError = $state('');
  let passwordError = $state('');
  let formError = $state('');
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
```

Three error channels: `emailError`/`passwordError` (field-level) and `formError`
(form-level, for auth failures). `validate()` sets a required/format message for
the email and a required message for the password, returning whether the form is
clean.

`expiredNotice` (2026-07-28) is seeded from the `?expired=1` query param, which the
session-expiry watcher (`$systems/session/expiry`) appends when it hard-bounces a
lapsed session here — the notice tells the user *why* they are back at sign-in.
It is initialized (not derived) so `submit()` can clear it: the notice never
stacks with a fresh credentials error.

## Script — submit

### Validate, then sign in against Omega

```svelte

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
```

Submit clears any prior form error, bails on invalid input (surfacing the field
errors), then calls the real `signIn` (`POST /auth/login`). A backend `401` becomes
the friendly "Invalid email or password."; any other `ApiError` shows its message;
anything else falls back to a generic message. On success it honors a `?next=`
query param — reading it off the `page` store — so a `/join/:token` deep link
returns the user where they were headed after signing in; the `startsWith('/')`
guard keeps the redirect same-site (no open redirect to another origin), and any
missing or off-site value falls back to `/projects`.

## Markup — heading

### Emblem and titles

```svelte

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
```

A centered card on the canvas with the haloed-ring emblem (echoing the favicon),
title, and subtitle.

## Markup — form

### Fields with error feedback and submit

```svelte

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

    <div class="mt-6 text-center">
      <button type="button" onclick={toggleTheme} …>
        {$theme === 'eclipse' ? 'Dark mode' : 'Light mode'}
      </button>
    </div>
  </div>
</div>
```

`novalidate` hands validation to us (no native browser popups). An attention-tone
`Alert` explains a session-expiry bounce when `?expired=1` brought the user here;
a form-level danger `Alert` shows `formError` when set. Each `Field` passes its `error` to render a red
message and wires `aria-describedby`; the `Input` turns red via `invalid` and
clears its error on input. The submit button shows the loading spinner.

Below the card, a quiet **theme toggle** (added 2026-07-28): sign-in is the one screen with no
other route to the theme control (the toggles live in the top bars, all behind auth). The
label names the mode currently being seen — "Dark mode" while dark — and clicking switches
both mode and label through the shared `$lib/theme` store, so the choice persists.
