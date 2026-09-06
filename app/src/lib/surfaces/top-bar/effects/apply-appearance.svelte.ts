import { browser } from "$app/environment";

export type Appearance = "helios" | "selene";

export const APPEARANCES: readonly Appearance[] = ["helios", "selene"];

export const DEFAULT_APPEARANCE: Appearance = "helios";

const STORAGE_KEY = "icarus.appearance";

const stored = (): Appearance => {
  if (!browser) return DEFAULT_APPEARANCE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw) as { appearance?: unknown };
    return APPEARANCES.includes(parsed.appearance as Appearance)
      ? (parsed.appearance as Appearance)
      : DEFAULT_APPEARANCE;
  } catch {
    return DEFAULT_APPEARANCE;
  }
};

let held = $state<Appearance>(stored());

export const appearance = {
  get current(): Appearance {
    return held;
  },
  set current(next: Appearance) {
    held = next;
  }
};

export const applyAppearance = (): void => {
  $effect(() => {
    document.documentElement.dataset.appearance = held;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ appearance: held }));
    } catch {
      // A full or blocked store costs persistence, not the choice itself.
    }
  });
};
