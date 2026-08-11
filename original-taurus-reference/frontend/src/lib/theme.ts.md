# src/lib/theme.ts — breakdown

Companion to [theme.ts](theme.ts). App-wide light/dark theme store. The value is
written to `<html data-theme>`, which drives every token in
[app.css](../app.css) (`:root`/`[data-theme='celestial']` = light,
`[data-theme='eclipse']` = dark). The center "taurus" wordmark in the top bar toggles
it; a pre-paint script in [app.html](../app.html) sets the attribute before first
paint so there's no flash.

## Imports, the Theme type, and the storage key

### Store imports, the two-value `Theme` union, and the localStorage key

```ts
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * App-wide light/dark theme. The value is written to `<html data-theme>`, which
 * drives every token in app.css (`:root`/`[data-theme='celestial']` = light,
 * `[data-theme='eclipse']` = dark). A tiny inline script in app.html sets the
 * attribute before first paint (no flash); this store keeps it in sync afterwards.
 */
export type Theme = 'celestial' | 'eclipse';

const KEY = 'taurus:theme';

```

Imports the `writable` store factory and SvelteKit's `browser` flag. `Theme` is the
two-value union — `celestial` (light) and `eclipse` (dark) — used everywhere the
theme is passed around, and `KEY` is the `localStorage` key the choice persists under
(the same key the pre-paint script in app.html reads).

## Initial theme and the store

### Resolve the starting theme, then create the writable

```ts
function initialTheme(): Theme {
  if (!browser) return 'celestial';
  const saved = localStorage.getItem(KEY);
  if (saved === 'celestial' || saved === 'eclipse') return saved;
  // First run: follow the OS preference.
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'eclipse' : 'celestial';
}

export const theme = writable<Theme>(initialTheme());

```

`initialTheme()` decides the starting value: the light default under SSR (no
`browser`), otherwise a previously saved choice, falling back on first run to the OS
`prefers-color-scheme`. `theme` is the writable store seeded with that value — the
single source other modules subscribe to.

## The transition helper

### Briefly enable the global color cross-fade around a switch

```ts
let transitionTimer: ReturnType<typeof setTimeout> | undefined;

// Enable the global color transition (app.css) just for the switch, then drop it so
// colors don't animate during normal interaction.
function beginThemeTransition(): void {
  if (!browser) return;
  const root = document.documentElement;
  root.classList.add('theme-transition');
  clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => root.classList.remove('theme-transition'), 600);
}

```

`beginThemeTransition()` adds the `.theme-transition` class to `<html>` so the colors
cross-fade (the rule lives in app.css), then removes it after 600ms so colors don't
animate during ordinary interaction. `transitionTimer` holds the pending removal so a
rapid re-switch clears the previous timeout instead of stacking them.

## setTheme and toggleTheme

### The two public mutators, each wrapping the switch in a transition

```ts
/** Set the theme explicitly (used by the settings control), cross-fading the colors. */
export function setTheme(next: Theme): void {
  beginThemeTransition();
  theme.set(next);
}

/** Flip between light (celestial) and dark (eclipse), cross-fading the colors. */
export function toggleTheme(): void {
  beginThemeTransition();
  theme.update((t) => (t === 'eclipse' ? 'celestial' : 'eclipse'));
}

```

The two exported ways to change the theme. `setTheme(next)` sets an explicit value
(used by the settings control); `toggleTheme()` flips between the two (the wordmark).
Both call `beginThemeTransition()` first so the change cross-fades.

## DOM + storage sync subscription

### Mirror every change to `<html data-theme>` and localStorage

```ts
// Mirror the store to <html data-theme> and localStorage on every change.
if (browser) {
  theme.subscribe((t) => {
    document.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      // Ignore storage failures (private mode, quota).
    }
  });
}
```

A single client-only subscription is the write side of the store: on every change it
sets `<html data-theme>` (driving the app.css tokens) and persists the value to
`localStorage`, swallowing storage errors (private mode, quota). Importing this module
once in the root layout activates the subscription app-wide.
