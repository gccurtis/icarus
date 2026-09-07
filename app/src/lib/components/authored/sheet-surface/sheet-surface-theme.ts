import type { Theme } from "@glideapps/glide-data-grid";

export type Paint = (colour: string | undefined, fallback: string) => string;

export type Measure = {
  readonly paint: Paint;
  readonly px: (token: string, fallback: number) => number;
  readonly family: (token: string) => string;
  readonly dispose: () => void;
};

const isToken = (value: string): boolean => value.startsWith("--");

export const measurer = (host: HTMLElement): Measure => {
  const probe = document.createElement("span");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  host.appendChild(probe);

  const root = getComputedStyle(document.documentElement);
  const colours = new Map<string, string>();
  const sizes = new Map<string, number>();
  const swatch = document.createElement("canvas");
  swatch.width = 1;
  swatch.height = 1;
  const normaliser = swatch.getContext("2d", { willReadFrequently: true });

  const declared = (name: string): boolean => root.getPropertyValue(name).trim() !== "";

  const hex = (channel: number): string => channel.toString(16).padStart(2, "0");

  const normalised = (value: string): string => {
    if (normaliser === null) return value;
    normaliser.clearRect(0, 0, 1, 1);
    normaliser.fillStyle = value;
    normaliser.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = normaliser.getImageData(0, 0, 1, 1).data;
    return `#${hex(r)}${hex(g)}${hex(b)}${hex(a)}`;
  };

  const colour = (name: string): string => {
    const seen = colours.get(name);
    if (seen !== undefined) return seen;
    probe.style.color = `var(${name})`;
    const answer = normalised(getComputedStyle(probe).color);
    colours.set(name, answer);
    return answer;
  };

  const paint: Paint = (wanted, fallback) => {
    const name = wanted === undefined || wanted === "" ? fallback : wanted;
    if (!isToken(name)) return normalised(name);
    return colour(declared(name) ? name : fallback);
  };

  const px = (token: string, fallback: number): number => {
    const seen = sizes.get(token);
    if (seen !== undefined) return seen;
    if (!declared(token)) return fallback;
    probe.style.fontSize = `var(${token})`;
    const answer = parseFloat(getComputedStyle(probe).fontSize);
    const size = Number.isFinite(answer) && answer > 0 ? answer : fallback;
    sizes.set(token, size);
    return size;
  };

  const family = (token: string): string => {
    probe.style.fontFamily = `var(${token})`;
    return getComputedStyle(probe).fontFamily;
  };

  const dispose = () => probe.remove();

  return { paint, px, family, dispose };
};

export const themeOf = (measure: Measure, zoom: number): Partial<Theme> => {
  const scale = zoom / 100;
  const { paint } = measure;
  const body = measure.px("--token-text-label", 13) * scale;
  const caption = measure.px("--token-text-caption", 12) * scale;

  return {
    accentColor: paint(undefined, "--token-color-active-border"),
    accentFg: paint(undefined, "--token-color-active-on-fill"),
    accentLight: paint(undefined, "--token-surface-selection"),
    textDark: paint(undefined, "--token-ink-primary"),
    textMedium: paint(undefined, "--token-ink-secondary"),
    textLight: paint(undefined, "--token-ink-muted"),
    textBubble: paint(undefined, "--token-ink-primary"),
    bgIconHeader: paint(undefined, "--token-ink-muted"),
    fgIconHeader: paint(undefined, "--token-surface-elevated"),
    textHeader: paint(undefined, "--token-ink-secondary"),
    textHeaderSelected: paint(undefined, "--token-color-active-text"),
    bgCell: paint(undefined, "--token-surface-elevated"),
    bgCellMedium: paint(undefined, "--token-surface-panel"),
    bgHeader: paint(undefined, "--token-surface-panel"),
    bgHeaderHasFocus: paint(undefined, "--token-color-active-surface"),
    bgHeaderHovered: paint(undefined, "--token-surface-panel-hover"),
    bgBubble: paint(undefined, "--token-surface-panel"),
    bgBubbleSelected: paint(undefined, "--token-color-active-surface"),
    bgSearchResult: paint(undefined, "--token-color-attention-surface"),
    borderColor: paint(undefined, "--token-border-subtle"),
    horizontalBorderColor: paint(undefined, "--token-border-subtle"),
    headerBottomBorderColor: paint(undefined, "--token-border-strong"),
    drilldownBorder: paint(undefined, "--token-border-strong"),
    linkColor: paint(undefined, "--token-color-interactive-text"),
    resizeIndicatorColor: paint(undefined, "--token-color-active-border"),
    cellHorizontalPadding: Math.round(8 * scale),
    cellVerticalPadding: Math.round(3 * scale),
    headerFontStyle: `500 ${caption}px`,
    headerIconSize: Math.round(16 * scale),
    baseFontStyle: `${body}px`,
    markerFontStyle: `${caption}px`,
    fontFamily: measure.family("--token-font-sans"),
    editorFontSize: `${body}px`,
    lineHeight: 1.4,
    roundingRadius: 0
  };
};
