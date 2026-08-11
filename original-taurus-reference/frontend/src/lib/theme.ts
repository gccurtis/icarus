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

function initialTheme(): Theme {
  if (!browser) return 'celestial';
  const saved = localStorage.getItem(KEY);
  if (saved === 'celestial' || saved === 'eclipse') return saved;
  // First run: follow the OS preference.
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'eclipse' : 'celestial';
}

export const theme = writable<Theme>(initialTheme());

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
