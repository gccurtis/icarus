import type { ProjectActivityTarget } from "$capabilities/project/index.remote";
import type {
  ProjectResourceIndexItem,
  ProjectResourceKind
} from "$capabilities/project-resources/index.remote";
import type { Target } from "$model/client/workspace-state";
import { openingFor } from "$app-views/categories/project-overview/procedures/opening";

export type ActivityResource = Pick<ProjectResourceIndexItem, "id" | "kind">;
export type ActivityAgentKind = "persona" | "task" | "automation";
export type ActivityAgent =
  | { readonly id: string; readonly kind: "persona" }
  | { readonly id: string; readonly kind: "task" }
  | { readonly id: string; readonly kind: "automation" };
export type ActivityDestination = ActivityResource | ActivityAgent;
export type ActivityDestinationSource = "resources" | "agents" | "placeholder";

export type ActivityAgentIndex = {
  readonly personas: readonly { readonly id: string }[];
  readonly tasks: readonly { readonly id: string }[];
  readonly automations: readonly { readonly id: string }[];
};

const RESOURCE_KIND: Readonly<Partial<Record<string, ProjectResourceKind>>> = {
  document: "document",
  presentation: "presentation",
  spreadsheet: "spreadsheet",
  research: "research",
  finding: "finding",
  "external-file": "file"
};

const AGENT_CONTENT = {
  persona: "agents.persona",
  task: "agents.task",
  automation: "agents.automation"
} as const;

export const activityDestinationSource = (
  kind: string
): ActivityDestinationSource | undefined => {
  if (RESOURCE_KIND[kind] !== undefined) return "resources";
  if (kind === "persona" || kind === "task" || kind === "automation") return "agents";
  return kind === "connector" ? "placeholder" : undefined;
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

export const currentActivityDestination = (
  target: ProjectActivityTarget,
  resources: { readonly resources: readonly ActivityResource[] } | undefined,
  agents: ActivityAgentIndex | undefined
): ActivityDestination | undefined => {
  const resource = currentActivityResource(target, resources);
  if (resource !== undefined) return resource;
  if (target.kind === "persona" && agents?.personas.some((row) => row.id === target.id)) {
    return { id: target.id, kind: "persona" };
  }
  if (target.kind === "task" && agents?.tasks.some((row) => row.id === target.id)) {
    return { id: target.id, kind: "task" };
  }
  if (target.kind === "automation" && agents?.automations.some((row) => row.id === target.id)) {
    return { id: target.id, kind: "automation" };
  }
  return undefined;
};

export const openingForActivityDestination = (
  destination: ActivityDestination
): Target | undefined => {
  if (
    destination.kind === "persona" ||
    destination.kind === "task" ||
    destination.kind === "automation"
  ) {
    return {
      category: "agents",
      content: AGENT_CONTENT[destination.kind],
      focus: destination.id
    };
  }
  return openingFor(destination);
};
