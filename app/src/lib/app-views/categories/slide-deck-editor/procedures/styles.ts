import type {
  ContentBlock,
  PromptBlock,
  TextBlock
} from "$representation/data/types/content/content-block";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
import type { TextStyle } from "$representation/data/types/slide-decks/style-set";
import type { Edit } from "$app-views/categories/slide-deck-editor/procedures/deck-edit";
import { placedOn } from "$app-views/categories/slide-deck-editor/procedures/deck-placement";
import { withSet, withSets } from "$app-views/categories/slide-deck-editor/procedures/deck-values";
import { FAMILIES } from "$app-views/categories/slide-deck-editor/procedures/palette";

export type { TextStyle } from "$representation/data/types/slide-decks/style-set";

export const styleOptions = (body: SlideDeckBody | undefined): readonly { value: string; label: string }[] =>
  Object.entries(body?.styles.styles ?? {}).map(([value, style]) => ({ value, label: style.name }));

export const familyOptions = (): readonly { value: string; label: string }[] =>
  FAMILIES.map((family) => ({ value: family, label: family }));

export const styleSummary = (style: TextStyle): string => {
  const family = style.fontFamily ?? "IBM Plex Sans";
  const size = style.fontSize ?? 20;
  const lineHeight = style.lineHeight ?? 1.3;
  const traits = [
    style.bold === true || (style.fontWeight ?? 0) >= 600 ? "bold" : undefined,
    style.italic === true ? "italic" : undefined
  ].filter((value): value is string => value !== undefined);
  return `${family} ${size}/${lineHeight}${traits.length === 0 ? "" : ` · ${traits.join(" · ")}`}`;
};

const keyFrom = (name: string, taken: readonly string[]): string => {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "style";
  let key = base;
  let suffix = 2;
  while (taken.includes(key)) {
    key = `${base}-${suffix}`;
    suffix += 1;
  }
  return key;
};

export const styleFieldsEdit = (
  body: SlideDeckBody,
  key: string,
  patch: Partial<TextStyle>
): Edit => {
  const style = body.styles.styles[key];
  if (style === undefined) return { body, ops: [] };
  return withSets(
    body,
    (Object.entries(patch) as [keyof TextStyle, TextStyle[keyof TextStyle]][])
      .filter(([field, value]) => JSON.stringify(style[field] ?? null) !== JSON.stringify(value ?? null))
      .map(([field, value]) => ({
        target: "deck" as const,
        path: `styles/styles/${key}/${field}`,
        value: value ?? null
      }))
  );
};

export const styleFieldEdit = <K extends keyof TextStyle>(
  body: SlideDeckBody,
  key: string,
  field: K,
  value: TextStyle[K] | undefined
): Edit => styleFieldsEdit(body, key, { [field]: value });

export const defaultStyleEdit = (body: SlideDeckBody, key: string): Edit =>
  body.styles.styles[key] === undefined || body.styles.defaultKey === key
    ? { body, ops: [] }
    : withSet(body, "deck", "styles/defaultKey", key);

export const newStyleEdit = (
  body: SlideDeckBody
): { readonly edit: Edit; readonly key: string } => {
  const keys = Object.keys(body.styles.styles);
  const key = keyFrom("New style", keys);
  const base = body.styles.styles[body.styles.defaultKey] ?? { name: "Body" };
  return {
    key,
    edit: withSet(body, "deck", `styles/styles/${key}`, { ...base, name: "New style" })
  };
};

export const duplicateStyleEdit = (
  body: SlideDeckBody,
  key: string
): { readonly edit: Edit; readonly key: string | undefined } => {
  const style = body.styles.styles[key];
  if (style === undefined) return { edit: { body, ops: [] }, key: undefined };
  const name = `${style.name} copy`;
  const made = keyFrom(name, Object.keys(body.styles.styles));
  return { key: made, edit: withSet(body, "deck", `styles/styles/${made}`, { ...style, name }) };
};

const textBlocksIn = (body: SlideDeckBody): readonly (TextBlock | PromptBlock)[] => {
  const found = new Map<string, TextBlock | PromptBlock>();
  const visit = (block: ContentBlock): void => {
    if (block.type === "text" || block.type === "prompt") found.set(block.id, block);
    else if (block.type === "image" && block.caption !== undefined) visit(block.caption);
    else if (block.type === "table") {
      for (const row of block.rows) for (const cell of row.cells) for (const child of cell.blocks) visit(child);
    }
  };

  for (const slide of body.slides) {
    for (const block of slide.notes) visit(block);
    for (const { element } of placedOn(slide)) {
      const content = element.content;
      if (
        (content.type === "text" || content.type === "prompt" || content.type === "shape") &&
        content.block !== undefined
      ) visit(content.block);
      else if (content.type === "image" || content.type === "table") visit(content.block);
    }
  }
  return [...found.values()];
};

export const deleteStyleEdit = (body: SlideDeckBody, key: string): Edit => {
  if (body.styles.styles[key] === undefined || body.styles.defaultKey === key) return { body, ops: [] };
  const fallback = body.styles.defaultKey;
  const references = textBlocksIn(body)
    .filter((block) => block.style === key)
    .map((block) => ({ target: "block" as const, path: `${block.id}/style`, value: fallback }));
  return withSets(body, [
    ...references,
    { target: "deck", path: `styles/styles/${key}`, value: null }
  ]);
};
