import type { PlanStep } from "$representation/data/types/agents/agent-task";

const STEPS = [
  { id: "ground-scope", title: "Prepare the permitted sources" },
  { id: "ground-answer", title: "Answer from grounded evidence" },
  { id: "ground-publish", title: "Publish the result" }
] as const;

export const queuedRunnerPlan = (): PlanStep[] => STEPS.map((step, index) => ({
  ...step,
  state: index === 0 ? "active" : "pending"
}));

export const answeringRunnerPlan = (prepared: number): PlanStep[] => STEPS.map((step, index) => ({
  ...step,
  state: index === 0 ? "done" : index === 1 ? "active" : "pending",
  ...(index === 0 ? { note: `${prepared} ${prepared === 1 ? "resource" : "resources"} prepared` } : {})
}));

export const publishingRunnerPlan = (prepared: number): PlanStep[] => STEPS.map((step, index) => ({
  ...step,
  state: index < 2 ? "done" : "active",
  ...(index === 0 ? { note: `${prepared} ${prepared === 1 ? "resource" : "resources"} prepared` } : {})
}));

export const completedRunnerPlan = (prepared: number, sources: number): PlanStep[] => STEPS.map(
  (step, index) => ({
    ...step,
    state: "done",
    ...(index === 0
      ? { note: `${prepared} ${prepared === 1 ? "resource" : "resources"} prepared` }
      : index === 2
        ? { note: `${sources} ${sources === 1 ? "source" : "sources"} cited` }
        : {})
  })
);

export const failedRunnerPlan = (
  plan: readonly PlanStep[],
  note: string
): PlanStep[] => plan.map((step) =>
  step.state === "active" ? { ...step, state: "done", note: note.slice(0, 2_000) } : step
);
