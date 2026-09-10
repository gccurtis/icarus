import type { PlanStep, TaskQuestion } from "$representation/data/types/agents/agent-task";

export type PlanProgress = {
  readonly done: number;
  readonly total: number;
  readonly percent: number | null;
  readonly current: string | null;
};

export const planProgress = (plan: readonly PlanStep[]): PlanProgress => {
  const total = plan.length;
  const done = plan.filter((step) => step.state === "done").length;
  const active = plan.find((step) => step.state === "active");
  const next = plan.find((step) => step.state === "pending");
  return {
    done,
    total,
    percent: total === 0 ? null : Math.round((done / total) * 100),
    current: active?.title ?? next?.title ?? null
  };
};

export const isOpen = (question: TaskQuestion): boolean =>
  question.state === "open";

export const openQuestions = (questions: readonly TaskQuestion[]): readonly TaskQuestion[] =>
  questions.filter(isOpen);
