import type { Category, Target } from "$model/client/workspace-state";
import type { Resource, ResourceKind } from "$app-views/categories/project-overview/procedures/resources";

const CATEGORY: Partial<Record<ResourceKind, Category>> = {
  document: "document-editor",
  presentation: "presentation-editor",
  spreadsheet: "spreadsheet-editor",
  research: "research",
  file: "external"
};

/** A research tab needs its centre named; the editors default to theirs. */
const CONTENT: Partial<Record<ResourceKind, "research.thread">> = {
  research: "research.thread"
};

export const openingFor = ({ kind, id }: Pick<Resource, "kind" | "id">): Target | undefined => {
  const category = CATEGORY[kind];
  if (category === undefined) return undefined;
  if (category === "external") return { category, focus: id };
  const content = CONTENT[kind];
  return { category, resourceId: id, ...(content === undefined ? {} : { content }) };
};
