import type { StoreUnitOfWork, TableRow } from "$model/server/store/index.server";
import { isStoredAgentTask, isStoredPersona } from "$representation/data/behavior/agents/stored-rows";
import { conversationAggregate } from "$representation/data/behavior/agents/conversation";
import { isStoredProject } from "$representation/data/behavior/core/stored-project";
import type { Message } from "$representation/data/types/agents/message";
import type { Id } from "$representation/data/types/core/id";

import { rowIn, rowsIn } from "$capabilities/agents/api/shared/store";

export type AgentExecutionState = {
  readonly task: TableRow<"agentTasks">;
  readonly persona: TableRow<"personas">;
  readonly messages: readonly Message[];
};

/** Read one task's exact, same-project task, persona and conversation aggregate. */
export const readAgentExecutionState = (
  store: StoreUnitOfWork,
  taskId: Id<"agentTasks">
): AgentExecutionState | undefined => {
  const task = rowIn(store, "agentTasks", taskId);
  if (task === undefined) return undefined;
  if (!isStoredAgentTask(task)) {
    throw new Error("The Agent task is not the exact current stored shape");
  }
  const project = rowIn(store, "projects", task.projectId);
  if (project === undefined) {
    throw new Error("The Agent task's project is not available");
  }
  if (!isStoredProject(project)) {
    throw new Error("The Agent task's project is not the exact current stored shape");
  }

  const persona = rowIn(store, "personas", task.personaId);
  if (persona === undefined) {
    throw new Error("The task's persona is not available in its project");
  }
  if (!isStoredPersona(persona)) {
    throw new Error("The task's persona is not the exact current stored shape");
  }
  if (persona.projectId !== task.projectId) {
    throw new Error("The task's persona is not available in its project");
  }

  const conversation = conversationAggregate(
    rowsIn(store, "threads"),
    rowsIn(store, "threadParts"),
    task.projectId,
    task.threadId,
    "agentTask"
  );

  return {
    task,
    persona,
    messages: conversation.parts
      .flatMap((part) => part.messages)
  };
};
