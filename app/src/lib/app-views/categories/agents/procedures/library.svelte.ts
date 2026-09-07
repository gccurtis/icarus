import {
  answerTaskQuestion as answerTaskQuestionRemote,
  createAutomation as createAutomationRemote,
  createChat as createChatRemote,
  createPersona as createPersonaRemote,
  createTask as createTaskRemote,
  duplicatePersona as duplicatePersonaRemote,
  readAgentsLibrary,
  readAutomation,
  readPersona,
  readTask,
  removeAutomation as removeAutomationRemote,
  removePersona as removePersonaRemote,
  runAutomation as runAutomationRemote,
  sendTaskMessage as sendTaskMessageRemote,
  updateAutomation as updateAutomationRemote,
  updatePersona as updatePersonaRemote,
  updateTask as updateTaskRemote,
  type AutomationItem,
  type CreateAutomationInput,
  type CreateTaskInput,
  type ReadAgentsLibraryResult,
  type TaskItem,
  type UpdateAutomationPatch,
  type UpdatePersonaPatch,
  type UpdateTaskPatch
} from "$capabilities/agents/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { AgentTaskState } from "$representation/data/types/agents/agent-task";
import type { AutomationTriggerKind } from "$representation/data/types/agents/automation";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { ToolId } from "$representation/data/types/agents/tool";
import { ORIGIN_LABEL, TRIGGER_KINDS, originKindOf } from "$representation/data/behavior/agents/triggers";
import { elapsed, relativeTime } from "$app-views/categories/agents/procedures/time";

export type Revisioned = { readonly id: string; readonly revision: number };

export const agentsLibrary = () => readAgentsLibrary();

export const personaDetail = (personaId: string | undefined) =>
  personaId === undefined ? undefined : readPersona({ personaId });

export const taskDetail = (taskId: string | undefined) =>
  taskId === undefined ? undefined : readTask({ taskId });

export const automationDetail = (automationId: string | undefined) =>
  automationId === undefined ? undefined : readAutomation({ automationId });

export const STATES: readonly AgentTaskState[] = ["running", "review", "finished"];

export const STATE_LABEL: Record<AgentTaskState, string> = {
  running: "Running",
  review: "Pending review",
  finished: "Finished"
};

export const STATE_TONE: Record<AgentTaskState, "attention" | "intelligence" | "success"> = {
  running: "attention",
  review: "intelligence",
  finished: "success"
};

export type OriginKind = AutomationTriggerKind | "person";

export const ORIGIN_KINDS: readonly OriginKind[] = ["person", ...TRIGGER_KINDS];

export const typeLabelOf = (task: TaskItem): string => ORIGIN_LABEL[originKindOf(task.origin)];

export type TaskRow = TaskItem & {
  readonly typeLabel: string;
  readonly originKind: OriginKind;
  readonly started: string;
  readonly took: string;
};

export const taskRowOf = (task: TaskItem, now: number): TaskRow => ({
  ...task,
  typeLabel: typeLabelOf(task),
  originKind: originKindOf(task.origin),
  started: relativeTime(task.startedAt, now),
  took: elapsed(task.startedAt, task.finishedAt ?? now)
});

export const taskRowsIn = (
  answer: ReadAgentsLibraryResult | undefined,
  now: number
): readonly TaskRow[] => answer?.tasks.map((task) => taskRowOf(task, now)) ?? [];

export const pendingReviewIn = (rows: readonly TaskRow[]): readonly TaskRow[] =>
  rows
    .filter((row) => row.state === "review")
    .toSorted((left, right) => (right.finishedAt ?? 0) - (left.finishedAt ?? 0));

export const runningIn = (rows: readonly TaskRow[]): readonly TaskRow[] =>
  rows.filter((row) => row.state === "running");

export type SortKey = "started" | "title" | "type" | "state";

export const SORTS: readonly { value: SortKey; label: string }[] = [
  { value: "started", label: "Started" },
  { value: "title", label: "Task" },
  { value: "type", label: "Type" },
  { value: "state", label: "State" }
];

export const DIRECTION: Record<SortKey, { asc: string; desc: string }> = {
  started: { asc: "Newest first", desc: "Oldest first" },
  title: { asc: "A to Z", desc: "Z to A" },
  type: { asc: "A to Z", desc: "Z to A" },
  state: { asc: "Needs you first", desc: "Settled first" }
};

const STATE_ORDER: Record<AgentTaskState, number> = { review: 0, running: 1, finished: 2 };

export const compareRows =
  (sort: SortKey) =>
  (a: TaskRow, b: TaskRow): number => {
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "type") {
      return a.typeLabel.localeCompare(b.typeLabel) || b.startedAt - a.startedAt;
    }
    if (sort === "state") {
      return STATE_ORDER[a.state] - STATE_ORDER[b.state] || b.startedAt - a.startedAt;
    }
    return b.startedAt - a.startedAt;
  };

export type RowFilter = {
  readonly persona: string;
  readonly query: string;
  readonly kind: OriginKind | "any";
  readonly state: AgentTaskState | "any";
};

export const filterRows = (all: readonly TaskRow[], filter: RowFilter): readonly TaskRow[] => {
  const needle = filter.query.trim().toLocaleLowerCase();
  return all
    .filter((row) => filter.persona === "any" || row.personaId === filter.persona)
    .filter((row) => filter.kind === "any" || row.originKind === filter.kind)
    .filter((row) => filter.state === "any" || row.state === filter.state)
    .filter(
      (row) =>
        needle === "" ||
        row.title.toLocaleLowerCase().includes(needle) ||
        row.personaName.toLocaleLowerCase().includes(needle)
    );
};

export const sortRows = (
  all: readonly TaskRow[],
  sort: SortKey,
  direction: "asc" | "desc"
): readonly TaskRow[] => {
  const compare = compareRows(sort);
  return all.toSorted((a, b) => (direction === "asc" ? compare(a, b) : -compare(a, b)));
};

export const manualAutomationsIn = (
  answer: ReadAgentsLibraryResult | undefined
): readonly AutomationItem[] =>
  answer?.automations.filter((row) => row.trigger.kind === "manual") ?? [];

export const nextName = (base: string, taken: readonly string[]): string => {
  const lower = new Set(taken.map((name) => name.toLocaleLowerCase()));
  if (!lower.has(base.toLocaleLowerCase())) return base;
  let suffix = 2;
  while (lower.has(`${base} ${suffix}`.toLocaleLowerCase())) suffix += 1;
  return `${base} ${suffix}`;
};

export const toolChange = (
  chosen: readonly ToolId[],
  defaults: readonly ToolId[],
  tool: ToolId
): "default" | "added" | "removed" | "off" => {
  const on = chosen.includes(tool);
  const wanted = defaults.includes(tool);
  if (on && wanted) return "default";
  if (on) return "added";
  if (wanted) return "removed";
  return "off";
};

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
  if (automation !== undefined) {
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
  }
  return undefined;
};

export const NEW = "new";

export const isNew = (focus: string | undefined): boolean =>
  focus === undefined || focus === NEW || focus.startsWith(`${NEW}:`);

export const presetPersonaOf = (focus: string | undefined): string | undefined =>
  focus !== undefined && focus.startsWith(`${NEW}:`) ? focus.slice(NEW.length + 1) : undefined;

export const isSelected = (view: WorkspaceStateModel, kind: string, id: string): boolean =>
  view.selection?.kind === kind && view.selection.id === id;

export const inspectPersona = (view: WorkspaceStateModel, personaId: string): void => {
  view.inspect("agents.persona", { kind: "persona", id: personaId });
};

export const inspectTask = (view: WorkspaceStateModel, taskId: string): void => {
  view.inspect("agents.task", { kind: "task", id: taskId });
};

export const inspectAutomation = (view: WorkspaceStateModel, automationId: string): void => {
  view.inspect("agents.automation", { kind: "automation", id: automationId });
};

export const inspectTool = (view: WorkspaceStateModel, toolId: ToolId, ownerId: string): void => {
  view.inspect("agents.tool", { kind: "tool", id: toolId, at: ownerId });
};

export const inspectActivity = (view: WorkspaceStateModel, eventId: string): void => {
  view.inspect("agents.activity", { kind: "activity", id: eventId });
};

export const showLibrary = (view: WorkspaceStateModel): void => {
  view.showContent("agents.library", undefined);
};

export const openPersona = (view: WorkspaceStateModel, personaId: string): void => {
  view.showContent("agents.persona", personaId);
};

export const openTask = (view: WorkspaceStateModel, taskId: string): void => {
  view.showContent("agents.task", taskId);
};

export const openAutomation = (view: WorkspaceStateModel, automationId: string): void => {
  view.showContent("agents.automation", automationId);
};

export const openNewTask = (view: WorkspaceStateModel, personaId?: string): void => {
  view.showContent("agents.task", personaId === undefined ? NEW : `${NEW}:${personaId}`);
};

export const makeAutomation = async (
  view: WorkspaceStateModel,
  personaId: string,
  taken: readonly string[]
): Promise<string | undefined> => {
  const result = await createAutomation(view, {
    personaId,
    name: nextName("Untitled automation", taken)
  });
  if (!result.accepted) throw new Error(result.detail);
  return result.id;
};

export const openChat = (view: WorkspaceStateModel, chatId: string): void => {
  view.open({ category: "research", content: "research.thread", resourceId: chatId });
};

const flight = (view: WorkspaceStateModel, ...parts: readonly (string | number | boolean | null)[]) =>
  ["agents", view.project, ...parts] as const;

export const createPersona = (view: WorkspaceStateModel, name: string) =>
  view.singleFlight(flight(view, "create-persona", name), () =>
    createPersonaRemote({ name }).updates(readAgentsLibrary)
  );

export const updatePersona = (
  view: WorkspaceStateModel,
  persona: Revisioned,
  patch: UpdatePersonaPatch
) =>
  view.singleFlight(
    flight(view, "update-persona", persona.id, persona.revision, JSON.stringify(patch)),
    () =>
      updatePersonaRemote({ personaId: persona.id, baseRevision: persona.revision, patch }).updates(
        readAgentsLibrary,
        readPersona({ personaId: persona.id })
      )
  );

export const duplicatePersona = (view: WorkspaceStateModel, personaId: string) =>
  view.singleFlight(flight(view, "duplicate-persona", personaId), () =>
    duplicatePersonaRemote({ personaId }).updates(readAgentsLibrary)
  );

export const removePersona = (view: WorkspaceStateModel, persona: Revisioned) =>
  view.singleFlight(flight(view, "remove-persona", persona.id, persona.revision), () =>
    removePersonaRemote({ personaId: persona.id, baseRevision: persona.revision }).updates(
      readAgentsLibrary,
      readPersona({ personaId: persona.id })
    )
  );

export const createTask = (view: WorkspaceStateModel, input: CreateTaskInput) =>
  view.singleFlight(flight(view, "create-task", input.personaId, input.title), () =>
    createTaskRemote(input).updates(readAgentsLibrary)
  );

export const updateTask = (view: WorkspaceStateModel, task: Revisioned, patch: UpdateTaskPatch) =>
  view.singleFlight(
    flight(view, "update-task", task.id, task.revision, JSON.stringify(patch)),
    () =>
      updateTaskRemote({ taskId: task.id, baseRevision: task.revision, patch }).updates(
        readAgentsLibrary,
        readTask({ taskId: task.id })
      )
  );

export const sendTaskMessage = (view: WorkspaceStateModel, taskId: string, text: string) =>
  view.singleFlight(flight(view, "send-task-message", taskId, text), () =>
    sendTaskMessageRemote({ taskId, text }).updates(readTask({ taskId }))
  );

export const answerTaskQuestion = (
  view: WorkspaceStateModel,
  taskId: string,
  questionId: string,
  reply: { readonly answer: string } | { readonly reject: true }
) =>
  view.singleFlight(flight(view, "answer-task-question", taskId, questionId), () =>
    answerTaskQuestionRemote({ taskId, questionId, ...reply }).updates(
      readAgentsLibrary,
      readTask({ taskId })
    )
  );

export const createAutomation = (view: WorkspaceStateModel, input: CreateAutomationInput) =>
  view.singleFlight(flight(view, "create-automation", input.personaId, input.name), () =>
    createAutomationRemote(input).updates(readAgentsLibrary)
  );

export const updateAutomation = (
  view: WorkspaceStateModel,
  automation: Revisioned,
  patch: UpdateAutomationPatch
) =>
  view.singleFlight(
    flight(view, "update-automation", automation.id, automation.revision, JSON.stringify(patch)),
    () =>
      updateAutomationRemote({
        automationId: automation.id,
        baseRevision: automation.revision,
        patch
      }).updates(readAgentsLibrary, readAutomation({ automationId: automation.id }))
  );

export const removeAutomation = (view: WorkspaceStateModel, automation: Revisioned) =>
  view.singleFlight(flight(view, "remove-automation", automation.id, automation.revision), () =>
    removeAutomationRemote({
      automationId: automation.id,
      baseRevision: automation.revision
    }).updates(readAgentsLibrary, readAutomation({ automationId: automation.id }))
  );

export const runAutomation = (view: WorkspaceStateModel, automationId: string) =>
  view.singleFlight(flight(view, "run-automation", automationId, Date.now()), () =>
    runAutomationRemote({ automationId }).updates(
      readAgentsLibrary,
      readAutomation({ automationId })
    )
  );

export const setScope = (view: WorkspaceStateModel, owner: Owner, scope: ResourceSet | null) =>
  owner.kind === "persona"
    ? updatePersona(view, owner, { scope })
    : owner.kind === "task"
      ? updateTask(view, owner, { scope })
      : updateAutomation(view, owner, { scope });

export const createChat = (view: WorkspaceStateModel, personaId: string) =>
  view.singleFlight(flight(view, "create-chat", personaId, Date.now()), () =>
    createChatRemote({ personaId }).updates(readAgentsLibrary)
  );

export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
