import type { ProjectActivityTarget } from "$capabilities/project/index.remote";
import type {
  ProjectResourceIndexItem,
  ProjectResourceKind
} from "$capabilities/project-resources/index.remote";

export type ActivityResource = Pick<ProjectResourceIndexItem, "id" | "kind">;

const RESOURCE_KIND: Readonly<Partial<Record<string, ProjectResourceKind>>> = {
  document: "document",
  presentation: "presentation",
  spreadsheet: "spreadsheet",
  research: "research",
  finding: "finding",
  "external-file": "file"
};

/**
 * Resolve a frozen activity target against the current scoped resource index.
 *
 * Activity survives deletion, so its id and historical label cannot prove that
 * a destination still exists. Matching both id and kind prevents a stale or
 * malformed event from opening an unrelated resource with a coincident id.
 */
export const currentActivityResource = (
  target: ProjectActivityTarget,
  index: { readonly resources: readonly ActivityResource[] } | undefined
): ActivityResource | undefined => {
  const kind = RESOURCE_KIND[target.kind];
  if (kind === undefined) return undefined;
  return index?.resources.find((resource) => resource.id === target.id && resource.kind === kind);
};
