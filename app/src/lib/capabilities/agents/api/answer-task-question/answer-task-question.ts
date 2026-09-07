import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { isOpen } from "$representation/data/behavior/agents/plan";

import { validateAnswerTaskQuestion } from "$capabilities/agents/api/answer-task-question/validate-answer-task-question";
import { findVisible, notFound, refused, viewer } from "$capabilities/agents/api/shared/lookup";
import { appendMessage } from "$capabilities/agents/api/shared/threads";
import type { WriteResult } from "$capabilities/agents/types/agents";

export const answerTaskQuestion = async (input: unknown): Promise<WriteResult> => {
  const scope = await requireScope();
  const asked = validateAnswerTaskQuestion(input);

  const store = serverModel().store;
  const found = findVisible(store, scope, "agentTasks", asked.taskId);
  if (found.kind !== "found") return notFound(asked.taskId, "task");
  const task = found.row;
  const question = task.questions.find((candidate) => candidate.id === asked.questionId);
  if (question === undefined) {
    return refused(asked.taskId, "not-found", "the task asked no question with that id", task.revision);
  }
  if (!isOpen(question)) {
    return refused(asked.taskId, "invalid-state", "that question was already settled", task.revision);
  }
  if (task.state === "finished") {
    return refused(asked.taskId, "invalid-state", "the task is finished, so the answer would reach nobody", task.revision);
  }
  const at = Date.now();
  const actor = viewer(scope);
  const questions = task.questions.map((candidate) =>
    candidate.id !== question.id
      ? candidate
      : asked.reject
        ? { ...candidate, rejectedAt: at, answeredBy: actor }
        : { ...candidate, answer: asked.answer, answeredAt: at, answeredBy: actor }
  );
  appendMessage(
    store,
    scope.projectId,
    task.threadId,
    "prompt",
    actor,
    at,
    asked.reject ? `Not answering: ${question.text} Use your judgement.` : asked.answer ?? ""
  );
  store.update(`agentTasks.${task._id}.questions`, questions);
  store.update(`agentTasks.${task._id}.updatedAt`, at);
  return { accepted: true, id: task._id, revision: task.revision };
};
