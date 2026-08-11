# Capability — Icarus Automation Runtime Model

> Mirrored from [Notion](https://app.notion.com/p/3aeb6410e5028118b270f7b8f353c053).

## Summary / Concept
Automation is the third capability in the **Agentic** build group. It observes schedules, committed changes, and typed conditions, then creates or steers an Agent task. Automation owns durable rules and trigger settlement; Agents owns the resulting work.
### Prerequisites
- Scheduler and durable serial/concurrent Job execution.
- Agents task creation, steering, and settlement contracts.
- Exact-version Persona validation.
- Project target-address plus typed read and committed-change ports for every watched target family.
- Database, IDs, clock, digest, logger, and actor attribution.
### Provides downstream
Project Overview may present Automation supervision. Activity may project committed Automation facts. Resource, Research, Analysis, Evidence, Question, and Data mutations remain behind Agent tool commands to their owning capabilities.
### Ownership and placement
```plain text
trigger + watched target + condition + Agent objective/Persona + review policy
```
One trigger occurrence creates at most one Automation run and links it to at most one primary Agent task.
```plain text
apps/backend/src/
  3-capabilities/
    automation/
      domain/
      application/
      ports/
      persistence/
      projections/
      index.ts
  4-job-wiring/
    internal/
      InternalJobDispatcher.ts
    automation/
      registerAutomationEndpointMappings.ts
      createAutomationCommandJobs.ts
      createAutomationTriggerJobs.ts
```
An in-process clock source constructed by `1-init` wakes on a bounded interval. It asks Automation for due candidates and passes typed intents to job wiring.
## Types & Interfaces
```typescript
export interface Automation {
  id: string;
  revision: number;
  name: string;
  state: "active" | "paused" | "trashed";
  trigger: AutomationTrigger;
  watchedTarget?: ProjectTargetRef;
  condition?: TypedCondition;
  personaRef: ExactPersonaRef;
  objectiveTemplate: string;
  taskMode: "plan" | "action";
  reviewPolicy: "always_review" | "agent_may_apply";
  createdAt: string;
  updatedAt: string;
}

export type AutomationTrigger =
  | { kind: "schedule"; rrule: string; timeZone: string }
  | { kind: "change"; target: ProjectTargetRef; changeKinds: string[] }
  | { kind: "condition"; target: ProjectTargetRef; predicate: TypedCondition }
  | { kind: "manual" };

export interface AutomationRun {
  id: string;
  automationId: string;
  triggerKey: string;
  state:
    | "dispatch_pending"
    | "agent_running"
    | "settlement_pending"
    | "completed"
    | "failed"
    | "canceled";
  agentTaskId?: string;
  safeResult?: unknown;
}

export interface AutomationCommands {
  create(command: CreateAutomationCommand): Promise<Automation>;
  apply(command: ApplyAutomationChangesCommand): Promise<Automation>;
  runNow(command: RunAutomationNowCommand): Promise<AutomationRunReceipt>;
}

export interface AutomationReader {
  get(automationId: string): Promise<Automation>;
  list(input: AutomationListInput): Promise<AutomationSummaryPage>;
  listRuns(automationId: string): Promise<AutomationRunSummary[]>;
}
```
Conditions use a small allowlisted deterministic DSL evaluated against typed read projections.
## Runtime Objects
```typescript
export interface AutomationRuntime {
  commands: AutomationCommands;
  reader: AutomationReader;
  scanner: AutomationDueScanner;
  evaluator: AutomationTriggerEvaluator;
  settlement: AutomationSettlement;
}

export function createAutomationRuntime(deps: {
  repository: AutomationRepository;
  agents: AgentCommandPort;
  personas: ExactPersonaReader;
  watchedTargets: WatchedTargetRegistry;
  clock: Clock;
  ids: IdGenerator;
  actor: ActorAttribution;
  logger: Logger;
}): AutomationRuntime {
  const service = new AutomationService(deps);
  return {
    commands: service,
    reader: service,
    scanner: new AutomationDueScanner(deps),
    evaluator: new AutomationTriggerEvaluator(deps),
    settlement: new AutomationSettlementService(deps)
  };
}
```
- `AutomationService` owns definition commands and manual triggering.
- `AutomationDueScanner` returns bounded due candidates; it does not claim them.
- `AutomationTriggerEvaluator` computes a deterministic occurrence key and serial claim intent.
- `AutomationSettlementService` records Agent dispatch and terminal outcomes through idempotent stages.
- Job wiring owns timer invocation and every follow-on enqueue.
## Change Operations
```typescript
export type AutomationChangeOperation =
  | { type: "rename"; name: string }
  | { type: "set_trigger"; trigger: AutomationTrigger }
  | { type: "set_watched_target"; target?: ProjectTargetRef }
  | { type: "set_condition"; condition?: TypedCondition }
  | { type: "set_persona"; persona: ExactPersonaRef }
  | { type: "set_objective_template"; template: string }
  | { type: "set_task_mode"; mode: "plan" | "action" }
  | { type: "set_review_policy"; policy: "always_review" | "agent_may_apply" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "trash" };
```
Definition mutations use expected revision, request ID, request digest, forward operations, and inverses. Runs are append-only state machines:
```plain text
dispatch_pending → agent_running → settlement_pending → completed
                 ↘ failed                 ↘ failed
                 ↘ canceled
```
## Endpoints
- `POST /automations` — create a durable rule.
- `GET /automations` — list definitions and supervision summaries.
- `GET /automations/:automationId` — get one definition.
- `PATCH /automations/:automationId` — apply revision-checked definition operations.
- `POST /automations/:automationId/pause` — pause future claims.
- `POST /automations/:automationId/resume` — resume future claims.
- `DELETE /automations/:automationId` — trash.
- `POST /automations/:automationId/runs` — trigger manually.
- `GET /automations/:automationId/runs` — list runs.
- Internal stage intents: `automation.schedules.scan`, `automation.trigger.evaluate`, `automation.trigger.claim`, `automation.agent.record-dispatch`, and `automation.runs.settle`.
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
<td>Create, edit, pause, resume, trash</td>
<td>\<code\>ApplyAutomationCommandJob\</code\></td>
<td>Serial</td>
<td>Inline</td>
<td>Emits Automation Change Operations</td>
</tr>
<tr>
<td>Get, list, runs, overview</td>
<td>\<code\>ReadAutomationJob\</code\></td>
<td>Concurrent</td>
<td>Inline</td>
<td>Calls read/projection ports</td>
</tr>
<tr>
<td>Schedule scan</td>
<td>\<code\>ScanDueAutomationsJob\</code\></td>
<td>Concurrent</td>
<td>Internal stage result</td>
<td>Emits bounded trigger-evaluation intents</td>
</tr>
<tr>
<td>Trigger evaluation</td>
<td>\<code\>EvaluateAutomationTriggerJob\</code\></td>
<td>Concurrent</td>
<td>Internal stage result</td>
<td>Reads target projection; emits serial claim intent</td>
</tr>
<tr>
<td>Trigger claim or run-now</td>
<td>\<code\>ClaimAutomationRunJob\</code\></td>
<td>Serial</td>
<td>Deferred receipt</td>
<td>Commits \<code\>dispatch_pending\</code\>; emits Agent command intent</td>
</tr>
<tr>
<td>Agent create or steer</td>
<td>Agents capability Job</td>
<td>Serial</td>
<td>Internal result</td>
<td>Creates/steers task; emits dispatch-recording intent</td>
</tr>
<tr>
<td>Record dispatch</td>
<td>\<code\>RecordAutomationDispatchJob\</code\></td>
<td>Serial</td>
<td>Internal result</td>
<td>Links Agent task and advances run</td>
</tr>
<tr>
<td>Settle run</td>
<td>\<code\>SettleAutomationRunJob\</code\></td>
<td>Serial</td>
<td>Internal result</td>
<td>Records terminal safe outcome</td>
</tr>
</table>
Every stage is keyed by Automation run ID, stage key, and request digest. A stage commits before job wiring dispatches the next stage.
## SQL Tables
```sql
PRAGMA foreign_keys = ON;

CREATE TABLE automations (
  id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  state TEXT NOT NULL CHECK (state IN ('active', 'paused', 'trashed')),
  trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('schedule', 'change', 'condition', 'manual')),
  trigger_json TEXT NOT NULL CHECK (json_valid(trigger_json)),
  watched_target_kind TEXT,
  watched_target_id TEXT,
  watched_target_subpath_json TEXT CHECK (
    watched_target_subpath_json IS NULL OR json_valid(watched_target_subpath_json)
  ),
  condition_json TEXT CHECK (condition_json IS NULL OR json_valid(condition_json)),
  persona_source_kind TEXT NOT NULL CHECK (persona_source_kind IN ('library', 'local')),
  persona_id TEXT NOT NULL,
  persona_version INTEGER NOT NULL CHECK (persona_version >= 1),
  persona_digest TEXT NOT NULL,
  objective_template TEXT NOT NULL CHECK (length(trim(objective_template)) > 0),
  task_mode TEXT NOT NULL CHECK (task_mode IN ('plan', 'action')),
  review_policy TEXT NOT NULL CHECK (review_policy IN ('always_review', 'agent_may_apply')),
  next_due_at TEXT,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (trigger_kind = 'manual' AND watched_target_kind IS NULL AND watched_target_id IS NULL) OR
    (trigger_kind != 'manual')
  ),
  CHECK (
    (watched_target_kind IS NULL AND watched_target_id IS NULL) OR
    (watched_target_kind IS NOT NULL AND watched_target_id IS NOT NULL)
  ),
  CHECK (
    (trigger_kind = 'condition' AND condition_json IS NOT NULL) OR
    (trigger_kind != 'condition')
  )
);

CREATE TABLE automation_changesets (
  id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  revision_from INTEGER NOT NULL CHECK (revision_from >= 1),
  revision_to INTEGER NOT NULL CHECK (revision_to = revision_from + 1),
  client_request_id TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  operations_json TEXT NOT NULL CHECK (json_valid(operations_json)),
  inverse_operations_json TEXT NOT NULL CHECK (json_valid(inverse_operations_json)),
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (automation_id, revision_to),
  UNIQUE (automation_id, client_request_id)
);

CREATE TABLE automation_creation_receipts (
  client_request_id TEXT PRIMARY KEY,
  request_digest TEXT NOT NULL,
  automation_id TEXT NOT NULL UNIQUE REFERENCES automations(id) ON DELETE CASCADE,
  response_json TEXT NOT NULL CHECK (json_valid(response_json)),
  created_at TEXT NOT NULL
);

CREATE TABLE automation_trigger_cursors (
  automation_id TEXT PRIMARY KEY REFERENCES automations(id) ON DELETE CASCADE,
  cursor_kind TEXT NOT NULL CHECK (cursor_kind IN ('schedule', 'change', 'condition')),
  cursor_json TEXT NOT NULL CHECK (json_valid(cursor_json)),
  updated_at TEXT NOT NULL
);

CREATE TABLE automation_trigger_receipts (
  automation_id TEXT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  trigger_key TEXT NOT NULL,
  trigger_digest TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  PRIMARY KEY (automation_id, trigger_key)
);

CREATE TABLE automation_runs (
  id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL,
  trigger_key TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN (
    'dispatch_pending', 'agent_running', 'settlement_pending',
    'completed', 'failed', 'canceled'
  )),
  agent_task_id TEXT,
  safe_result_json TEXT CHECK (safe_result_json IS NULL OR json_valid(safe_result_json)),
  failure_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  settled_at TEXT,
  UNIQUE (automation_id, trigger_key),
  FOREIGN KEY (automation_id, trigger_key)
    REFERENCES automation_trigger_receipts(automation_id, trigger_key)
    ON DELETE CASCADE,
  CHECK (
    (state IN ('completed', 'failed', 'canceled') AND settled_at IS NOT NULL) OR
    (state NOT IN ('completed', 'failed', 'canceled'))
  )
);

CREATE TABLE automation_run_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES automation_runs(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL CHECK (seq >= 1),
  kind TEXT NOT NULL,
  safe_payload_json TEXT NOT NULL CHECK (json_valid(safe_payload_json)),
  created_at TEXT NOT NULL,
  UNIQUE (run_id, seq)
);

CREATE TABLE automation_stage_receipts (
  run_id TEXT NOT NULL REFERENCES automation_runs(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'running', 'succeeded', 'failed')),
  result_json TEXT CHECK (result_json IS NULL OR json_valid(result_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (run_id, stage_key)
);

CREATE INDEX automations_state_updated
  ON automations (state, updated_at DESC);
CREATE INDEX automations_persona
  ON automations (persona_source_kind, persona_id, persona_version, updated_at DESC);
CREATE INDEX automation_changesets_tail
  ON automation_changesets (automation_id, revision_to DESC);
CREATE INDEX automation_creation_receipts_automation
  ON automation_creation_receipts (automation_id);
CREATE INDEX automation_due
  ON automations (next_due_at, id)
  WHERE state = 'active' AND trigger_kind = 'schedule' AND next_due_at IS NOT NULL;
CREATE INDEX automation_trigger_receipts_time
  ON automation_trigger_receipts (occurred_at DESC);
CREATE INDEX automation_runs_updated
  ON automation_runs (state, updated_at DESC);
CREATE INDEX automation_runs_agent
  ON automation_runs (agent_task_id)
  WHERE agent_task_id IS NOT NULL;
CREATE INDEX automation_run_events_tail
  ON automation_run_events (run_id, seq DESC);
CREATE INDEX automation_stages_pending
  ON automation_stage_receipts (state, updated_at)
  WHERE state IN ('pending', 'running');
```
Definition mutation performs one-row revision compare-and-swap and appends its ChangeSet in the same transaction. The trigger receipt primary key guarantees one claim per occurrence. Run transitions are conditional on current state and protected by digest-backed stage receipts.
## Runtime Laws, Projections & Acceptance
- `automation_due_schedule` derives the next due occurrence from active definitions and trigger cursors.
- `automation_overview` shows state, watched target, next run, current Agent task, last outcome, and attention.
- `automation_by_target` groups rules by watched Project target.
- Trigger claims require an active Automation.
- Editing a definition preserves past runs.
- Schedule timezone and occurrence key are explicit.
- Automation reaches mutations only through Agents and owning-capability commands.
- Agent task state remains authoritative for execution detail.
- Pausing prevents new claims without canceling already-running Agent work.
- Duplicate scanner passes return the existing run for an occurrence.
