export type Swatch = { readonly value: string; readonly label: string; readonly token: string };

const named = (label: string, token: string): Swatch => ({ value: token, label, token: `var(${token})` });

export const INKS: readonly Swatch[] = [
  named("Ink", "--token-ink-primary"),
  named("Secondary", "--token-ink-secondary"),
  named("Muted", "--token-ink-muted"),
  named("Accent 1", "--token-color-accent-1-fill"),
  named("Accent 2", "--token-color-accent-2-fill"),
  named("Attention", "--token-color-attention-fill"),
  named("Success", "--token-color-success-fill"),
  named("Danger", "--token-color-danger-fill"),
  { value: "", label: "None", token: "transparent" }
];

export const FILLS: readonly Swatch[] = [
  named("Accent 1", "--token-color-accent-1-surface"),
  named("Accent 2", "--token-color-accent-2-surface"),
  named("Attention", "--token-color-attention-surface"),
  named("Success", "--token-color-success-surface"),
  named("Danger", "--token-color-danger-surface"),
  named("Intelligence", "--token-color-intelligence-surface"),
  named("Panel", "--token-surface-panel-hover"),
  { value: "", label: "None", token: "transparent" }
];

export const orNone = (value: string | undefined): string => value ?? "";

export const orClear = (value: string): string | null => (value.length === 0 ? null : value);
