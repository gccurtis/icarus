# src/lib/features/shell/UserSettingsDialog.svelte — breakdown

Companion to [UserSettingsDialog.svelte](UserSettingsDialog.svelte). The account
settings modal opened from the top-bar avatar menu: a **real** profile section that
persists the display name to Omega (`PATCH /auth/me`) and shows the resolved identity
description, and a **real** theme control wired to the theme store.

## Script

### Props, state, and the profile save

```svelte
<script lang="ts">
  import { untrack } from 'svelte';
  import { Modal, Field, Input, Button, Avatar, Divider, Badge, toast } from '$lib/components';
  import { session, updateDisplayName } from '$data/session';
  import { isApiError } from '$data/api';
  import { UserService } from '$services/identity';
  import { theme, setTheme, type Theme } from '$lib/theme';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  const email = $derived($session.user?.email ?? '');
  const profile = $derived($session.user ? UserService.resolveFromSession($session.user) : null);

  let name = $state('');

  // Re-sync the editable name when the dialog opens.
  $effect(() => {
    open;
    name = untrack(() => $session.user?.name ?? '');
  });

  const themeOptions: { v: Theme; l: string }[] = [
    { v: 'celestial', l: 'Light' },
    { v: 'eclipse', l: 'Dark' }
  ];

  // Persist the display name to Omega (PATCH /auth/me) and refresh the session.
  async function saveProfile() {
    const next = name.trim();
    if (!next) return;
    try {
      await updateDisplayName(next);
      toast('Profile saved', { tone: 'success' });
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not save profile', { tone: 'danger' });
    }
  }
</script>

```

`open` is the bindable modal flag. `email` comes from the session; `profile` is the
resolved identity (via `UserService.resolveFromSession`) used for the description line;
`name` is the editable display name (re-synced from the session each time the dialog
opens). `themeOptions` drives the theme control.
`saveProfile` is async: it trims the name and calls `updateDisplayName` (which `PATCH`es
`/auth/me` and refreshes the session), toasting success — or, on failure, an `isApiError`
message pulled from the caught error.

## Markup — profile + theme

### Avatar, name field, and the real theme control

```svelte
<Modal bind:open title="User settings" size="lg">
  <div class="space-y-6">
    <!-- Profile (real: display name persists through Omega) -->
    <div class="flex items-center gap-3">
      <Avatar name={name || 'You'} size="lg" />
      <div class="min-w-0">
        <p class="truncate text-body font-medium text-primary">{name || 'You'}</p>
        <p class="truncate text-caption text-muted">{email || 'Not signed in'}</p>
        {#if profile}
          <p class="mt-1 text-caption leading-relaxed text-secondary">{profile.description}</p>
        {/if}
      </div>
    </div>

    <div class="flex items-end gap-2">
      <Field label="Display name" class="flex-1">
        {#snippet children({ id })}
          <Input {id} bind:value={name} placeholder="Your name" />
        {/snippet}
      </Field>
      <Button variant="secondary" onclick={saveProfile} disabled={!name.trim() || name === ($session.user?.name ?? '')}>
        Save
      </Button>
    </div>
    <Divider />

    <!-- Appearance (real: wired to the theme store) -->
    <div>
      <p class="mb-1.5 text-label font-medium text-secondary">Theme</p>
      <div class="inline-flex rounded-control border border-border bg-panel p-1">
        {#each themeOptions as opt (opt.v)}
          <button
            type="button"
            onclick={() => setTheme(opt.v)}
            class={'dur-small rounded-[5px] px-3 py-1 text-label font-medium transition-colors ' +
              ($theme === opt.v ? 'bg-work text-primary shadow-panel' : 'text-muted hover:text-secondary')}
          >
            {opt.l}
          </button>
        {/each}
      </div>
      <p class="mt-1.5 text-caption text-muted">Also toggled by clicking “taurus” in the top bar.</p>
    </div>
  </div>
</Modal>
```

Inside a `Modal`, the profile block shows the avatar (keyed off the editable name so it
updates live), the display-name field with a Save button (disabled unless the name
changed) that persists through `saveProfile`, and — when a `profile` resolved — the
identity description line. The **Theme** control is a real segmented control: each button
calls `setTheme` and highlights against the live `$theme`, so it cross-fades exactly like
the wordmark toggle.
