import type { TemplateAnswers, TemplateDetail } from "$capabilities/templates/index.remote";
import { applyOps } from "$representation/data/behavior/slide-decks/apply-ops";
import { withFreshIds, type IdHint } from "$representation/data/behavior/templates/fresh-ids";
import {
  fillTemplateAtoms,
  resolveTemplateScopes
} from "$representation/data/behavior/templates/scopes";
import type { SlideDeckBody, SlideLayout } from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import { mint, type IdKind } from "$app-views/categories/slide-deck-editor/procedures/ids";

const HINT_KIND: Record<IdHint, IdKind> = {
  slide: "slide",
  element: "element",
  layout: "layout",
  block: "block",
  cell: "block",
  row: "block",
  section: "block",
  atom: "atom",
  mark: "atom"
};

const mintFor = (hint: IdHint): string => mint(HINT_KIND[hint]);

export type Insertion = {
  readonly body: SlideDeckBody;
  readonly ops: readonly SlideDeckOp[];
  readonly firstSlideId: string | undefined;
};

const none = (body: SlideDeckBody): Insertion => ({ body, ops: [], firstSlideId: undefined });

export const insertionOf = (
  body: SlideDeckBody,
  template: TemplateDetail,
  afterSlideId: string | null,
  mode: "resolve" | "keep",
  answers: TemplateAnswers = {},
  texts: Readonly<Record<string, string>> = {}
): Insertion => {
  if (template.body.resource !== "slides") return none(body);

  let source: SlideDeckBody = template.body;
  if (mode === "resolve") {
    const resolved = resolveTemplateScopes(template.body, template.holes, answers);
    if (!resolved.accepted || resolved.body.resource !== "slides") return none(body);
    const filled = fillTemplateAtoms(resolved.body, texts);
    if (filled.resource !== "slides") return none(body);
    source = filled;
  }
  if (source.slides.length === 0) return none(body);

  const fresh = withFreshIds({ layouts: source.layouts, slides: source.slides }, mintFor);
  const ops: SlideDeckOp[] = [];
  const heldKeys = new Set(body.layouts.map((layout) => layout.key));
  const layouts: SlideLayout[] = fresh.layouts.filter((layout) => !heldKeys.has(layout.key));
  if (layouts.length > 0) {
    ops.push({
      op: "insert",
      target: "layout",
      path: "layouts",
      ids: layouts.map((layout) => layout.id),
      after: body.layouts.at(-1)?.id ?? null,
      values: layouts
    });
  }
  for (const [key, style] of Object.entries(source.styles.styles)) {
    if (key in body.styles.styles) continue;
    ops.push({ op: "set", path: `styles/styles/${key}`, value: style, was: null });
  }
  const anchor = afterSlideId !== null && body.slides.some((slide) => slide.id === afterSlideId)
    ? afterSlideId
    : (body.slides.at(-1)?.id ?? null);
  ops.push({
    op: "insert",
    target: "slide",
    path: "slides",
    ids: fresh.slides.map((slide) => slide.id),
    after: anchor,
    values: fresh.slides
  });
  return { body: applyOps(body, ops), ops, firstSlideId: fresh.slides[0]?.id };
};
