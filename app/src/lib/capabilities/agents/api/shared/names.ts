import type { StoreModel } from "$model/server/store/index.server";
import type { Actor } from "$representation/data/types/core/actor";
import type { ResourceRef } from "$representation/data/types/core/resource";
import {
  isStoredAgentTask,
  isStoredAutomation,
  isStoredPersona
} from "$representation/data/behavior/agents/stored-rows";

import { externalResourceOptionsIn } from "$capabilities/agents/api/shared/external-resource-options";
import { rowsIn } from "$capabilities/agents/api/shared/store";

export type Names = {
  readonly user: (userId: string) => string;
  readonly persona: (personaId: string) => string;
  readonly automation: (automationId: string) => string;
  readonly actor: (actor: Actor) => string;
  readonly resource: (ref: ResourceRef) => string | null;
};

const RESOURCE_TABLE: Record<string, "documents" | "slideDecks" | "spreadsheets" | "findings"> = {
  document: "documents",
  slides: "slideDecks",
  spreadsheet: "spreadsheets",
  finding: "findings"
};

export const namesIn = (store: StoreModel, projectId: string): Names => {
  const users = new Map(rowsIn(store, "users").map((row) => [row._id as string, row.displayName]));
  const personas = new Map(
    rowsIn(store, "personas")
      .filter((row) => isStoredPersona(row) && row.projectId === projectId)
      .map((row) => [row._id as string, row.name])
  );
  const automations = new Map(
    rowsIn(store, "automations")
      .filter((row) => isStoredAutomation(row) && row.projectId === projectId)
      .map((row) => [row._id as string, row.name])
  );
  const tasks = new Map(
    rowsIn(store, "agentTasks")
      .filter((row) => isStoredAgentTask(row) && row.projectId === projectId)
      .map((row) => [row._id as string, row.personaId as string])
  );
  const resources = new Map<string, string>();
  for (const [kind, table] of Object.entries(RESOURCE_TABLE)) {
    for (const row of rowsIn(store, table)) {
      if (row.projectId !== projectId) continue;
      resources.set(`${kind}/${row._id}`, row.title);
    }
  }
  for (const option of externalResourceOptionsIn(store, projectId)) {
    resources.set(`${option.ref.kind}/${option.ref.id}`, option.name);
  }

  const user = (userId: string) => users.get(userId) ?? "Someone";
  const persona = (personaId: string) => personas.get(personaId) ?? "A persona";
  return {
    user,
    persona,
    automation: (automationId: string) => automations.get(automationId) ?? "An automation",
    actor: (actor: Actor) => {
      if (actor.kind === "user") return user(actor.userId);
      if (actor.kind === "agent") {
        const personaId = tasks.get(actor.taskId);
        return personaId === undefined ? "An agent" : persona(personaId);
      }
      if (actor.kind === "connector") return "A connector";
      return "Icarus";
    },
    resource: (ref: ResourceRef) => resources.get(`${ref.kind}/${ref.id}`) ?? null
  };
};
