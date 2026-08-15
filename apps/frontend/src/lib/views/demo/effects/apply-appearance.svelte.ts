import { browser } from "$app/environment";

export type ThemeName = "celestial" | "cyberpunk";
export type SetName = "blue-primary" | "cyan-primary" | "pink-primary";

export type Appearance = {
  theme: ThemeName;
  set: SetName;
};

export const THEMES: readonly ThemeName[] = ["celestial", "cyberpunk"];
export const SETS: readonly SetName[] = ["blue-primary", "cyan-primary", "pink-primary"];

/**
 * `app.html` hard-codes the default so the attribute exists at first paint. A
 * stored non-default therefore lands one frame late; that flash is accepted.
 */
export const DEFAULT_APPEARANCE: Appearance = { theme: "celestial", set: "blue-primary" };

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
      theme: THEMES.includes(parsed.theme as ThemeName) ? (parsed.theme as ThemeName) : DEFAULT_APPEARANCE.theme,
      set: SETS.includes(parsed.set as SetName) ? (parsed.set as SetName) : DEFAULT_APPEARANCE.set
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
};

/**
 * Keeps the document root and browser storage in step with the selection.
 *
 * Trigger: the appearance the reader returns changes.
 * Writes: `data-theme` and `data-set` on `<html>`, and one localStorage key.
 * Cleanup: none — the attributes are the page's lasting state, not a resource
 * this effect holds, and removing them on teardown would strip the theme from a
 * document that is still rendered.
 */
export const applyAppearance = (read: () => Appearance): void => {
  $effect(() => {
    const { theme, set } = read();

    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.set = set;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, set }));
    } catch {
      // A full or blocked store costs persistence, not the selection itself.
    }
  });
};
