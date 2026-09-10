import { isToolId } from "$representation/data/behavior/agents/tools";
import {
  isRepeat,
  isTriggerKind,
  isWeekday
} from "$representation/data/behavior/agents/triggers";
import {
  isResourceRef,
  isResourceSelectorKind
} from "$representation/data/behavior/core/resource";
import { currentScope } from "$representation/data/behavior/content/admission-inline";
import {
  exact,
  identifier,
  recordOf,
  text
} from "$representation/data/behavior/content/admission-values";
import {
  isStoredActor,
  isStoredNatural,
  isStoredRowId,
  isStoredTime
} from "$representation/data/behavior/core/stored";
import type { TableName, TableRow } from "$representation/store/tables";

type Fields = Record<string, unknown>;

const positiveRevision = (value: unknown): value is number =>
  isStoredNatural(value) && value >= 1;
const nonemptyText = (value: unknown): value is string => text(value) && value.length > 0;

const currentResourceSet = (value: unknown): boolean => {
  if (!currentScope(value)) return false;
  const scope = recordOf(value);
  if (scope === undefined) return false;
  const terms = [...scope.include as unknown[], ...scope.exclude as unknown[]];
  return terms.every((term) => recordOf(term)?.select !== "hole");
};

const tools = (value: unknown): boolean =>
  Array.isArray(value) && value.every((entry) => isToolId(entry));

const currentRow = (
  value: unknown,
  table: TableName,
  required: readonly string[],
  optional: readonly string[] = []
): value is Fields => {
  const row = recordOf(value);
  return row !== undefined && exact(
    row,
    ["_id", "_creationTime", "projectId", "createdBy", "revision", "updatedAt", ...required],
    optional
  ) &&
    isStoredRowId(row._id, table) &&
    isStoredTime(row._creationTime) && isStoredRowId(row.projectId, "projects") &&
    isStoredActor(row.createdBy) &&
    positiveRevision(row.revision) && isStoredTime(row.updatedAt);
};

const definition = (value: unknown): boolean => {
  const held = recordOf(value);
  return held !== undefined &&
    exact(held, ["focus", "background", "approach", "outputPreferences", "verification"]) &&
    text(held.focus) && text(held.background) && text(held.approach) &&
    text(held.outputPreferences) && text(held.verification);
};

const cast = (value: unknown): boolean => {
  const held = recordOf(value);
  const level = (candidate: unknown) =>
    candidate === "low" || candidate === "medium" || candidate === "high";
  return held !== undefined && exact(held, ["label", "strength", "speed"]) &&
    nonemptyText(held.label) && level(held.strength) && level(held.speed);
};

const avatar = (value: unknown): boolean => {
  const held = recordOf(value);
  if (held === undefined) return false;
  if (held.kind === "emoji") return exact(held, ["kind", "emoji"]) && nonemptyText(held.emoji);
  return held.kind === "image" && exact(held, ["kind", "storageId"]) &&
    isStoredRowId(held.storageId, "_storage");
};

const taskOrigin = (value: unknown): boolean => {
  const held = recordOf(value);
  if (held === undefined) return false;
  if (held.kind === "person") return exact(held, ["kind"]);
  return held.kind === "automation" &&
    exact(held, ["kind", "automationId", "trigger"], ["ref"]) &&
    isStoredRowId(held.automationId, "automations") && isTriggerKind(held.trigger) &&
    (held.ref === undefined || isResourceRef(held.ref));
};

const trigger = (value: unknown): boolean => {
  const held = recordOf(value);
  if (held === undefined || !isTriggerKind(held.kind)) return false;
  if (held.kind === "manual") return exact(held, ["kind"]);
  if (held.kind === "schedule") {
    return exact(held, ["kind", "at", "repeats", "timezone"], ["weekday"]) &&
      text(held.at) && isRepeat(held.repeats) && identifier(held.timezone) &&
      (held.weekday === undefined || isWeekday(held.weekday));
  }
  if (held.kind === "resource-edited") {
    return exact(held, ["kind", "kinds"], ["ref"]) && Array.isArray(held.kinds) &&
      held.kinds.every(isResourceSelectorKind) &&
      (held.ref === undefined || isResourceRef(held.ref));
  }
  return exact(held, ["kind", "kinds"]) && Array.isArray(held.kinds) &&
    held.kinds.every(isResourceSelectorKind);
};

const planStep = (value: unknown): boolean => {
  const held = recordOf(value);
  return held !== undefined && exact(held, ["id", "title", "state"], ["note"]) &&
    identifier(held.id) && nonemptyText(held.title) &&
    (held.state === "pending" || held.state === "active" || held.state === "done") &&
    (held.note === undefined || text(held.note));
};

const taskOutput = (value: unknown): boolean => {
  const held = recordOf(value);
  return held !== undefined && exact(held, ["id", "title", "at"], ["detail", "ref"]) &&
    identifier(held.id) && nonemptyText(held.title) &&
    (held.detail === undefined || text(held.detail)) &&
    (held.ref === undefined || isResourceRef(held.ref)) && isStoredTime(held.at);
};

const taskQuestion = (value: unknown): boolean => {
  const held = recordOf(value);
  return held !== undefined && exact(
    held,
    ["id", "text", "askedAt"],
    ["stepId", "options", "answer", "answeredAt", "answeredBy", "rejectedAt"]
  ) && identifier(held.id) && text(held.text) && isStoredTime(held.askedAt) &&
    (held.stepId === undefined || identifier(held.stepId)) &&
    (held.options === undefined || (
      Array.isArray(held.options) && held.options.every((option) => text(option))
    )) &&
    (held.answer === undefined || text(held.answer)) &&
    (held.answeredAt === undefined || isStoredTime(held.answeredAt)) &&
    (held.answeredBy === undefined || isStoredActor(held.answeredBy)) &&
    (held.rejectedAt === undefined || isStoredTime(held.rejectedAt));
};

const PERSONA_FIELDS = ["name", "definition", "tools"] as const;

/** Whether a persisted persona is exactly the current recursive representation. */
export const isStoredPersona = (value: unknown): value is TableRow<"personas"> => {
  if (!currentRow(value, "personas", PERSONA_FIELDS, ["description", "scope", "cast", "avatar"])) {
    return false;
  }
  return nonemptyText(value.name) && (value.description === undefined || text(value.description)) &&
    definition(value.definition) && (value.scope === undefined || currentResourceSet(value.scope)) &&
    (value.cast === undefined || cast(value.cast)) && tools(value.tools) &&
    (value.avatar === undefined || avatar(value.avatar));
};

const TASK_FIELDS = [
  "threadId", "title", "instruction", "personaId", "origin", "state", "tools", "plan",
  "outputs", "questions", "startedAt"
] as const;

/** Whether a persisted task is exactly the current recursive representation. */
export const isStoredAgentTask = (value: unknown): value is TableRow<"agentTasks"> => {
  if (!currentRow(value, "agentTasks", TASK_FIELDS, ["scope", "finishedAt", "reviewedBy"])) {
    return false;
  }
  return isStoredRowId(value.threadId, "threads") && nonemptyText(value.title) &&
    text(value.instruction) && isStoredRowId(value.personaId, "personas") &&
    taskOrigin(value.origin) &&
    (value.state === "running" || value.state === "review" || value.state === "finished") &&
    (value.scope === undefined || currentResourceSet(value.scope)) && tools(value.tools) &&
    Array.isArray(value.plan) && value.plan.every(planStep) &&
    Array.isArray(value.outputs) && value.outputs.every(taskOutput) &&
    Array.isArray(value.questions) && value.questions.every(taskQuestion) &&
    isStoredTime(value.startedAt) &&
    (value.finishedAt === undefined || isStoredTime(value.finishedAt)) &&
    (value.reviewedBy === undefined || isStoredActor(value.reviewedBy));
};

const AUTOMATION_FIELDS = [
  "name", "personaId", "instruction", "trigger", "tools", "enabled", "firedCount"
] as const;

/** Whether a persisted automation is exactly the current recursive representation. */
export const isStoredAutomation = (value: unknown): value is TableRow<"automations"> => {
  if (!currentRow(value, "automations", AUTOMATION_FIELDS, ["scope", "lastFiredAt"])) return false;
  return nonemptyText(value.name) && isStoredRowId(value.personaId, "personas") &&
    text(value.instruction) &&
    trigger(value.trigger) && (value.scope === undefined || currentResourceSet(value.scope)) &&
    tools(value.tools) && typeof value.enabled === "boolean" &&
    Number.isSafeInteger(value.firedCount) && (value.firedCount as number) >= 0 &&
    (value.lastFiredAt === undefined || isStoredTime(value.lastFiredAt));
};

const activityTarget = (value: unknown): boolean => {
  const held = recordOf(value);
  return held !== undefined && exact(held, ["kind", "id", "label"]) &&
    identifier(held.kind) && identifier(held.id) && text(held.label);
};

/** Whether a persisted activity event is exactly the current recursive representation. */
export const isStoredAgentActivity = (value: unknown): value is TableRow<"activity"> => {
  const row = recordOf(value);
  if (row === undefined || !exact(
    row,
    ["_id", "_creationTime", "projectId", "actor", "actorLabel", "verb", "target"],
    ["context", "detail"]
  )) return false;
  return isStoredRowId(row._id, "activity") &&
    isStoredTime(row._creationTime) && isStoredRowId(row.projectId, "projects") &&
    isStoredActor(row.actor) &&
    text(row.actorLabel) && text(row.verb) && activityTarget(row.target) &&
    (row.context === undefined || activityTarget(row.context)) &&
    (row.detail === undefined || text(row.detail));
};
