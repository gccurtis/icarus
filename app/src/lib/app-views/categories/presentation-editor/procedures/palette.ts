import type { PresentationTheme } from "$representation/data/types/presentations/body";

export type Swatch = { readonly value: string; readonly label: string; readonly token: string };

const named = (value: string, label: string): Swatch => ({
  value,
  label,
  token: value.startsWith("--") ? `var(${value})` : value
});

export const NONE: Swatch = { value: "", label: "None", token: "transparent" };

const unique = (swatches: readonly Swatch[]): Swatch[] => {
  const seen = new Set<string>();
  return swatches.filter((swatch) => {
    if (seen.has(swatch.value)) return false;
    seen.add(swatch.value);
    return true;
  });
};

export const swatchesFor = (theme: PresentationTheme): Swatch[] => unique([
  named(theme.colors.text, "Text"),
  named(theme.colors.accent, "Accent"),
  named(theme.colors.muted ?? "--token-ink-muted", "Muted"),
  named("--token-color-accent-1-fill", "Accent 1"),
  named("--token-color-accent-1-surface", "Accent 1 light"),
  named("--token-color-accent-2-fill", "Accent 2"),
  named("--token-color-accent-2-surface", "Accent 2 light"),
  named("--token-color-attention-fill", "Attention"),
  named("--token-color-success-fill", "Success"),
  named("--token-color-danger-fill", "Danger"),
  named("--token-color-intelligence-fill", "Intelligence"),
  named("--token-color-inactive-fill", "Slate"),
  named("--token-ink-primary", "Ink"),
  named("--token-ink-secondary", "Secondary"),
  named("--token-surface-elevated", "Paper"),
  named("--token-surface-panel", "Panel"),
  named("--token-border-strong", "Rule")
]);

export const withNone = (swatches: readonly Swatch[]): Swatch[] => [...swatches, NONE];

export const labelOfColor = (swatches: readonly Swatch[], value: string | undefined): string =>
  value === undefined || value === "" ? "None" : (swatches.find((swatch) => swatch.value === value)?.label ?? value);

export type Shadow = { color: string; x: number; y: number; blur: number };

export type ShadowDirection = { readonly dx: -1 | 0 | 1; readonly dy: -1 | 0 | 1 };

export const SHADOW_DIRECTIONS: readonly ShadowDirection[] = [
  { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
  { dx: -1, dy: 0 }, { dx: 0, dy: 0 }, { dx: 1, dy: 0 },
  { dx: -1, dy: 1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }
];

export const DEFAULT_SHADOW_INTENSITY = 50;

const REACH_AT_DEFAULT = 8;
const BLUR_AT_DEFAULT = 16;

export const shadowOf = (direction: ShadowDirection, intensity: number): Shadow | undefined => {
  if (intensity <= 0) return undefined;
  const scale = intensity / DEFAULT_SHADOW_INTENSITY;
  return {
    color: "--token-shadow-cast",
    x: Math.round(direction.dx * REACH_AT_DEFAULT * scale * 10) / 10,
    y: Math.round(direction.dy * REACH_AT_DEFAULT * scale * 10) / 10,
    blur: Math.round(BLUR_AT_DEFAULT * scale * 10) / 10
  };
};

export const directionOf = (shadow: Shadow | undefined): ShadowDirection =>
  shadow === undefined
    ? { dx: 1, dy: 1 }
    : { dx: Math.sign(shadow.x) as -1 | 0 | 1, dy: Math.sign(shadow.y) as -1 | 0 | 1 };

export const intensityOf = (shadow: Shadow | undefined): number =>
  shadow === undefined ? 0 : Math.round((shadow.blur / BLUR_AT_DEFAULT) * DEFAULT_SHADOW_INTENSITY);

export const FAMILIES = ["IBM Plex Sans", "IBM Plex Mono", "Charter", "Georgia", "Archivo", "Inter"] as const;
