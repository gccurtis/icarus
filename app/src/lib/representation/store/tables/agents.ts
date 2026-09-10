import type {
  AgentTaskLifecycle,
  PlanStep,
  TaskOrigin,
  TaskOutput,
  TaskQuestion
} from "$representation/data/types/agents/agent-task";
import type { AutomationTrigger } from "$representation/data/types/agents/automation";
import type { Message } from "$representation/data/types/agents/message";
import type { Cast, PersonaAvatar, PersonaDefinition } from "$representation/data/types/agents/persona";
import type { BranchPoint, ThreadKind } from "$representation/data/types/agents/thread";
import type { ToolId } from "$representation/data/types/agents/tool";
import type { Actor } from "$representation/data/types/core/actor";
import type { Id, Row } from "$representation/data/types/core/id";
import type { ResourceSet } from "$representation/data/types/core/resource-set";

export type ThreadFields = {
  projectId: Id<"projects">;
  kind: ThreadKind;
  branchedFrom?: BranchPoint;
};
export type Thread = Row<"threads"> & ThreadFields;

export type ThreadPartFields = {
  projectId: Id<"projects">;
  threadId: Id<"threads">;
  part: number;
  messages: Message[];
};
export type ThreadPart = Row<"threadParts"> & ThreadPartFields;

export type PersonaFields = {
  projectId: Id<"projects">;
  name: string;
  description?: string;
  definition: PersonaDefinition;
  scope?: ResourceSet;
  cast?: Cast;
  tools: ToolId[];
  avatar?: PersonaAvatar;
  createdBy: Actor;
  revision: number;
  updatedAt: number;
};
export type Persona = Row<"personas"> & PersonaFields;

type AgentTaskCommonFields = {
  projectId: Id<"projects">;
  threadId: Id<"threads">;
  title: string;
  instruction: string;
  personaId: Id<"personas">;
  origin: TaskOrigin;
  scope?: ResourceSet;
  tools: ToolId[];
  plan: PlanStep[];
  outputs: TaskOutput[];
  questions: TaskQuestion[];
  createdBy: Actor;
  startedAt: number;
  revision: number;
  updatedAt: number;
};
export type AgentTaskFields = AgentTaskCommonFields & AgentTaskLifecycle;
export type AgentTask = Row<"agentTasks"> & AgentTaskFields;

export type AutomationFields = {
  projectId: Id<"projects">;
  name: string;
  personaId: Id<"personas">;
  instruction: string;
  trigger: AutomationTrigger;
  scope?: ResourceSet;
  tools: ToolId[];
  enabled: boolean;
  firedCount: number;
  lastFiredAt?: number;
  createdBy: Actor;
  revision: number;
  updatedAt: number;
};
export type Automation = Row<"automations"> & AutomationFields;
