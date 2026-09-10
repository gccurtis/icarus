import type { Slide, SlideDeckBody, SlideLayout } from "$representation/data/types/slide-decks/body";
import { deckEdit, idBefore, noDeckEdit, type Edit } from "$app-views/categories/slide-deck-editor/procedures/deck-edit";
import { emptyText, freshElement } from "$app-views/categories/slide-deck-editor/procedures/deck-elements";
import { mint } from "$app-views/categories/slide-deck-editor/procedures/ids";

export const slideFromLayout = (layout: SlideLayout | undefined, previous: Slide | undefined): Slide => ({
  id: mint("slide"),
  layoutKey: layout?.key ?? previous?.layoutKey,
  elements: (layout?.placeholders ?? []).map((placeholder) => ({
    id: mint("element"),
    frame: placeholder.frame,
    overflow: "shrink",
    fromPlaceholder: placeholder.role,
    content: { type: "text", block: emptyText(placeholder.styleKey) }
  })),
  notes: []
});

const inserted = (body: SlideDeckBody, slide: Slide, after: string | null): Edit =>
  deckEdit(body, [{ op: "insert", target: "slide", path: "slides", ids: [slide.id], after, values: [slide] }]);

export const withNewSlide = (body: SlideDeckBody, afterId: string | undefined, layoutKey?: string): Edit => {
  const after = body.slides.find((slide) => slide.id === afterId);
  const layout = body.layouts.find((held) => held.key === (layoutKey ?? after?.layoutKey));
  return inserted(body, slideFromLayout(layoutKey === undefined ? undefined : layout, after), after?.id ?? null);
};

export const withSavedLayout = (body: SlideDeckBody, slideId: string, name: string): Edit => {
  const slide = body.slides.find((held) => held.id === slideId);
  if (slide === undefined) return noDeckEdit(body);
  const id = mint("layout");
  const layout: SlideLayout = {
    id,
    key: id,
    name: name.trim() === "" ? `Layout ${body.layouts.length + 1}` : name.trim(),
    locked: slide.elements.map(freshElement),
    placeholders: [],
    ...(slide.background === undefined ? {} : { background: slide.background })
  };
  return deckEdit(body, [{
    op: "insert",
    target: "layout",
    path: "layouts",
    ids: [layout.id],
    after: body.layouts.at(-1)?.id ?? null,
    values: [layout]
  }]);
};

export const withoutLayout = (body: SlideDeckBody, layoutId: string): Edit => {
  const layout = body.layouts.find((held) => held.id === layoutId);
  if (layout === undefined) return noDeckEdit(body);
  return deckEdit(body, [{
    op: "remove",
    target: "layout",
    path: "layouts",
    ids: [layout.id],
    after: idBefore(body.layouts, layout.id),
    values: [layout]
  }]);
};
