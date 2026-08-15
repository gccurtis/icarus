import type {
  ActorId,
  ContentSourceRef,
  Diagnostic,
  Digest,
  EntityId,
  FailureDetail,
  ISODateTime,
  JsonObject,
  PersistedRecord,
  ProjectId,
} from './core.js';
import type { ResolvedContextManifest } from './knowledge.js';
import type {
  PinnedRichBlockRef,
  RichBlockRef,
} from './rich-blocks.js';
import type { ChatMessageContent } from './chat.js';

// Persona is reusable behavior. AgentTask is the executable aggregate.

export interface Persona extends PersistedRecord<'persona'> {
  name: string;
  focus?: RichBlockRef<'text'>;
  background?: RichBlockRef<'text'>;
  approach?: RichBlockRef<'text'>;
  outputPreferences?: RichBlockRef<'text'>;
  verification?: RichBlockRef<'text'>;
  contextId?: EntityId<'context'>;
  lifecycle: 'active' | 'deleted';
  deletedAt?: ISODateTime;
}

export interface PersonaSnapshot {
  personaId?: EntityId<'persona'>;
  personaRevision?: number;
  name: string;
  focus?: PinnedRichBlockRef<'text'>;
  background?: PinnedRichBlockRef<'text'>;
  approach?: PinnedRichBlockRef<'text'>;
  outputPreferences?: PinnedRichBlockRef<'text'>;
  verification?: PinnedRichBlockRef<'text'>;
  digest: Digest;
}

export interface ToolGrant {
  targetKind: string;
  commandPattern: string;
  effect: 'read' | 'write' | 'approve';
  constraints: JsonObject;
}

export interface ToolPolicy {
  grants: ToolGrant[];
  defaultEffect: 'deny' | 'read';
  requireApprovalForWrites: boolean;
  digest: Digest;
}

export type AgentTaskOrigin =
  | { kind: 'operator' }
  | { kind: 'automation'; automationId: EntityId<'automation'> };

export interface AgentTaskPlanItem {
  id: EntityId<'agent_task_plan_item'>;
  parentId?: EntityId<'agent_task_plan_item'>;
  rank: string;
  title: string;
  state: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export interface AgentTask extends PersistedRecord<'agent_task'> {
  mode: 'ask' | 'plan' | 'action';
  state:
    | 'queued'
    | 'running'
    | 'waiting'
    | 'completed'
    | 'partially_completed'
    | 'failed'
    | 'cancelled';
  objective: RichBlockRef<'text'>;
  persona: PersonaSnapshot;
  contextManifest: ResolvedContextManifest[];
  toolPolicy: ToolPolicy;
  plan: AgentTaskPlanItem[];
  resultBlocks: RichBlockRef[];
  resultReferences: ContentSourceRef[];
  attentionReason?: 'question' | 'approval' | 'conflict';
  origin: AgentTaskOrigin;
  actorId: ActorId;
  activeLeafMessageId?: EntityId<'agent_task_message'>;
  completedAt?: ISODateTime;
}

export interface AgentTaskRun {
  id: EntityId<'agent_task_run'>;
  projectId: ProjectId;
  taskId: EntityId<'agent_task'>;
  attempt: number;
  status: 'queued' | 'running' | 'waiting' | 'succeeded' | 'failed' | 'cancelled';
  consumedThroughMessageSequence: number;
  resultBlocks: RichBlockRef[];
  resultReferences: ContentSourceRef[];
  failure?: FailureDetail;
  createdAt: ISODateTime;
  startedAt?: ISODateTime;
  settledAt?: ISODateTime;
  updatedAt: ISODateTime;
}

export interface AgentTaskStep {
  id: EntityId<'agent_task_step'>;
  projectId: ProjectId;
  runId: EntityId<'agent_task_run'>;
  sequence: number;
  kind: string;
  state: 'started' | 'waiting' | 'succeeded' | 'failed' | 'cancelled';
  safeSummary?: string;
  inputDigest?: Digest;
  outputDigest?: Digest;
  checkpoint?: JsonObject;
  createdAt: ISODateTime;
  settledAt?: ISODateTime;
}

export interface AgentTaskMessage {
  id: EntityId<'agent_task_message'>;
  projectId: ProjectId;
  taskId: EntityId<'agent_task'>;
  runId?: EntityId<'agent_task_run'>;
  sequence: number;
  parentMessageId?: EntityId<'agent_task_message'>;
  kind:
    | 'objective'
    | 'progress'
    | 'question'
    | 'answer'
    | 'steering'
    | 'approval'
    | 'result'
    | 'system';
  author:
    | { kind: 'operator'; id: ActorId }
    | { kind: 'agent_task'; id: EntityId<'agent_task'> }
    | { kind: 'automation'; id: EntityId<'automation'> }
    | { kind: 'system' };
  content: ChatMessageContent;
  createdAt: ISODateTime;
}

export type AgentTaskRequestPayload =
  | {
      kind: 'question';
      prompt: RichBlockRef<'text'>;
      answerOptions?: RichBlockRef<'text'>[];
    }
  | {
      kind: 'approval';
      summary: RichBlockRef<'text'>;
      toolCallId?: EntityId<'agent_tool_call'>;
      risk?: 'low' | 'medium' | 'high';
    };

export interface AgentTaskRequest {
  id: EntityId<'agent_task_request'>;
  projectId: ProjectId;
  taskId: EntityId<'agent_task'>;
  runId?: EntityId<'agent_task_run'>;
  messageId?: EntityId<'agent_task_message'>;
  payload: AgentTaskRequestPayload;
  state: 'open' | 'answered' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  required: boolean;
  responseBlocks: RichBlockRef[];
  openedAt: ISODateTime;
  closedAt?: ISODateTime;
}

export interface AgentToolCall {
  id: EntityId<'agent_tool_call'>;
  projectId: ProjectId;
  runId: EntityId<'agent_task_run'>;
  stepId?: EntityId<'agent_task_step'>;
  sequence: number;
  target: { kind: string; id?: string };
  commandName: string;
  requestDigest: Digest;
  request: JsonObject;
  state:
    | 'proposed'
    | 'authorized'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'rejected'
    | 'cancelled'
    | 'expired'
    | 'redacted';
  resultRef?: ContentSourceRef;
  safeSummary?: string;
  createdAt: ISODateTime;
  settledAt?: ISODateTime;
}

// Automation and operational records.

export type AutomationTrigger =
  | { kind: 'schedule'; schedule: string; timeZone: string }
  | { kind: 'change'; targetKind: string; targetId?: string; operation?: string }
  | { kind: 'condition'; expression: string; watchedTargets: ContentSourceRef[] }
  | { kind: 'manual' };

export interface Automation extends PersistedRecord<'automation'> {
  name: string;
  state: 'active' | 'paused' | 'deleted';
  trigger: AutomationTrigger;
  personaId?: EntityId<'persona'>;
  personaRevision?: number;
  personaDigest?: Digest;
  objectiveTemplate: RichBlockRef<'text'>;
  taskMode: 'ask' | 'plan' | 'action';
  reviewPolicy: 'always_review' | 'agent_may_apply';
  nextDueAt?: ISODateTime;
  triggerCursor?: JsonObject;
  actorId: ActorId;
  deletedAt?: ISODateTime;
}

export interface AutomationRun {
  id: EntityId<'automation_run'>;
  projectId: ProjectId;
  automationId: EntityId<'automation'>;
  triggerKey: string;
  triggerDigest: Digest;
  state:
    | 'dispatch_pending'
    | 'agent_running'
    | 'settlement_pending'
    | 'completed'
    | 'failed'
    | 'cancelled';
  agentTaskId?: EntityId<'agent_task'>;
  safeResult?: JsonObject;
  failure?: FailureDetail;
  occurredAt: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  settledAt?: ISODateTime;
}

export interface Job {
  id: EntityId<'job'>;
  projectId: ProjectId;
  jobType: string;
  queueType: 'serial' | 'concurrent';
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  idempotencyKey: string;
  input: JsonObject;
  result?: JsonObject;
  error?: FailureDetail;
  attemptCount: number;
  createdAt: ISODateTime;
  availableAt: ISODateTime;
  startedAt?: ISODateTime;
  finishedAt?: ISODateTime;
  updatedAt: ISODateTime;
}

export interface TranslationRun {
  id: EntityId<'translation_run'>;
  projectId: ProjectId;
  direction: 'import' | 'export';
  subject:
    | { kind: 'project'; id: ProjectId }
    | { kind: 'resource'; id: string; resourceKind: 'document' | 'slides' | 'spreadsheet' | 'board' | 'file' };
  format: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  inputRef?: ContentSourceRef;
  outputRef?: ContentSourceRef;
  diagnostics: Diagnostic[];
  jobId?: EntityId<'job'>;
  idempotencyKey: string;
  createdBy: ActorId;
  createdAt: ISODateTime;
  startedAt?: ISODateTime;
  finishedAt?: ISODateTime;
  updatedAt: ISODateTime;
}
