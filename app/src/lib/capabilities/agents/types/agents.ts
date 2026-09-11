import type {
  AgentTaskState,
  PlanStep,
  TaskOrigin,
  TaskOutput,
  TaskQuestion
} from "$representation/data/types/agents/agent-task";
import type { AutomationTrigger } from "$representation/data/types/agents/automation";
import type { Cast, PersonaAvatar, PersonaDefinition } from "$representation/data/types/agents/persona";
import type { Tool, ToolId } from "$representation/data/types/agents/tool";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type {
  ActivityEvent,
  ActivityTarget
} from "$representation/data/types/collaboration/activity";

export type PersonaCounts = {
  readonly tasks: number;
  readonly running: number;
  readonly review: number;
  readonly finished: number;
  readonly automations: number;
  readonly chats: number;
};

export type PersonaItem = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly scope: ResourceSet | null;
  readonly tools: readonly ToolId[];
  readonly createdByName: string;
  readonly revision: number;
  readonly updatedAt: number;
  readonly counts: PersonaCounts;
};

export type PersonaDetail = PersonaItem & {
  readonly definition: PersonaDefinition;
  readonly cast: Cast | null;
  readonly avatar: PersonaAvatar | null;
};

export type TaskProgress = {
  readonly done: number;
  readonly total: number;
  readonly percent: number | null;
  readonly current: string | null;
};

export type TaskItem = {
  readonly id: string;
  readonly title: string;
  readonly personaId: string;
  readonly personaName: string;
  readonly state: AgentTaskState;
  readonly origin: TaskOrigin;
  readonly automationName: string | null;
  readonly startedAt: number;
  readonly finishedAt: number | null;
  readonly startedByName: string;
  readonly progress: TaskProgress;
  readonly openQuestions: number;
  readonly outputCount: number;
  readonly scope: ResourceSet | null;
  readonly tools: readonly ToolId[];
  readonly revision: number;
  readonly updatedAt: number;
};

export type TaskTurn = {
  readonly id: string;
  readonly from: "person" | "agent" | "system";
  readonly authorName: string;
  readonly text: string;
  readonly at: number;
};

export type TaskOutputItem = TaskOutput & { readonly refName: string | null };

export type TaskQuestionItem = TaskQuestion & { readonly answeredByName: string | null };

export type TaskDetail = TaskItem & {
  readonly instruction: string;
  readonly plan: readonly PlanStep[];
  readonly outputs: readonly TaskOutputItem[];
  readonly questions: readonly TaskQuestionItem[];
  readonly turns: readonly TaskTurn[];
  readonly reviewedByName: string | null;
};

export type AutomationItem = {
  readonly id: string;
  readonly name: string;
  readonly personaId: string;
  readonly personaName: string;
  readonly trigger: AutomationTrigger;
  readonly triggerRefName: string | null;
  readonly enabled: boolean;
  readonly firedCount: number;
  readonly lastFiredAt: number | null;
  readonly running: number;
  readonly scope: ResourceSet | null;
  readonly tools: readonly ToolId[];
  readonly createdByName: string;
  readonly revision: number;
  readonly updatedAt: number;
};

export type AutomationDetail = AutomationItem & {
  readonly instruction: string;
  readonly fired: readonly TaskItem[];
};

export type ChatItem = {
  readonly id: string;
  readonly title: string;
  readonly personaId: string;
  readonly personaName: string;
  readonly createdByName: string;
  readonly messageCount: number;
  readonly lastLine: string | null;
  readonly updatedAt: number;
};

export type ResourceOption = {
  readonly ref: ResourceRef;
  readonly name: string;
  /** Exact External location; null for resources that do not live in External. */
  readonly relativePath: string | null;
};

export type ResourceSetOption = {
  readonly id: string;
  readonly name: string;
};

export type ActivityItem = {
  readonly id: string;
  readonly actorName: string;
  readonly personaId: string;
  readonly personaName: string;
  readonly type: ActivityEvent["kind"];
  readonly what: string;
  readonly action: string;
  readonly target: ActivityTarget;
  readonly context?: ActivityTarget;
  readonly detail?: string;
  readonly at: number;
};

export type ReadAgentsLibraryResult = {
  readonly personas: readonly PersonaItem[];
  readonly tasks: readonly TaskItem[];
  readonly automations: readonly AutomationItem[];
  readonly chats: readonly ChatItem[];
  readonly activity: readonly ActivityItem[];
  readonly tools: readonly Tool[];
  readonly resources: readonly ResourceOption[];
  readonly resourceSets: readonly ResourceSetOption[];
};

export type ReadPersonaInput = { readonly personaId: string };
export type ReadPersonaResult = PersonaDetail | null;

export type ReadTaskInput = { readonly taskId: string };
export type ReadTaskResult = TaskDetail | null;

export type ReadAutomationInput = { readonly automationId: string };
export type ReadAutomationResult = AutomationDetail | null;

export type RefusalReason = "not-found" | "stale" | "in-use" | "invalid-state";

export type Accepted = { readonly accepted: true; readonly id: string; readonly revision: number };

export type Refused = {
  readonly accepted: false;
  readonly id: string;
  readonly reason: RefusalReason;
  readonly revision: number | null;
  readonly detail: string;
};

export type WriteResult = Accepted | Refused;

export type CreatePersonaInput = {
  readonly name: string;
  readonly description?: string;
};

export type PersonaSectionName = keyof PersonaDefinition;

export type UpdatePersonaPatch = {
  readonly name?: string;
  readonly description?: string | null;
  readonly section?: { readonly name: PersonaSectionName; readonly text: string };
  readonly scope?: ResourceSet | null;
  readonly cast?: Cast | null;
  readonly tools?: readonly ToolId[];
};

export type UpdatePersonaInput = {
  readonly personaId: string;
  readonly baseRevision: number;
  readonly patch: UpdatePersonaPatch;
};

export type DuplicatePersonaInput = { readonly personaId: string };

export type RemovePersonaInput = { readonly personaId: string; readonly baseRevision: number };

export type CreateTaskInput = {
  readonly personaId: string;
  readonly title: string;
  readonly instruction: string;
  readonly scope?: ResourceSet;
  readonly tools?: readonly ToolId[];
};

export type UpdateTaskPatch = {
  readonly title?: string;
  readonly instruction?: string;
  readonly scope?: ResourceSet | null;
  readonly tools?: readonly ToolId[];
  readonly state?: "finished";
};

export type UpdateTaskInput = {
  readonly taskId: string;
  readonly baseRevision: number;
  readonly patch: UpdateTaskPatch;
};

export type SendTaskMessageInput = { readonly taskId: string; readonly text: string };

export type AnswerTaskQuestionInput = {
  readonly taskId: string;
  readonly questionId: string;
  readonly answer?: string;
  readonly reject?: boolean;
};

export type CreateAutomationInput = {
  readonly personaId: string;
  readonly name: string;
  readonly instruction?: string;
  readonly trigger?: AutomationTrigger;
  readonly scope?: ResourceSet;
  readonly tools?: readonly ToolId[];
};

export type UpdateAutomationPatch = {
  readonly name?: string;
  readonly instruction?: string;
  readonly personaId?: string;
  readonly trigger?: AutomationTrigger;
  readonly scope?: ResourceSet | null;
  readonly tools?: readonly ToolId[];
  readonly enabled?: boolean;
};

export type UpdateAutomationInput = {
  readonly automationId: string;
  readonly baseRevision: number;
  readonly patch: UpdateAutomationPatch;
};

export type RemoveAutomationInput = {
  readonly automationId: string;
  readonly baseRevision: number;
};

export type RunAutomationInput = { readonly automationId: string };

export type RunAutomationResult =
  | { readonly accepted: true; readonly id: string; readonly taskId: string; readonly revision: number }
  | Refused;

export type CreateChatInput = { readonly personaId: string; readonly title?: string };

export type CreateChatResult =
  | { readonly accepted: true; readonly id: string; readonly chatId: string; readonly revision: 1 }
  | Refused;
