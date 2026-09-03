import type { Category, Target } from "$model/client/workspace-state";
import type { Resource, ResourceKind } from "$app-views/categories/project-overview/procedures/resources";

/**
 * Where a thing of a given kind is opened.
 *
 * A body and a thread each earn a tab of their own, keyed by the thing rather
 * than by the category, so two documents are two tabs. A template is a place you
 * return to — Templates is one of the three permanent tabs — so opening one moves
 * that tab onto the row instead of minting a second.
 *
 * A file, a finding and a connector have no category at all. They are things you
 * look at rather than places you go, so `undefined` is a real answer and the
 * caller reads the lens instead.
 */
const CATEGORY: Partial<Record<ResourceKind, Category>> = {
  document: "document-editor",
  slides: "slide-deck-editor",
  spreadsheet: "spreadsheet-editor",
  research: "research",
  analysis: "analysis",
  context: "context-editor"
};

export const openingFor = ({ kind, id }: Resource): Target | undefined => {
  if (kind === "template") {
    return { category: "templates", content: "templates.editor", focus: id };
  }

  const category = CATEGORY[kind];
  return category === undefined ? undefined : { category, resourceId: id };
};
