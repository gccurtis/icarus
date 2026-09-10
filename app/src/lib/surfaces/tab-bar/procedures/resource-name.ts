import type { ReadAgentsLibraryResult } from "$capabilities/agents/index.remote";
import type { ProjectResourceIndex } from "$capabilities/project-resources/index.remote";
import type { ReadTemplateStageIndexResult } from "$capabilities/templates/index.remote";

/** The component-owned query snapshots needed to name an opened subject. */
export type ResourceNames = {
  readonly ready: boolean;
  readonly resources: ProjectResourceIndex | undefined;
  readonly agents: ReadAgentsLibraryResult | undefined;
  readonly stages: ReadTemplateStageIndexResult | undefined;
};

/** Name an open browser subject from scoped subject projections only. */
export const nameOf = (id: string, names: ResourceNames): string => {
  if (!names.ready) return "…";

  // Membership in the current stage projection owns this distinct subject's
  // identity; the normal resource index intentionally never lists it.
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
