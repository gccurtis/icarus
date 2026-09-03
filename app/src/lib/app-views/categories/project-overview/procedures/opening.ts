import type { Category, Target } from "$model/client/workspace-state";
import type { Resource, ResourceKind } from "$app-views/categories/project-overview/procedures/resources";

const CATEGORY: Partial<Record<ResourceKind, Category>> = {
  document: "document-editor",
  slides: "slide-deck-editor",
  spreadsheet: "spreadsheet-editor",
  research: "research",
  analysis: "analysis"
};

export const openingFor = ({ kind, id }: Resource): Target | undefined => {
  const category = CATEGORY[kind];
  return category === undefined ? undefined : { category, resourceId: id };
};
