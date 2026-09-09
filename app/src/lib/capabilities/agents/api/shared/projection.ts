import type { StoreModel, TableRow } from "$model/server/store/index.server";
import type { Scope } from "$runtime/server/scope.server";
import type { TaskOrigin } from "$representation/data/types/agents/agent-task";
import { messageText } from "$representation/data/behavior/agents/messages";
import { openQuestions, planProgress } from "$representation/data/behavior/agents/plan";
import { TOOLS, orderedTools } from "$representation/data/behavior/agents/tools";
import { triggerSummary } from "$representation/data/behavior/agents/triggers";

import { namesIn, type Names } from "$capabilities/agents/api/shared/names";
import { rowsIn } from "$capabilities/agents/api/shared/store";
import { taskItem } from "$capabilities/agents/api/shared/task-projection";
import { lastLineOf, messagesOf } from "$capabilities/agents/api/shared/threads";
import type {
  AutomationDetail,
  AutomationItem,
  ChatItem,
  PersonaCounts,
  PersonaDetail,
  PersonaItem,
  ReadAgentsLibraryResult,
  TaskDetail,
  TaskItem,
  TaskTurn
} from "$capabilities/agents/types/agents";

type Persona = TableRow<"personas">;
type Task = TableRow<"agentTasks">;
type Automation = TableRow<"automations">;
type Chat = TableRow<"researchThreads">;

export type Visible = {
  readonly personas: readonly Persona[];
  readonly tasks: readonly Task[];
  readonly automations: readonly Automation[];
  readonly chats: readonly Chat[];
  readonly names: Names;
};

const sound = (row: { readonly _id: unknown; readonly revision?: unknown }): boolean =>
  typeof row._id === "string" &&
  (row.revision === undefined || (Number.isSafeInteger(row.revision) && (row.revision as number) >= 1));

export const visibleIn = (store: StoreModel, scope: Scope): Visible => {
  const inProject = (row: { readonly projectId?: unknown }) => row.projectId === scope.projectId;

  const personas = rowsIn(store, "personas").filter(
    (row) => sound(row) && inProject(row) && typeof row.name === "string"
  );
  const personaIds = new Set(personas.map((row) => row._id as string));
  const tasks = rowsIn(store, "agentTasks").filter(
    (row) =>
      sound(row) &&
      inProject(row) &&
      typeof row.title === "string" &&
      personaIds.has(row.personaId) &&
      Array.isArray(row.plan) &&
      Array.isArray(row.outputs) &&
      Array.isArray(row.questions)
  );
  const automations = rowsIn(store, "automations").filter(
    (row) =>
      sound(row) &&
      inProject(row) &&
      typeof row.name === "string" &&
      personaIds.has(row.personaId) &&
      typeof row.trigger === "object"
  );
  const chats = rowsIn(store, "researchThreads").filter(
    (row) =>
      inProject(row) &&
      typeof row.title === "string" &&
      row.personaId !== undefined &&
      personaIds.has(row.personaId)
  );
  return { personas, tasks, automations, chats, names: namesIn(store, scope.projectId) };
};

export const personaCounts = (personaId: string, visible: Visible): PersonaCounts => {
  const own = visible.tasks.filter((task) => task.personaId === personaId);
  return {
    tasks: own.length,
    running: own.filter((task) => task.state === "running").length,
    review: own.filter((task) => task.state === "review").length,
    finished: own.filter((task) => task.state === "finished").length,
    automations: visible.automations.filter((row) => row.personaId === personaId).length,
    chats: visible.chats.filter((row) => row.personaId === personaId).length
  };
};

export const personaItem = (persona: Persona, visible: Visible): PersonaItem => ({
  id: persona._id,
  name: persona.name,
  description: persona.description ?? null,
  scope: persona.scope ?? null,
  tools: orderedTools(persona.tools ?? []),
  createdByName: visible.names.actor(persona.createdBy),
  revision: persona.revision,
  updatedAt: persona.updatedAt,
  counts: personaCounts(persona._id, visible)
});

export const personaDetail = (persona: Persona, visible: Visible): PersonaDetail => ({
  ...personaItem(persona, visible),
  definition: {
    focus: persona.definition?.focus ?? "",
    background: persona.definition?.background ?? "",
    approach: persona.definition?.approach ?? "",
    outputPreferences: persona.definition?.outputPreferences ?? "",
    verification: persona.definition?.verification ?? ""
  },
  cast: persona.cast ?? null,
  avatar: persona.avatar ?? null
});

export const automationItem = (automation: Automation, visible: Visible): AutomationItem => ({
  id: automation._id,
  name: automation.name,
  personaId: automation.personaId,
  personaName: visible.names.persona(automation.personaId),
  trigger: automation.trigger,
  triggerRefName:
    automation.trigger.kind === "resource-edited" && automation.trigger.ref !== undefined
      ? visible.names.resource(automation.trigger.ref)
      : null,
  enabled: automation.enabled,
  firedCount: automation.firedCount,
  lastFiredAt: automation.lastFiredAt ?? null,
  running: visible.tasks.filter(
    (task) =>
      task.state === "running" &&
      task.origin.kind === "automation" &&
      task.origin.automationId === automation._id
  ).length,
  scope: automation.scope ?? null,
  tools: orderedTools(automation.tools ?? []),
  createdByName: visible.names.actor(automation.createdBy),
  revision: automation.revision,
  updatedAt: automation.updatedAt
});

export const automationDetail = (automation: Automation, visible: Visible): AutomationDetail => ({
  ...automationItem(automation, visible),
  instruction: automation.instruction,
  fired: visible.tasks
    .filter(
      (task) => task.origin.kind === "automation" && task.origin.automationId === automation._id
    )
    .toSorted((left, right) => right.startedAt - left.startedAt)
    .map((task) => taskItem(task, visible))
});

export const chatItem = (store: StoreModel, chat: Chat, visible: Visible): ChatItem => ({
  id: chat._id,
  title: chat.title,
  personaId: chat.personaId ?? "",
  personaName: visible.names.persona(chat.personaId ?? ""),
  createdByName: visible.names.actor(chat.createdBy),
  messageCount: messagesOf(store, chat.threadId).length,
  lastLine: lastLineOf(store, chat.threadId),
  updatedAt: chat.updatedAt
});

const byName = <T extends { readonly name: string }>(left: T, right: T): number =>
  left.name.localeCompare(right.name);

const agentActivity = (store: StoreModel, visible: Visible, projectId: string) =>
  rowsIn(store, "activity")
    .filter(
      (row) =>
        row.projectId === projectId &&
        typeof row.verb === "string" &&
        row.target !== undefined &&
        row.actor?.kind === "agent"
    )
    .toSorted((left, right) => right._creationTime - left._creationTime)
    .slice(0, 40)
    .map((row) => {
      const actor = row.actor as Extract<Task["createdBy"], { kind: "agent" }>;
      const task = visible.tasks.find((candidate) => candidate._id === actor.taskId);
      return {
        id: row._id as string,
        actorName:
          typeof row.actorLabel === "string" && row.actorLabel !== ""
            ? row.actorLabel
            : visible.names.actor(row.actor),
        personaId: task?.personaId ?? null,
        verb: row.verb,
        subject: row.target.label,
        targetKind: row.target.kind,
        targetId: row.target.id,
        at: row._creationTime
      };
    });

export const library = (store: StoreModel, scope: Scope): ReadAgentsLibraryResult => {
  const visible = visibleIn(store, scope);
  const resources = (
    [
      ["document", "documents"],
      ["slides", "slideDecks"],
      ["spreadsheet", "spreadsheets"]
    ] as const
  ).flatMap(([kind, table]) =>
    rowsIn(store, table)
      .filter((row) => row.projectId === scope.projectId && typeof row.title === "string")
      .map((row) => ({ ref: { kind, id: row._id as string }, name: row.title }))
  );
  return {
    personas: visible.personas.map((row) => personaItem(row, visible)).toSorted(byName),
    tasks: visible.tasks
      .map((row) => taskItem(row, visible))
      .toSorted((left, right) => right.startedAt - left.startedAt),
    automations: visible.automations.map((row) => automationItem(row, visible)).toSorted(byName),
    chats: visible.chats
      .map((row) => chatItem(store, row, visible))
      .toSorted((left, right) => right.updatedAt - left.updatedAt),
    activity: agentActivity(store, visible, scope.projectId),
    tools: TOOLS,
    resources: resources.toSorted(byName),
    resourceSets: rowsIn(store, "resourceSets")
      .filter((row) => row.projectId === scope.projectId)
      .flatMap((row) => (row.name === undefined ? [] : [{ id: row._id as string, name: row.name }]))
      .toSorted(byName)
  };
};
