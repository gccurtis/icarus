export type Swatch = { readonly value: string; readonly label: string; readonly token: string };

const named = (label: string, token: string): Swatch => ({ value: token, label, token });

export const INKS: readonly Swatch[] = [
  named("Ink", "var(--token-ink-primary)"),
  named("Secondary", "var(--token-ink-secondary)"),
  named("Muted", "var(--token-ink-muted)"),
  named("Accent 1", "var(--token-color-accent-1-fill)"),
  named("Accent 2", "var(--token-color-accent-2-fill)"),
  named("Attention", "var(--token-color-attention-fill)"),
  named("Success", "var(--token-color-success-fill)"),
  named("Danger", "var(--token-color-danger-fill)")
];

export const FILLS: readonly Swatch[] = [
  named("Accent 1", "var(--token-color-accent-1-surface)"),
  named("Accent 2", "var(--token-color-accent-2-surface)"),
  named("Attention", "var(--token-color-attention-surface)"),
  named("Success", "var(--token-color-success-surface)"),
  named("Danger", "var(--token-color-danger-surface)"),
  named("Intelligence", "var(--token-color-intelligence-surface)"),
  named("Panel", "var(--token-surface-panel-hover)"),
  { value: "", label: "None", token: "transparent" }
];

export const orNone = (value: string | undefined): string => value ?? "";

export const orClear = (value: string): string | undefined => (value.length === 0 ? undefined : value);

/** Stored theme-token names become valid CSS only at the presentation boundary. */
export const cssColour = (value: string | undefined): string | undefined =>
  value?.startsWith("--") === true ? `var(${value})` : value;
