import type { BlockFormat } from "$representation/data/types/content/block-format";
import type {
  PromptBlock,
  TextBlock,
  TextVariant
} from "$representation/data/types/content/content-block";
import type { DocumentBody } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";
import type { StyleSet, TextStyle } from "$representation/data/types/documents/style-set";

export type Styled = TextBlock | PromptBlock;

export type { StyleSet, TextStyle } from "$representation/data/types/documents/style-set";

export const BODY_FONT_SIZE = 16;
export const BODY_LINE_HEIGHT = 26;

export const FAMILIES = ["IBM Plex Sans", "IBM Plex Mono", "Georgia", "Iowan Old Style"] as const;

export const DEFAULT_STYLES: StyleSet = {
  defaultKey: "body",
  styles: {
    body: {
      name: "Body",
      fontFamily: "IBM Plex Sans",
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 26,
      spaceBefore: 0,
      spaceAfter: 16
    },
    "heading-1": {
      name: "Heading 1",
      fontFamily: "IBM Plex Sans",
      fontSize: 28,
      fontWeight: 600,
      lineHeight: 34,
      spaceBefore: 24,
      spaceAfter: 12
    },
    "heading-2": {
      name: "Heading 2",
      fontFamily: "IBM Plex Sans",
      fontSize: 22,
      fontWeight: 600,
      lineHeight: 28,
      spaceBefore: 20,
      spaceAfter: 8
    },
    "heading-3": {
      name: "Heading 3",
      fontFamily: "IBM Plex Sans",
      fontSize: 18,
      fontWeight: 600,
      lineHeight: 26,
      spaceBefore: 16,
      spaceAfter: 6
    },
    quote: {
      name: "Quote",
      fontFamily: "IBM Plex Sans",
      fontSize: 16,
      italic: true,
      lineHeight: 26,
      indent: 24,
      spaceBefore: 0,
      spaceAfter: 16
    },
    caption: {
      name: "Caption",
      fontFamily: "IBM Plex Mono",
      fontSize: 12,
      fontWeight: 400,
      lineHeight: 16,
      spaceBefore: 0,
      spaceAfter: 12
    },
    code: {
      name: "Code",
      fontFamily: "IBM Plex Mono",
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 22,
      spaceBefore: 0,
      spaceAfter: 16
    }
  }
};

const VARIANT_OF_KEY: Record<string, { variant: TextVariant; level?: number }> = {
  body: { variant: "paragraph" },
  "heading-1": { variant: "heading", level: 1 },
  "heading-2": { variant: "heading", level: 2 },
  "heading-3": { variant: "heading", level: 3 },
  quote: { variant: "quote" },
  caption: { variant: "paragraph" },
  code: { variant: "code" }
};

export const styleSetOf = (body: DocumentBody | undefined): StyleSet =>
  body?.styles ?? DEFAULT_STYLES;

export const styleOptions = (set: StyleSet): readonly { value: string; label: string }[] =>
  Object.entries(set.styles).map(([value, style]) => ({ value, label: style.name }));

const OVERRIDES = [
  "lineHeight",
  "spaceBefore",
  "spaceAfter",
  "indent",
  "horizontalAlignment",
  "background"
] as const;

export const resolve = (
  set: StyleSet,
  key: string | undefined,
  format: BlockFormat | undefined
): TextStyle => {
  const base = set.styles[key ?? set.defaultKey] ?? set.styles[set.defaultKey] ?? { name: "Body" };
  const resolved: TextStyle = { ...base };

  for (const field of OVERRIDES) {
    const value = format?.[field];
    if (value !== undefined) Object.assign(resolved, { [field]: value });
  }

  return resolved;
};

const ALIGN: Record<NonNullable<TextStyle["horizontalAlignment"]>, string> = {
  start: "start",
  center: "center",
  end: "end",
  justify: "justify"
};

export const inlineStyleOf = (style: TextStyle): string => {
  const rules: string[] = [];

  if (style.fontFamily !== undefined) rules.push(`font-family: "${style.fontFamily}"`);
  if (style.fontSize !== undefined) rules.push(`font-size: ${style.fontSize}px`);
  if (style.lineHeight !== undefined) rules.push(`line-height: ${style.lineHeight}px`);
  if (style.fontWeight !== undefined) rules.push(`font-weight: ${style.fontWeight}`);
  if (style.bold === true) rules.push("font-weight: 700");
  if (style.italic === true) rules.push("font-style: italic");
  if (style.underline === true) rules.push("text-decoration: underline");
  if (style.color !== undefined) rules.push(`color: ${style.color}`);
  if (style.background !== undefined) rules.push(`background-color: ${style.background}`);
  if (style.spaceBefore !== undefined) rules.push(`margin-top: ${style.spaceBefore}px`);
  if (style.spaceAfter !== undefined) rules.push(`margin-bottom: ${style.spaceAfter}px`);
  if (style.indent !== undefined) rules.push(`text-indent: ${style.indent}px`);
  if (style.horizontalAlignment !== undefined) {
    rules.push(`text-align: ${ALIGN[style.horizontalAlignment]}`);
  }

  return rules.join("; ");
};

export const shorthand = (style: TextStyle): string => {
  const face = style.fontFamily ?? "IBM Plex Sans";
  const size = `${style.fontSize ?? BODY_FONT_SIZE}/${style.lineHeight ?? BODY_LINE_HEIGHT}`;
  const weight = style.bold === true ? "700" : String(style.fontWeight ?? 400);
  const slant = style.italic === true ? " · italic" : "";

  return `${face} ${size} · ${weight}${slant}`;
};

const set = (path: string, value: unknown, was: unknown): DocumentOp => ({
  op: "set",
  target: "block",
  path,
  value: value ?? null,
  was: was ?? null
});

export const applyStyleOps = (block: Styled, key: string): DocumentOp[] => {
  const ops: DocumentOp[] = [];
  if (block.style !== key) ops.push(set(`${block.id}/style`, key, block.style));

  if (block.type !== "text") return ops;

  const shape = VARIANT_OF_KEY[key] ?? { variant: "paragraph" };
  if (block.variant !== shape.variant) {
    ops.push(set(`${block.id}/variant`, shape.variant, block.variant));
  }
  if ((block.level ?? null) !== (shape.level ?? null)) {
    ops.push(set(`${block.id}/level`, shape.level ?? null, block.level ?? null));
  }

  return ops;
};

export const ensureStylesOps = (body: DocumentBody): DocumentOp[] =>
  body.styles === undefined
    ? [{ op: "set", target: "document", path: "styles", value: DEFAULT_STYLES, was: null }]
    : [];

export const usageOf = (body: DocumentBody, key: string): number => {
  let count = 0;
  const set = styleSetOf(body);

  for (const row of body.rows) {
    if (row.kind !== "blocks") continue;
    for (const block of row.blocks) {
      if (block.type !== "text" && block.type !== "prompt") continue;
      if ((block.style ?? set.defaultKey) === key) count += 1;
    }
  }

  return count;
};

export const keyFrom = (name: string, taken: readonly string[]): string => {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "style";

  let key = base;
  let n = 2;
  while (taken.includes(key)) {
    key = `${base}-${n}`;
    n += 1;
  }

  return key;
};
