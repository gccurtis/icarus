import type { AutomationTriggerKind } from "$representation/data/types/agents/automation";
import type { Actor } from "$representation/data/types/core/actor";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";

export type AgentTaskState = "running" | "review" | "finished";

/** The current executor that owns a durable running task. */
export type AgentTaskExecution = { kind: "grounded" };

/** State-specific fields are complete arms, not optional lifecycle fragments. */
export type AgentTaskLifecycle =
  | {
      state: "running";
      execution: AgentTaskExecution;
      finishedAt?: never;
      reviewedBy?: never;
    }
  | {
      state: "review";
      execution?: never;
      finishedAt: number;
      reviewedBy?: never;
    }
  | {
      state: "finished";
      execution?: never;
      finishedAt: number;
      reviewedBy?: Actor;
    };

export type PlanStepState = "pending" | "active" | "done";

export type PlanStep = {
  id: string;
  title: string;
  state: PlanStepState;
  note?: string;
};

export type TaskOutput = {
  id: string;
  title: string;
  detail?: string;
  ref?: ResourceRef;
  at: number;
};

type TaskQuestionBase = {
  id: string;
  text: string;
  askedAt: number;
  stepId?: string;
  options?: string[];
};

export type TaskQuestion = TaskQuestionBase & (
  | {
      state: "open";
      answer?: never;
      answeredAt?: never;
      answeredBy?: never;
      rejectedAt?: never;
    }
  | {
      state: "answered";
      answer: string;
      answeredAt: number;
      answeredBy: Actor;
      rejectedAt?: never;
    }
  | {
      state: "rejected";
      answer?: never;
      answeredAt?: never;
      answeredBy: Actor;
      rejectedAt: number;
    }
);

export type TaskOrigin =
  | { kind: "person" }
  | {
      kind: "automation";
      automationId: Id<"automations">;
      trigger: Exclude<AutomationTriggerKind, "resource-edited">;
      ref?: never;
    }
  | {
      kind: "automation";
      automationId: Id<"automations">;
      trigger: "resource-edited";
      ref?: ResourceRef;
    };
