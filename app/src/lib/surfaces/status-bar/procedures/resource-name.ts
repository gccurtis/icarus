import type { ReadAgentsLibraryResult } from "$capabilities/agents/index.remote";
import type { ProjectResourceIndex } from "$capabilities/project-resources/index.remote";
import type {
  ReadTemplateLibraryResult,
  ReadTemplateStageIndexResult
} from "$capabilities/templates/index.remote";

/** Stable query snapshots owned by the status-bar component. */
export type ResourceNames = {
  readonly resourcesReady: boolean;
  readonly agentsReady: boolean;
  readonly templatesReady: boolean;
  readonly stagesReady: boolean;
  readonly resources: ProjectResourceIndex | undefined;
  readonly agents: ReadAgentsLibraryResult | undefined;
  readonly templates: ReadTemplateLibraryResult | undefined;
  readonly stages: ReadTemplateStageIndexResult | undefined;
};

const RESOURCE_KIND = {
  document: "Document",
  presentation: "Presentation",
  spreadsheet: "Spreadsheet",
  research: "Research",
  file: "File",
  finding: "Finding"
} as const;

/** Name the current browser subject without exposing a representation table. */
export const nameOf = (id: string, names: ResourceNames): string => {
  if (id.startsWith("templates:")) {
    if (!names.templatesReady) return "…";
    const found = names.templates?.templates.find((candidate) => candidate.id === id);
    if (found !== undefined) return found.name;
    return names.templates?.unavailable.some((candidate) => candidate.templateId === id)
      ? "Unavailable template"
      : "Disconnected";
  }

  if (!names.resourcesReady || !names.agentsReady || !names.stagesReady) return "…";
  const stage = names.stages?.stages.find((candidate) => candidate.resourceId === id);
  if (stage !== undefined) return `Template · ${stage.templateName}`.slice(0, 160);

  const resource = names.resources?.resources.find((candidate) => candidate.id === id);
  if (resource !== undefined) return resource.name;

  const library = names.agents;
  const persona = library?.personas.find((candidate) => candidate.id === id);
  if (persona !== undefined) return persona.name;
  const task = library?.tasks.find((candidate) => candidate.id === id);
  if (task !== undefined) return task.title;
  const automation = library?.automations.find((candidate) => candidate.id === id);
  if (automation !== undefined) return automation.name;
  const chat = library?.chats.find((candidate) => candidate.id === id);
  return chat?.title ?? "Disconnected";
};

export const kindOf = (
  id: string,
  resources: ProjectResourceIndex | undefined,
  stages: ReadTemplateStageIndexResult | undefined
): string | undefined => {
  if (id.startsWith("templates:")) return "Template";
  const stage = stages?.stages.find((candidate) => candidate.resourceId === id);
  if (stage !== undefined) return stage.target === "document" ? "Document" : "Presentation";
  const resource = resources?.resources.find((candidate) => candidate.id === id);
  if (resource !== undefined) return RESOURCE_KIND[resource.kind];
  if (id.startsWith("personas:")) return "Persona";
  if (id.startsWith("agentTasks:")) return "Task";
  if (id.startsWith("automations:")) return "Automation";
  return undefined;
};
