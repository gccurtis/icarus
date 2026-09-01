import { browser } from "$app/environment";

export type ThemeName = "celestial" | "cyberpunk";

export const THEMES: readonly ThemeName[] = ["celestial", "cyberpunk"];

/**
 * The two ends of the light/dark axis, named as themes because that is what
 * carries it: celestial declares `color-scheme: light` and cyberpunk declares
 * `color-scheme: dark`, and every `light-dark()` in the slot table re-aims off
 * that one declaration. There is no separate dark switch to set.
 */
export const LIGHT_THEME: ThemeName = "celestial";
export const DARK_THEME: ThemeName = "cyberpunk";

/**
 * `app.html` hard-codes the default so the attribute exists at first paint. A
 * stored non-default therefore lands one frame late; that flash is accepted.
 */
export const DEFAULT_THEME: ThemeName = LIGHT_THEME;

/**
 * The key and the `{ theme }` shape are written out here rather than imported,
 * because a view reaches another view only through its root. Every surface that
 * chooses a theme spells this the same way, so a reader who picks dark in one
 * finds it dark in the others.
 */
const STORAGE_KEY = "icarus.appearance";

/**
 * What was stored, or the default. Read at construction rather than in the
 * effect so the button shows the active theme on its first render.
 *
 * Stored state is input written by an earlier version of this page, so the
 * theme is checked against the list it must belong to rather than trusted.
 */
export const storedTheme = (): ThemeName => {
  if (!browser) return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed = JSON.parse(raw) as { theme?: unknown };
    return THEMES.includes(parsed.theme as ThemeName) ? (parsed.theme as ThemeName) : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};

/**
 * Keeps the document root and browser storage in step with the choice.
 *
 * Trigger: the theme the reader returns changes.
 * Writes: `data-theme` on `<html>`, and one localStorage key.
 * Cleanup: none — the attribute is the page's lasting state, not a resource
 * this effect holds, and removing it on teardown would strip the theme from a
 * document that is still rendered.
 */
export const applyTheme = (read: () => ThemeName): void => {
  $effect(() => {
    const theme = read();

    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme }));
    } catch {
      // A full or blocked store costs persistence, not the choice itself.
    }
  });
};
