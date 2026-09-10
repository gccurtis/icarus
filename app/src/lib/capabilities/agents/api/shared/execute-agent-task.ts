import type { ServerModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { Message } from "$representation/data/types/agents/message";
import type { TaskOutput } from "$representation/data/types/agents/agent-task";
import { sameResourceRef } from "$representation/data/behavior/core/resource";
import { answerQuestion, personaPrompt } from "$capabilities/research-chat";

import { agentRunnerConfiguration } from "$capabilities/agents/api/shared/runner-configuration";
import {
  completedRunnerPlan,
  answeringRunnerPlan,
  publishingRunnerPlan,
  queuedRunnerPlan
} from "$capabilities/agents/api/shared/runner-plan";
import {
  answerText,
  pendingPrompts,
  priorConversation,
  promptText
} from "$capabilities/agents/api/shared/runner-messages";
import {
  effectiveTaskScope,
  prepareTaskScope,
  refsInTaskScope
} from "$capabilities/agents/api/shared/runner-scope";
import { readAgentExecutionState } from "$capabilities/agents/api/shared/runner-state";
import { appendMessage } from "$capabilities/agents/api/shared/threads";
import { uniqueId } from "$capabilities/agents/api/shared/store";
import type { RowFields } from "$capabilities/agents/api/shared/store";

type ExecutionOutcome = "complete" | "retry" | "terminal";

const sameInputs = (
  messages: readonly Message[],
  expected: readonly string[]
): boolean => {
  const now = pendingPrompts(messages).map((message) => message.id);
  return now.length === expected.length && now.every((id, index) => id === expected[index]);
};

const answerOutputs = (
  at: number,
  text: string,
  sources: readonly {
    readonly ref: ResourceRef;
    readonly title: string;
    readonly excerpt: string;
    readonly uses: readonly string[];
  }[]
): TaskOutput[] => [
  {
    id: `answer-${uniqueId()}`,
    title: "Grounded answer",
    detail: text,
    at
  },
  ...sources.map((source) => ({
    id: `source-${uniqueId()}`,
    title: source.title,
    detail: (source.uses.length > 0 ? source.uses.join(" ") : source.excerpt).slice(0, 2_000),
    ref: source.ref,
    at
  }))
];

/** Execute one current Agent task until it publishes or observes a newer input. */
export const executeAgentTask = async (
  model: ServerModel,
  taskId: Id<"agentTasks">,
  signal: AbortSignal
): Promise<ExecutionOutcome> => {
  signal.throwIfAborted();
  const execution = readAgentExecutionState(model.store, taskId);
  if (execution === undefined) return "terminal";
  const { task, persona, messages } = execution;
  if (task.state !== "running") return "terminal";
  const prompts = pendingPrompts(messages);
  if (prompts.length === 0) throw new Error("The running task has no unanswered instruction");
  const promptIds = prompts.map((message) => message.id);
  const taskRevision = task.revision;
  const personaRevision = persona.revision;
  const scope = effectiveTaskScope(task, persona);
  const configuration = agentRunnerConfiguration(model);

  model.store.transaction((unit) => {
    unit.update(`agentTasks.${task._id}.plan`, queuedRunnerPlan());
  });
  const prepared = await prepareTaskScope(
    model,
    task.projectId,
    scope,
    task.tools,
    signal
  );
  signal.throwIfAborted();

  const afterPreparation = readAgentExecutionState(model.store, taskId);
  if (afterPreparation === undefined || afterPreparation.task.state !== "running") {
    return "terminal";
  }
  if (
    afterPreparation.task.revision !== taskRevision ||
    afterPreparation.persona.revision !== personaRevision ||
    !sameInputs(afterPreparation.messages, promptIds)
  ) {
    model.store.transaction((unit) => {
      unit.update(`agentTasks.${task._id}.plan`, queuedRunnerPlan());
    });
    return "retry";
  }
  model.store.transaction((unit) => {
    unit.update(`agentTasks.${task._id}.plan`, answeringRunnerPlan(prepared));
  });

  // `project` selects the catalogue root. `bound` is the mandatory task/persona
  // boundary applied to retrieval and every authoritative read inside the tool session.
  const answer = await answerQuestion({
    model,
    projectId: task.projectId,
    scope: { kind: "project" },
    question: promptText(prompts),
    history: priorConversation(messages, prompts),
    topK: configuration.topK,
    maxSources: configuration.maxSources,
    chatModel: configuration.model,
    maxToolRounds: configuration.maxToolRounds,
    persona: personaPrompt(persona),
    bound: scope,
    grants: task.tools,
    stopping: () => false,
    signal
  });
  signal.throwIfAborted();
  const text = answerText(answer.blocks);
  const beforePublication = readAgentExecutionState(model.store, taskId);
  if (beforePublication === undefined || beforePublication.task.state !== "running") {
    return "terminal";
  }
  if (
    beforePublication.task.revision !== taskRevision ||
    beforePublication.persona.revision !== personaRevision ||
    !sameInputs(beforePublication.messages, promptIds)
  ) {
    model.store.transaction((unit) => {
      unit.update(`agentTasks.${task._id}.plan`, queuedRunnerPlan());
    });
    return "retry";
  }
  const publicationScope = effectiveTaskScope(beforePublication.task, beforePublication.persona);
  const permitted = refsInTaskScope(model, beforePublication.task.projectId, publicationScope);
  if (answer.sources.some((source) => !permitted.some((ref) => sameResourceRef(ref, source.ref)))) {
    throw new Error("The grounded answer cited a resource outside the task's exact current scope");
  }
  model.store.transaction((unit) => {
    unit.update(`agentTasks.${task._id}.plan`, publishingRunnerPlan(prepared));
  });

  const at = Date.now();
  return model.store.transaction((unit): ExecutionOutcome => {
    const currentExecution = readAgentExecutionState(unit, taskId);
    if (currentExecution === undefined || currentExecution.task.state !== "running") {
      return "terminal";
    }
    const { task: current, persona: currentPersona, messages: currentMessages } = currentExecution;
    if (
      current.revision !== taskRevision ||
      currentPersona.revision !== personaRevision ||
      !sameInputs(currentMessages, promptIds)
    ) {
      unit.update(`agentTasks.${current._id}.plan`, queuedRunnerPlan());
      return "retry";
    }

    appendMessage(
      unit,
      current.projectId,
      current.threadId,
      "agentTask",
      "response",
      { kind: "agent", taskId: asId<"agentTasks">(current._id) },
      at,
      text,
      answer.sources.map((source) => source.ref)
    );
    const fields: RowFields<"agentTasks"> = {
      projectId: current.projectId,
      threadId: current.threadId,
      title: current.title,
      instruction: current.instruction,
      personaId: current.personaId,
      origin: current.origin,
      ...(current.scope === undefined ? {} : { scope: current.scope }),
      tools: current.tools,
      plan: completedRunnerPlan(prepared, answer.sources.length),
      outputs: [...current.outputs, ...answerOutputs(at, text, answer.sources)],
      questions: current.questions,
      createdBy: current.createdBy,
      startedAt: current.startedAt,
      state: "review",
      finishedAt: at,
      revision: current.revision,
      updatedAt: at
    };
    unit.update(`agentTasks.${current._id}`, fields);
    unit.create("activity", {
      projectId: current.projectId,
      actor: { kind: "agent", taskId: asId<"agentTasks">(current._id) },
      actorLabel: currentPersona.name,
      verb: answer.status === "answered" ? "answered" : "found insufficient evidence for",
      target: { kind: "task", id: current._id, label: current.title }
    });
    return "complete";
  });
};
