# Capability — Icarus Agents Runtime Model

> Mirrored from [Notion](https://app.notion.com/p/3aeb6410e5028184868fdfe3cf4c3e4c).

## Summary / Concept
Agents is the second capability in the **Agentic** build group. It owns durable tasks, runs, the task exchange, tool execution records, checkpoints, and results. An Agent changes another domain only by calling that capability's public command port.
### Prerequisites
- Platform Intelligence and the exact-version Persona snapshot reader.
- Context manifest assembly and Knowledge retrieval.
- Public read and command contracts for every enabled tool target.
- Database, Scheduler, serial and concurrent queues, IDs, clock, digest, logger, and actor attribution.
### Provides downstream
Automation creates or steers tasks through the Agents command port. Activity may record safe committed Agent facts. Selected Comments may enter task Context through the ordinary Context assembly path.
### Ownership and placement
A task pins its objective, origin correlation, actor attribution, Persona snapshot, starting Context manifest, and tool policy. It may have multiple runs, ask explicit questions, accept steering, pause, resume, partially complete, fail, or complete.
```plain text
Automation → Agent task
Agent tool → owning capability public command
Owning capability → its state, revision, ChangeSet, and validation
```
```plain text
apps/backend/src/
  3-capabilities/
    agents/
      domain/
      application/
      tools/
      ports/
      persistence/
      projections/
      index.ts
  4-job-wiring/
    internal/
      InternalJobDispatcher.ts
    agents/
      registerAgentEndpointMappings.ts
      createAgentCommandJobs.ts
      createAgentExecutionJobs.ts
```
## Types & Interfaces
```typescript
export type AgentTaskState =
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "partially_completed"
  | "failed"
  | "canceled";

export interface AgentTask {
  id: string;
  origin: { kind: "operator" | "automation"; id?: string };
  revision: number;
  mode: "plan" | "action";
  state: AgentTaskState;
  objective: string;
  persona: PersonaSnapshot;
  contextManifest: AgentContextManifest;
  toolPolicy: AgentToolPolicy;
  attentionReason?: "question" | "approval" | "conflict";
  createdAt: string;
  updatedAt: string;
}

export interface AgentRun {
  id: string;
  taskId: string;
  attempt: number;
  status: "queued" | "running" | "waiting" | "succeeded" | "failed" | "canceled";
  consumedThroughMessageSeq: number;
  result?: AgentRunResult;
}

export interface AgentToolIntent {
  callId: string;
  taskId: string;
  runId: string;
  target: ProjectTargetRef;
  commandName: string;
  request: unknown;
  requestDigest: string;
}

export interface AgentCommands {
  create(command: CreateAgentTaskCommand): Promise<CreateAgentTaskResult>;
  answer(command: AnswerAgentQuestionCommand): Promise<AgentTask>;
  steer(command: SteerAgentTaskCommand): Promise<AgentTask>;
  pause(command: PauseAgentTaskCommand): Promise<AgentTask>;
  resume(command: ResumeAgentTaskCommand): Promise<AgentTask>;
  cancel(command: CancelAgentTaskCommand): Promise<AgentTask>;
}

export interface AgentReader {
  get(taskId: string): Promise<AgentTask>;
  list(input: AgentTaskListInput): Promise<AgentTaskSummaryPage>;
  listExchange(taskId: string, afterSeq?: number): Promise<AgentMessage[]>;
}
```
Provider-local traces and hidden reasoning remain behind the Intelligence port. Product storage contains the objective, safe progress, explicit questions, operator messages, tool requests/results, and safe settlement summaries.
## Runtime Objects
```typescript
export interface AgentsRuntime {
  commands: AgentCommands;
  reader: AgentReader;
  runner: AgentRunner;
  toolSettlement: AgentToolSettlement;
}

export function createAgentsRuntime(deps: {
  repository: AgentRepository;
  intelligence: IntelligencePort;
  personas: PersonaSnapshotReader;
  contexts: AgentContextAssembler;
  tools: AgentToolRegistry;
  dispatcher: InternalJobDispatcher;
  clock: Clock;
  ids: IdGenerator;
  actor: ActorAttribution;
  logger: Logger;
}): AgentsRuntime {
  const service = new AgentTaskService(deps);
  return {
    commands: service,
    reader: service,
    runner: new AgentRunner(deps),
    toolSettlement: new AgentToolSettlementService(deps)
  };
}
```
- `AgentTaskService` owns task creation and revision-checked control commands.
- `AgentRunner` performs bounded concurrent model/retrieval work and emits typed next-stage intents.
- `AgentContextAssembler` freezes exact Context and Persona inputs.
- `AgentToolRegistry` validates policy and maps model proposals to owning-capability commands.
- `AgentToolSettlementService` records the authoritative target result and schedules continuation.
- `InternalJobDispatcher` is composition-owned and enqueues every post-commit stage as a fresh Job.
## Change Operations
Task-control operations are retained in `agent_task_changesets`:
```typescript
export type AgentTaskChangeOperation =
  | { type: "answer_question"; questionId: string; answer: unknown }
  | { type: "steer"; message: string }
  | { type: "request_approval"; toolCallId: string }
  | { type: "approve"; toolCallId: string }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "cancel" }
  | { type: "settle"; outcome: "completed" | "partially_completed" | "failed" };
```
Run progress is append-only operational history rather than undoable task content:
```typescript
export type AgentRunOperation =
  | { type: "start_run"; runId: string; attempt: number }
  | { type: "append_progress"; safeSummary: string }
  | { type: "ask_question"; question: AgentQuestion }
  | { type: "record_tool_request"; intent: AgentToolIntent }
  | { type: "record_tool_result"; callId: string; result: AgentToolResultRef }
  | { type: "checkpoint"; consumedThroughMessageSeq: number }
  | { type: "settle_run"; result: AgentRunResult };
```
A target effect is recorded twice by design: Agents records its requested tool call and result reference; the target capability records its canonical ChangeSet with Agent attribution.
## Endpoints
- `POST /agents/tasks` — create a task and queue its first run.
- `GET /agents/tasks` — list tasks.
- `GET /agents/tasks/:taskId` — get one task.
- `GET /agents/tasks/:taskId/exchange` — list the durable exchange.
- `POST /agents/tasks/:taskId/answers` — answer an open Agent question.
- `POST /agents/tasks/:taskId/steering` — add steering.
- `POST /agents/tasks/:taskId/pause` — pause after the current safe boundary.
- `POST /agents/tasks/:taskId/resume` — resume and queue a run.
- `POST /agents/tasks/:taskId/cancel` — cancel.
- `GET /agents/activity` — list Agent task activity summaries.
- `GET /agents/attention` — list tasks needing an answer, approval, or conflict resolution.
- Internal stage intents: `agents.runs.execute`, `agents.tools.settle`, `agents.runs.continue`, and `agents.tasks.settle`.
## Jobs
<table fit-page-width="true" header-row="true">
<tr>
<td>Endpoint or intent</td>
<td>Job</td>
<td>Queue</td>
<td>Response</td>
<td>Calls / emits</td>
</tr>
<tr>
<td>Create task</td>
<td>\<code\>CreateAgentTaskJob\</code\></td>
<td>Serial</td>
<td>Inline 201 plus deferred run receipt</td>
<td>Commits task, objective, first run, and execution intent</td>
</tr>
<tr>
<td>Answer, steer, pause, resume, cancel</td>
<td>\<code\>ApplyAgentTaskCommandJob\</code\></td>
<td>Serial</td>
<td>Inline</td>
<td>Emits \<code\>AgentTaskChangeOperation\</code\>; may emit run intent</td>
</tr>
<tr>
<td>Get, list, exchange, activity, attention</td>
<td>\<code\>ReadAgentStateJob\</code\></td>
<td>Concurrent</td>
<td>Inline</td>
<td>Calls read/projection ports</td>
</tr>
<tr>
<td>\<code\>agents.runs.execute\</code\> or continue</td>
<td>\<code\>ExecuteAgentRunJob\</code\></td>
<td>Concurrent</td>
<td>Deferred or internal result</td>
<td>Calls Intelligence/Knowledge; emits tool-command or settlement intent</td>
</tr>
<tr>
<td>Owning-capability tool command</td>
<td>Destination capability Job</td>
<td>Destination classification, normally Serial for mutation</td>
<td>Internal result</td>
<td>Commits destination ChangeSet; emits Agent tool-settlement intent</td>
</tr>
<tr>
<td>\<code\>[agents.tools](http://agents.tools).settle\</code\></td>
<td>\<code\>SettleAgentToolJob\</code\></td>
<td>Serial</td>
<td>Internal result</td>
<td>Records result and emits concurrent continuation intent</td>
</tr>
<tr>
<td>\<code\>agents.tasks.settle\</code\></td>
<td>\<code\>SettleAgentTaskJob\</code\></td>
<td>Serial</td>
<td>Internal result</td>
<td>Settles task; may emit Automation settlement intent</td>
</tr>
</table>
More runnable Agent work than the worker-pool capacity waits in the concurrent FIFO queue. A running Job does not change queues.
## SQL Tables
```sql
PRAGMA foreign_keys = ON;

CREATE TABLE agent_tasks (
  id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  mode TEXT NOT NULL CHECK (mode IN ('plan', 'action')),
  state TEXT NOT NULL CHECK (state IN (
    'queued', 'running', 'waiting', 'completed',
    'partially_completed', 'failed', 'canceled'
  )),
  objective TEXT NOT NULL CHECK (length(trim(objective)) > 0),
  persona_source_kind TEXT NOT NULL CHECK (persona_source_kind IN ('library', 'local')),
  persona_id TEXT NOT NULL,
  persona_version INTEGER NOT NULL CHECK (persona_version >= 1),
  persona_digest TEXT NOT NULL,
  persona_snapshot_json TEXT NOT NULL CHECK (json_valid(persona_snapshot_json)),
  context_manifest_json TEXT NOT NULL CHECK (json_valid(context_manifest_json)),
  tool_policy_json TEXT NOT NULL CHECK (json_valid(tool_policy_json)),
  attention_reason TEXT CHECK (
    attention_reason IS NULL OR
    attention_reason IN ('question', 'approval', 'conflict')
  ),
  origin_kind TEXT NOT NULL CHECK (origin_kind IN ('operator', 'automation')),
  origin_id TEXT,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (origin_kind = 'operator' AND origin_id IS NULL) OR
    (origin_kind = 'automation' AND origin_id IS NOT NULL)
  )
);

CREATE TABLE agent_task_changesets (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  revision_from INTEGER NOT NULL CHECK (revision_from >= 1),
  revision_to INTEGER NOT NULL CHECK (revision_to = revision_from + 1),
  client_request_id TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  operations_json TEXT NOT NULL CHECK (json_valid(operations_json)),
  inverse_operations_json TEXT NOT NULL CHECK (json_valid(inverse_operations_json)),
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('operator', 'agent', 'automation', 'system')),
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (task_id, revision_to),
  UNIQUE (task_id, client_request_id)
);

CREATE TABLE agent_task_creation_receipts (
  client_request_id TEXT PRIMARY KEY,
  request_digest TEXT NOT NULL,
  task_id TEXT NOT NULL UNIQUE REFERENCES agent_tasks(id) ON DELETE CASCADE,
  response_json TEXT NOT NULL CHECK (json_valid(response_json)),
  created_at TEXT NOT NULL
);

CREATE TABLE agent_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL CHECK (attempt >= 1),
  status TEXT NOT NULL CHECK (status IN (
    'queued', 'running', 'waiting', 'succeeded', 'failed', 'canceled'
  )),
  consumed_through_message_seq INTEGER NOT NULL DEFAULT 0 CHECK (consumed_through_message_seq >= 0),
  result_json TEXT CHECK (result_json IS NULL OR json_valid(result_json)),
  failure_code TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  settled_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (task_id, attempt),
  CHECK (
    (status IN ('succeeded', 'failed', 'canceled') AND settled_at IS NOT NULL) OR
    (status NOT IN ('succeeded', 'failed', 'canceled'))
  )
);

CREATE TABLE agent_run_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_seq INTEGER NOT NULL CHECK (step_seq >= 1),
  kind TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('started', 'waiting', 'succeeded', 'failed', 'canceled')),
  safe_summary TEXT,
  input_digest TEXT,
  output_digest TEXT,
  created_at TEXT NOT NULL,
  settled_at TEXT,
  UNIQUE (run_id, step_seq)
);

CREATE TABLE agent_messages (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
  seq INTEGER NOT NULL CHECK (seq >= 1),
  kind TEXT NOT NULL CHECK (kind IN (
    'objective', 'progress', 'question', 'answer', 'steering',
    'approval', 'result', 'system'
  )),
  author_kind TEXT NOT NULL CHECK (author_kind IN ('operator', 'agent', 'automation', 'system')),
  author_id TEXT,
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  created_at TEXT NOT NULL,
  UNIQUE (task_id, seq)
);

CREATE TABLE agent_questions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL UNIQUE REFERENCES agent_messages(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('open', 'answered', 'dismissed')),
  is_required INTEGER NOT NULL CHECK (is_required IN (0, 1)),
  answer_message_id TEXT UNIQUE REFERENCES agent_messages(id) ON DELETE SET NULL,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  CHECK (
    (state = 'open' AND answer_message_id IS NULL AND closed_at IS NULL) OR
    (state = 'answered' AND answer_message_id IS NOT NULL AND closed_at IS NOT NULL) OR
    (state = 'dismissed' AND answer_message_id IS NULL AND closed_at IS NOT NULL)
  )
);

CREATE TABLE agent_tool_calls (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_id TEXT REFERENCES agent_run_steps(id) ON DELETE SET NULL,
  call_seq INTEGER NOT NULL CHECK (call_seq >= 1),
  target_kind TEXT NOT NULL,
  target_id TEXT,
  command_name TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  request_json TEXT NOT NULL CHECK (json_valid(request_json)),
  state TEXT NOT NULL CHECK (state IN ('proposed', 'dispatched', 'succeeded', 'failed', 'rejected')),
  result_ref_json TEXT CHECK (result_ref_json IS NULL OR json_valid(result_ref_json)),
  safe_summary TEXT,
  created_at TEXT NOT NULL,
  settled_at TEXT,
  UNIQUE (run_id, call_seq)
);

CREATE TABLE agent_stage_receipts (
  task_id TEXT NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL,
  run_id TEXT REFERENCES agent_runs(id) ON DELETE CASCADE,
  request_digest TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'running', 'succeeded', 'failed')),
  result_json TEXT CHECK (result_json IS NULL OR json_valid(result_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (task_id, stage_key)
);

CREATE INDEX agent_tasks_state_updated
  ON agent_tasks (state, updated_at DESC);
CREATE INDEX agent_tasks_origin
  ON agent_tasks (origin_kind, origin_id, updated_at DESC);
CREATE INDEX agent_tasks_persona
  ON agent_tasks (persona_source_kind, persona_id, persona_version, updated_at DESC);
CREATE INDEX agent_task_changesets_tail
  ON agent_task_changesets (task_id, revision_to DESC);
CREATE INDEX agent_task_creation_receipts_task
  ON agent_task_creation_receipts (task_id);
CREATE INDEX agent_runs_status_updated
  ON agent_runs (status, updated_at DESC);
CREATE INDEX agent_run_steps_run_seq
  ON agent_run_steps (run_id, step_seq);
CREATE INDEX agent_messages_task_seq
  ON agent_messages (task_id, seq);
CREATE INDEX agent_questions_open
  ON agent_questions (task_id, opened_at)
  WHERE state = 'open';
CREATE INDEX agent_tool_calls_target
  ON agent_tool_calls (target_kind, target_id, created_at DESC);
CREATE INDEX agent_tool_calls_state
  ON agent_tool_calls (state, created_at);
CREATE INDEX agent_stages_pending
  ON agent_stage_receipts (state, updated_at)
  WHERE state IN ('pending', 'running');
```
Task-control mutations update `agent_tasks` with expected-revision compare-and-swap and append the matching ChangeSet in the same transaction. Creation receipts and aggregate-scoped request IDs provide digest-backed replay. Run, step, tool-call, and stage rows use guarded lifecycle transitions.
## Runtime Laws, Projections & Acceptance
- `agent_activity` derives task rows from tasks, latest run, exact Persona snapshot, and latest safe message.
- `agent_attention_queue` contains tasks with open required questions, approvals, or conflicts.
- `agent_progress_timeline` derives safe progress from run steps and exchange.
- A task never changes its origin correlation, actor attribution, or Persona snapshot.
- Exchange sequence strictly increases, and each run consumes a recorded prefix.
- A required open question accepts one canonical answer.
- Every model proposal becomes authoritative only through a validated owning-capability command.
- Every internal stage is idempotent by task ID, stage key, and digest.
- An Automation-origin result emits a separate Automation settlement intent.
- Job wiring commits each stage before dispatching the continuation.
