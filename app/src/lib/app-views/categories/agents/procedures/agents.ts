import {
  readAgentsLibrary,
  readAutomation,
  readPersona,
  readTask,
  type ReadAgentsLibraryResult
} from "$capabilities/agents/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { ToolId } from "$representation/data/types/agents/tool";

export type Revisioned = { readonly id: string; readonly revision: number };

/** What a grant or a scope is being edited on, whichever of the three it is. */
export type Owner = {
  readonly kind: "persona" | "task" | "automation";
  readonly id: string;
  readonly name: string;
  readonly revision: number;
  readonly tools: readonly ToolId[];
  readonly scope: ResourceSet | null;
  readonly personaId?: string;
  readonly finished: boolean;
};

export const agentsLibrary = () => readAgentsLibrary();

export const personaDetail = (personaId: string | undefined) =>
  personaId === undefined ? undefined : readPersona({ personaId });

export const taskDetail = (taskId: string | undefined) =>
  taskId === undefined ? undefined : readTask({ taskId });

export const automationDetail = (automationId: string | undefined) =>
  automationId === undefined ? undefined : readAutomation({ automationId });

export const ownerOf = (
  answer: ReadAgentsLibraryResult | undefined,
  ownerId: string
): Owner | undefined => {
  if (answer === undefined) return undefined;
  const persona = answer.personas.find((row) => row.id === ownerId);
  if (persona !== undefined) {
    return {
      kind: "persona",
      id: persona.id,
      name: persona.name,
      revision: persona.revision,
      tools: persona.tools,
      scope: persona.scope,
      finished: false
    };
  }
  const task = answer.tasks.find((row) => row.id === ownerId);
  if (task !== undefined) {
    return {
      kind: "task",
      id: task.id,
      name: task.title,
      revision: task.revision,
      tools: task.tools,
      scope: task.scope,
      personaId: task.personaId,
      finished: task.state === "finished"
    };
  }
  const automation = answer.automations.find((row) => row.id === ownerId);
  if (automation === undefined) return undefined;
  return {
    kind: "automation",
    id: automation.id,
    name: automation.name,
    revision: automation.revision,
    tools: automation.tools,
    scope: automation.scope,
    personaId: automation.personaId,
    finished: false
  };
};

/** One key per durable command, so every surface joins the same run. */
export const flightKey = (
  view: WorkspaceStateModel,
  ...parts: readonly (string | number | boolean | null)[]
) => ["agents", view.project, ...parts] as const;

export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
