import { browser } from "$app/environment";

export type ThemeName = "celestial" | "cyberpunk";

export type Appearance = {
  theme: ThemeName;
};

export const THEMES: readonly ThemeName[] = ["celestial", "cyberpunk"];

/**
 * `app.html` hard-codes the default so the attribute exists at first paint. A
 * stored non-default therefore lands one frame late; that flash is accepted.
 */
export const DEFAULT_APPEARANCE: Appearance = { theme: "celestial" };

const STORAGE_KEY = "icarus.appearance";

/**
 * What was stored, or the default. Read at construction rather than in the
 * effect so the selects show the active value on their first render.
 *
 * Stored state is input written by an earlier version of this page, so each
 * field is checked against the list it must belong to rather than trusted.
 */
export const storedAppearance = (): Appearance => {
  if (!browser) return DEFAULT_APPEARANCE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw) as Partial<Appearance>;
    return {
      theme: THEMES.includes(parsed.theme as ThemeName) ? (parsed.theme as ThemeName) : DEFAULT_APPEARANCE.theme
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
};

/**
 * Keeps the document root and browser storage in step with the selection.
 *
 * Trigger: the appearance the reader returns changes.
 * Writes: `data-theme` on `<html>`, and one localStorage key.
 * Cleanup: none — the attribute is the page's lasting state, not a resource
 * this effect holds, and removing it on teardown would strip the theme from a
 * document that is still rendered.
 */
export const applyAppearance = (read: () => Appearance): void => {
  $effect(() => {
    const { theme } = read();

    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme }));
    } catch {
      // A full or blocked store costs persistence, not the selection itself.
    }
  });
};
