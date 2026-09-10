import { isTriggerKind } from "$representation/data/behavior/agents/triggers";
import {
  currentAgentRow,
  currentResourceSet,
  nonemptyText,
  storedTools
} from "$representation/data/behavior/agents/stored/shared";
import { isResourceRef } from "$representation/data/behavior/core/resource";
import { exact, identifier, recordOf, text } from "$representation/data/behavior/content/admission-values";
import { isStoredActor, isStoredRowId, isStoredTime } from "$representation/data/behavior/core/stored";
import type { TableRow } from "$representation/store/tables";

const taskOrigin = (value: unknown): boolean => {
  const held = recordOf(value);
  if (held === undefined) return false;
  if (held.kind === "person") return exact(held, ["kind"]);
  if (held.kind !== "automation" || !isStoredRowId(held.automationId, "automations")) {
    return false;
  }
  if (held.trigger === "resource-edited") {
    return exact(held, ["kind", "automationId", "trigger"], ["ref"]) &&
      (!Object.hasOwn(held, "ref") || isResourceRef(held.ref));
  }
  return isTriggerKind(held.trigger) && held.trigger !== "resource-edited" &&
    exact(held, ["kind", "automationId", "trigger"]);
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
    (!Object.hasOwn(held, "ref") || isResourceRef(held.ref)) && isStoredTime(held.at);
};

const taskQuestion = (value: unknown): boolean => {
  const held = recordOf(value);
  if (held === undefined || !isStoredTime(held.askedAt)) return false;
  const optional = ["stepId", "options"];
  const base = identifier(held.id) && nonemptyText(held.text) &&
    (!Object.hasOwn(held, "stepId") || identifier(held.stepId)) &&
    (!Object.hasOwn(held, "options") || (
      Array.isArray(held.options) && held.options.length > 0 &&
      held.options.every((option) => nonemptyText(option)) &&
      new Set(held.options).size === held.options.length
    ));
  if (!base) return false;
  if (held.state === "open") {
    return exact(held, ["id", "text", "askedAt", "state"], optional);
  }
  if (held.state === "answered") {
    return exact(
      held,
      ["id", "text", "askedAt", "state", "answer", "answeredAt", "answeredBy"],
      optional
    ) && nonemptyText(held.answer) && isStoredTime(held.answeredAt) &&
      held.answeredAt >= held.askedAt && isStoredActor(held.answeredBy);
  }
  return held.state === "rejected" && exact(
    held,
    ["id", "text", "askedAt", "state", "rejectedAt", "answeredBy"],
    optional
  ) && isStoredTime(held.rejectedAt) && held.rejectedAt >= held.askedAt &&
    isStoredActor(held.answeredBy);
};

const taskExecution = (value: unknown): boolean => {
  const held = recordOf(value);
  return held !== undefined && exact(held, ["kind"]) && held.kind === "grounded";
};

const uniqueEntries = (value: readonly { id: string }[]): boolean =>
  new Set(value.map((entry) => entry.id)).size === value.length;

const orderedPlan = (value: readonly { state: unknown }[]): boolean => {
  const rank = (state: unknown): number => state === "done" ? 0 : state === "active" ? 1 : 2;
  let previous = 0;
  let active = 0;
  for (const step of value) {
    const current = rank(step.state);
    if (current < previous) return false;
    if (step.state === "active" && ++active > 1) return false;
    previous = current;
  }
  return true;
};

const TASK_FIELDS = [
  "threadId", "title", "instruction", "personaId", "origin", "state", "tools", "plan",
  "outputs", "questions", "startedAt"
] as const;

export const isStoredAgentTask = (value: unknown): value is TableRow<"agentTasks"> => {
  const held = recordOf(value);
  if (held === undefined) return false;
  const lifecycle = held.state === "running"
    ? currentAgentRow(value, "agentTasks", [...TASK_FIELDS, "execution"], ["scope"]) &&
      taskExecution(held.execution)
    : held.state === "review"
      ? currentAgentRow(value, "agentTasks", [...TASK_FIELDS, "finishedAt"], ["scope"])
      : held.state === "finished" && currentAgentRow(
        value,
        "agentTasks",
        [...TASK_FIELDS, "finishedAt"],
        ["scope", "reviewedBy"]
      );
  if (!lifecycle) return false;
  const plan = held.plan;
  const outputs = held.outputs;
  const questions = held.questions;
  return isStoredRowId(held.threadId, "threads") && nonemptyText(held.title) &&
    text(held.instruction) && isStoredRowId(held.personaId, "personas") &&
    taskOrigin(held.origin) &&
    (held.state === "running" || held.state === "review" || held.state === "finished") &&
    (held.scope === undefined || currentResourceSet(held.scope)) && storedTools(held.tools) &&
    Array.isArray(plan) && plan.every(planStep) && uniqueEntries(plan) && orderedPlan(plan) &&
    Array.isArray(outputs) && outputs.every(taskOutput) && uniqueEntries(outputs) &&
    Array.isArray(questions) && questions.every(taskQuestion) && uniqueEntries(questions) &&
    questions.every((question) =>
      question.stepId === undefined || plan.some((step) => step.id === question.stepId)
    ) &&
    isStoredTime(held.startedAt) &&
    (held.state === "running" || (
      isStoredTime(held.finishedAt) && held.finishedAt >= held.startedAt
    )) &&
    (held.state !== "finished" || held.reviewedBy === undefined || isStoredActor(held.reviewedBy));
};
