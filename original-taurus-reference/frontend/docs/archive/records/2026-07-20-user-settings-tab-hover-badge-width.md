# Change record — 2026-07-20 — User settings modal, tab hover, uniform type badges

Account menu gets a real **User settings** modal (Back to projects removed), resource
tabs highlight on hover with an underline instead of a background, and the table's type
badges are all one width.

## User settings modal

```svelte
<UserSettingsDialog bind:open={userSettingsOpen} />
<!-- account Menu: { label: 'User settings', … }, { divider }, { label: 'Sign out', … } -->
```

**Why:** the avatar menu had a redundant "Back to projects" (already in the project
menu) and no place to configure the account. **How:** the account menu now opens a
new [`UserSettingsDialog`](../../../src/lib/features/shell/UserSettingsDialog.svelte) —
a profile block (editable display name that updates the cached session live, badged
**Mock** since Omega has no profile endpoint), a **real** Theme control wired to the
theme store via a new `setTheme` (cross-fading like the wordmark), and mock
notification switches. Back to projects was dropped from this menu.

## setTheme

```ts
export function setTheme(next: Theme): void { beginThemeTransition(); theme.set(next); }
```

**Why:** the settings control needs to pick a specific theme (not just toggle). **How:**
extracted the transition-enabling into `beginThemeTransition()`, shared by `toggleTheme`
and the new `setTheme`.

## Resource-tab hover

```svelte
: 'text-muted hover:text-secondary hover:underline hover:underline-offset-4'  <!-- was hover:bg-panel -->
```

**Why:** filling an idle tab with the panel background on hover was noisy. **How:** idle
resource tabs now stay background-free and simply brighten + underline their label on
hover.

## Uniform type badges

```svelte
<Badge tone={meta.tone} class="w-28 justify-center">{meta.label}</Badge>
```

**Why:** the type pills were ragged (each sized to its label). **How:** every Type badge
is now `w-28` with centered text, so they all match the widest label (“Spreadsheet”).
