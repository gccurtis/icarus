import { styles, type ThemeUnit } from "./data";

const VARIABLE = /^var\((--[a-z0-9-]+)\)$/;
const LIGHT_DARK = /^light-dark\((.+),\s*(.+)\)$/;

const slotValues = new Map(styles.slotTable.map((slot) => [slot.name, slot.value]));
const tokenValues = new Map(styles.tokens.flatMap((domain) => domain.declarations.map((declaration) => [declaration.name, declaration.value] as const)));

const rampValue = (theme: ThemeUnit, name: string): string | undefined => {
  const match = name.match(/^--(palette|theme)-(.+)$/);
  if (!match) return undefined;
  if (match[1] === "theme") return theme.themeTokens.find((token) => token.name === name)?.value;
  const [hue, step] = [match[2].slice(0, match[2].lastIndexOf("-")), match[2].slice(match[2].lastIndexOf("-") + 1)];
  return theme.palette[hue]?.[step];
};

export const resolveValue = (value: string, theme: ThemeUnit, depth = 0): string => {
  if (depth > 12) return value;
  const trimmed = value.trim();
  const lightDark = trimmed.match(LIGHT_DARK);
  if (lightDark) return resolveValue(theme.scheme === "dark" ? lightDark[2] : lightDark[1], theme, depth + 1);
  const variable = trimmed.match(VARIABLE);
  if (!variable) return trimmed;
  const name = variable[1];
  const next = rampValue(theme, name) ?? slotValues.get(name) ?? tokenValues.get(name);
  return next === undefined ? trimmed : resolveValue(next, theme, depth + 1);
};

export const themeNamed = (name: string): ThemeUnit | undefined => styles.themes.find((theme) => theme.name === name);

export const isColour = (value: string): boolean => /^(#|rgb|hsl|oklch|color\()/.test(value.trim());
