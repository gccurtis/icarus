import type { AutomationTriggerKind } from "$representation/data/types/agents/automation";
import type { Actor } from "$representation/data/types/core/actor";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";

export type AgentTaskState = "running" | "review" | "finished";

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

export type TaskQuestion = {
  id: string;
  text: string;
  askedAt: number;
  stepId?: string;
  options?: string[];
  answer?: string;
  answeredAt?: number;
  answeredBy?: Actor;
  rejectedAt?: number;
};

export type TaskOrigin =
  | { kind: "person" }
  | {
      kind: "automation";
      automationId: Id<"automations">;
      trigger: AutomationTriggerKind;
      ref?: ResourceRef;
    };
