import type { Slide, PresentationBody, SlideLayout } from "$representation/data/types/presentations/body";
import { presentationEdit, idBefore, noPresentationEdit, type Edit } from "$app-views/categories/presentation-editor/procedures/presentation-edit";
import { emptyText, freshElement } from "$app-views/categories/presentation-editor/procedures/presentation-elements";
import { mint } from "$app-views/categories/presentation-editor/procedures/ids";

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

const inserted = (body: PresentationBody, slide: Slide, after: string | null): Edit =>
  presentationEdit(body, [{ op: "insert", target: "slide", path: "slides", ids: [slide.id], after, values: [slide] }]);

export const withNewSlide = (body: PresentationBody, afterId: string | undefined, layoutKey?: string): Edit => {
  const after = body.slides.find((slide) => slide.id === afterId);
  const layout = body.layouts.find((held) => held.key === (layoutKey ?? after?.layoutKey));
  return inserted(body, slideFromLayout(layoutKey === undefined ? undefined : layout, after), after?.id ?? null);
};

export const withSavedLayout = (body: PresentationBody, slideId: string, name: string): Edit => {
  const slide = body.slides.find((held) => held.id === slideId);
  if (slide === undefined) return noPresentationEdit(body);
  const id = mint("layout");
  const layout: SlideLayout = {
    id,
    key: id,
    name: name.trim() === "" ? `Layout ${body.layouts.length + 1}` : name.trim(),
    locked: slide.elements.map(freshElement),
    placeholders: [],
    ...(slide.background === undefined ? {} : { background: slide.background })
  };
  return presentationEdit(body, [{
    op: "insert",
    target: "layout",
    path: "layouts",
    ids: [layout.id],
    after: body.layouts.at(-1)?.id ?? null,
    values: [layout]
  }]);
};

export const withoutLayout = (body: PresentationBody, layoutId: string): Edit => {
  const layout = body.layouts.find((held) => held.id === layoutId);
  if (layout === undefined) return noPresentationEdit(body);
  return presentationEdit(body, [{
    op: "remove",
    target: "layout",
    path: "layouts",
    ids: [layout.id],
    after: idBefore(body.layouts, layout.id),
    values: [layout]
  }]);
};
