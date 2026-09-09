import type { StoreModel, TableRow } from "$model/server/store/index.server";
import type { TaskOrigin } from "$representation/data/types/agents/agent-task";
import { messageText } from "$representation/data/behavior/agents/messages";
import { openQuestions, planProgress } from "$representation/data/behavior/agents/plan";
import { orderedTools } from "$representation/data/behavior/agents/tools";
import { triggerSummary } from "$representation/data/behavior/agents/triggers";

import type { Names } from "$capabilities/agents/api/shared/names";
import type { Visible } from "$capabilities/agents/api/shared/projection";
import { messagesOf } from "$capabilities/agents/api/shared/threads";
import type { TaskDetail, TaskItem, TaskTurn } from "$capabilities/agents/types/agents";

type Task = TableRow<"agentTasks">;

/**
 * A task, as the surfaces read one.
 *
 * Its own concern because a task is the only row in this category that carries
 * a run: a plan with progress, open questions, outputs, and a thread whose last
 * line is what the table shows.
 */
const originName = (origin: TaskOrigin, names: Names): string | null =>
  origin.kind === "automation" ? names.automation(origin.automationId) : null;

const startedBy = (task: Task, visible: Visible): string => {
  const { names } = visible;
  const origin = task.origin;
  if (origin.kind === "person") return names.actor(task.createdBy);
  if (origin.trigger === "manual") {
    return task.createdBy.kind === "user" ? names.actor(task.createdBy) : "By hand";
  }
  if (origin.trigger === "schedule") {
    const rule = visible.automations.find((row) => row._id === origin.automationId);
    return rule !== undefined && rule.trigger.kind === "schedule"
      ? triggerSummary(rule.trigger)
      : "On schedule";
  }
  const named = origin.ref === undefined ? null : names.resource(origin.ref);
  if (origin.trigger === "resource-edited") {
    return named === null ? "An edit" : `Edit to ${named}`;
  }
  return named === null ? "A new resource" : `New: ${named}`;
};

export const taskItem = (task: Task, visible: Visible): TaskItem => ({
  id: task._id,
  title: task.title,
  personaId: task.personaId,
  personaName: visible.names.persona(task.personaId),
  state: task.state,
  origin: task.origin,
  automationName: originName(task.origin, visible.names),
  startedAt: task.startedAt,
  finishedAt: task.finishedAt ?? null,
  startedByName: startedBy(task, visible),
  progress: planProgress(task.plan),
  openQuestions: openQuestions(task.questions).length,
  outputCount: task.outputs.length,
  scope: task.scope ?? null,
  tools: orderedTools(task.tools ?? []),
  revision: task.revision,
  updatedAt: task.updatedAt
});

const turnsOf = (store: StoreModel, task: Task, names: Names): readonly TaskTurn[] =>
  messagesOf(store, task.threadId).map((message) => {
    const author = message.author;
    const from =
      author === undefined
        ? "agent"
        : author.kind === "agent"
          ? "agent"
          : author.kind === "system"
            ? "system"
            : "person";
    return {
      id: message.id,
      from,
      authorName:
        author === undefined || author.kind === "agent"
          ? names.persona(task.personaId)
          : names.actor(author),
      text: messageText(message),
      at: message.sentAt
    };
  });

export const taskDetail = (store: StoreModel, task: Task, visible: Visible): TaskDetail => ({
  ...taskItem(task, visible),
  instruction: task.instruction,
  plan: task.plan,
  outputs: task.outputs.map((output) => ({
    ...output,
    refName: output.ref === undefined ? null : visible.names.resource(output.ref)
  })),
  questions: task.questions.map((question) => ({
    ...question,
    answeredByName:
      question.answeredBy === undefined ? null : visible.names.actor(question.answeredBy)
  })),
  turns: turnsOf(store, task, visible.names),
  reviewedByName: task.reviewedBy === undefined ? null : visible.names.actor(task.reviewedBy)
});
