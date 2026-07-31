# Automation Capability Reference

## Purpose

Automation observes schedules, committed changes, and typed conditions, then creates or steers an Agent task. Agents perform resulting project work through the public commands of Document, Slides, Spreadsheet, Questions, Evidence, Research, Analysis, and other owning capabilities.

## Bottom line

An Automation is a durable project-scoped rule:

```plain text
trigger + watched scope + condition + Agent objective/personality + review policy
```

When the rule fires, Automation records one run and creates or steers one Agent task. Automation is the durable control and observation layer; Agents owns execution.

The product can configure Automations contextually from a Question, hypothesis, Research plan, Source, Evidence set, structured table, Analysis, or native Resource, while Overview presents a project-wide supervision lens.

## Runtime placement

An in-process clock source constructed by `1-init` wakes on a bounded interval and asks Automation for due trigger candidates. Composition passes returned typed intents to `4-job-wiring/internal/InternalJobDispatcher`.

```plain text
apps/backend/src/
  3-capabilities/
    automation/
      domain/
        automation.ts
        trigger.ts
        run.ts
        events.ts
      application/
        automationService.ts
        triggerEvaluator.ts
        dueScanner.ts
        agentDispatchIntent.ts
      ports/
        agentCommandContracts.ts
        watchedObjectReaders.ts
        repository.ts
      persistence/
        migrations.ts
        sqliteAutomationRepository.ts
      projections/
        dueSchedule.ts
        overview.ts
      index.ts
  4-job-wiring/
    internal/
      InternalJobDispatcher.ts
    automation/
      registerAutomationEndpointMappings.ts
      createAutomationCommandJobs.ts
      createAutomationTriggerJobs.ts
```

The timer is a startup component behind a clock and due-scanner contract, allowing the process placement to change while preserving capability contracts.

## Authority and integration boundaries

Automation owns:

- definitions, trigger specifications, watched typed targets, conditions, and lifecycle;
- definition revision and ChangeSets;
- schedule/change cursors and deduplication keys;
- trigger evaluation records;
- Automation runs and their link to Agent task IDs;
- Overview and per-object supervision projections.

Integrated authority:

- Agents owns task execution, tool calls, and model interaction.
- Personalities owns behavior payloads and exact versions.
- Watched capabilities own their content, revisions, and committed change facts.
- Resource, Questions, Evidence, Research, Analysis, and Structured Data own their mutations.
- Platform Intelligence and Research retain reasoning and retrieval behavior.
- Job wiring routes typed committed facts and stage intents.

## Domain model

```typescript
interface Automation {
  id: string;
  userId: string;
  projectId: string;
  revision: number;
  name: string;
  state: "active" | "paused" | "trashed";
  trigger: AutomationTrigger;
  watchedTarget?: TypedTarget;
  condition?: TypedCondition;
  personalityRef: ExactPersonalityRef;
  objectiveTemplate: string;
  taskMode: "plan" | "action";
  reviewPolicy: "always_review" | "agent_may_apply";
  createdAt: string;
  updatedAt: string;
}

type AutomationTrigger =
  | { kind: "schedule"; rrule: string; timeZone: string }
  | { kind: "change"; target: TypedTarget; changeKinds: string[] }
  | { kind: "condition"; target: TypedTarget; predicate: TypedCondition }
  | { kind: "manual" };
```

Conditions use a small allowlisted DSL evaluated against typed read projections.

## Operations and job classification

| Request type or stage | Queue | Response |
|---|---|---|
| `automations.create.v1`, `edit.v1`, `pause.v1`, `resume.v1`, `trash.v1` | Serial | Inline |
| `automations.get.v1`, `list.v1`, `overview.v1` | Concurrent | Inline |
| `automation.schedules.scan` | Concurrent | Internal stage result |
| `automation.trigger.evaluate` | Concurrent | Internal stage result |
| `automation.trigger.claim` | Serial | Internal stage result |
| `agents.tasks.create.v1`, `agents.tasks.steer.v1` | Agent public command | Internal result |
| `automations.run-now.v1` | Serial | Deferred `202`; returns committed Agent-dispatch intent |

The concurrent evaluator maps one trigger occurrence to one deterministic `triggerKey` and serial claim intent. The successful claim commits an Automation run in `dispatch_pending`, records the Agent-dispatch stage receipt, and returns; afterward `InternalJobDispatcher` enqueues a separate serial Agent create/steer command.

Every internal stage is keyed by `(automationRunId, stageKey)` and request digest; replay returns the prior result and a changed digest is `idempotency_mismatch`. Job wiring owns Scheduler invocation and follow-on dispatch.

## Revision, ChangeSet, and event model

Definition mutations use `expectedRevision`, `clientRequestId`, `requestDigest`, forward operations, and inverses. After creation, mutation uniqueness is `(automationId, clientRequestId)`. Schedule recalculation happens after the same commit. Before an Automation ID exists, a creation receipt maps `(userId, projectId, clientRequestId)` and digest to the created ID.

Runs are append-only state machines:

```plain text
triggered → dispatch_pending → agent_running → settlement_pending → completed
                              ↘ failed                 ↘ failed
                              ↘ canceled
```

The claim transaction stops at `dispatch_pending` and returns an Agent-command intent. The dispatcher later enqueues the Agent serial command, and the Agent result returns a typed Automation-settlement intent. `InternalJobDispatcher` then enqueues a separate serial settlement stage. Automation run events record state, Agent task ID, and safe summaries. Agent state remains authoritative for execution detail.

Events include `AutomationChanged`, `AutomationTriggered`, `AutomationAgentDispatched`, and `AutomationRunSettled`.

## Capability-owned tables

```sql
CREATE TABLE automations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  trigger_json TEXT NOT NULL,
  watched_target_json TEXT,
  condition_json TEXT,
  personality_ref_json TEXT NOT NULL,
  objective_template TEXT NOT NULL,
  task_mode TEXT NOT NULL,
  review_policy TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, project_id, id)
);

CREATE TABLE automation_changesets (
  id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  actor_user_id TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  expected_revision INTEGER NOT NULL,
  operations_json TEXT NOT NULL,
  inverse_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (automation_id, seq),
  UNIQUE (automation_id, client_request_id),
  FOREIGN KEY (user_id, project_id, automation_id)
    REFERENCES automations(user_id, project_id, id)
);

CREATE TABLE automation_creation_receipts (
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  automation_id TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, project_id, client_request_id),
  UNIQUE (automation_id),
  FOREIGN KEY (user_id, project_id, automation_id)
    REFERENCES automations(user_id, project_id, id)
);

CREATE TABLE automation_trigger_cursors (
  automation_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  next_due_at TEXT,
  last_observed_revision TEXT,
  last_trigger_key TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id, project_id, automation_id)
    REFERENCES automations(user_id, project_id, id)
);

CREATE TABLE automation_trigger_receipts (
  automation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  trigger_key TEXT NOT NULL,
  trigger_payload_json TEXT NOT NULL,
  trigger_digest TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (automation_id, trigger_key),
  FOREIGN KEY (user_id, project_id, automation_id)
    REFERENCES automations(user_id, project_id, id)
);

CREATE TABLE automation_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  automation_id TEXT NOT NULL,
  trigger_key TEXT NOT NULL,
  state TEXT NOT NULL,
  agent_task_id TEXT,
  safe_result_json TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (automation_id, trigger_key),
  UNIQUE (user_id, project_id, id),
  FOREIGN KEY (user_id, project_id, automation_id)
    REFERENCES automations(user_id, project_id, id)
);

CREATE TABLE automation_run_events (
  run_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  state TEXT NOT NULL,
  detail_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (run_id, seq),
  FOREIGN KEY (user_id, project_id, run_id)
    REFERENCES automation_runs(user_id, project_id, id)
);

CREATE TABLE automation_stage_receipts (
  run_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  stage_key TEXT NOT NULL,
  stage_kind TEXT NOT NULL,
  queue_type TEXT NOT NULL CHECK (queue_type IN ('serial','concurrent')),
  request_digest TEXT NOT NULL,
  state TEXT NOT NULL,
  result_json TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (run_id, stage_key),
  FOREIGN KEY (user_id, project_id, run_id)
    REFERENCES automation_runs(user_id, project_id, id)
);
```

Automations use recoverable lifecycle state and retain run history. `agent_task_id` is a cross-capability typed reference supplied and validated by the separate Agent result stage.

## SQL indexes

```sql
CREATE INDEX automations_project_state_updated
  ON automations(user_id, project_id, state, updated_at DESC, id DESC);
CREATE INDEX automation_changesets_tail
  ON automation_changesets(user_id, project_id, automation_id, seq DESC);
CREATE INDEX automation_creation_receipts_automation
  ON automation_creation_receipts(user_id, project_id, automation_id);
CREATE INDEX automation_due
  ON automation_trigger_cursors(next_due_at, user_id, project_id, automation_id);
CREATE INDEX automation_runs_project_updated
  ON automation_runs(user_id, project_id, updated_at DESC, id DESC);
CREATE INDEX automation_runs_agent
  ON automation_runs(user_id, project_id, agent_task_id);
CREATE INDEX automation_stages_pending
  ON automation_stage_receipts(
    state, queue_type, updated_at, user_id, project_id, run_id
  );
```

## Named rebuildable projections

- `automation_due_schedule`: active schedule definitions expanded to their next due occurrence. Rebuild from definitions plus trigger cursors.
- `automation_overview`: project rows showing state, watched object, next run, current Agent task, last outcome, and attention.
- `automation_by_target`: contextual list grouped by typed watched target.

These rebuildable projections are distinct from SQL indexes. Trigger receipts and run records remain canonical.

## Dependencies and ports

Required:

- Agent `CreateAgentTask` / `SteerAgentTask` command and result contracts; wiring owns invocation.
- exact Personality reference validation.
- typed watched-object readers that expose current revision and a bounded condition projection.
- committed change facts or version cursors from watched capabilities.
- Database, clock, IDs, logger.

Provided:

- Automation definition commands/readers;
- due-candidate scanner;
- change/condition evaluation;
- Overview and typed-target projections.

Automation consumes safe committed change facts and typed read projections from watched capabilities.

## Intelligence and web use

If a scheduled rule requires research or reasoning, Automation creates an Agent whose tools may start Research and use Platform Intelligence.

## Principal flow

```mermaid
sequenceDiagram
  participant S as "Due scanner"
  participant A as "Automation"
  participant I as "InternalJobDispatcher"
  participant G as "Agents"
  participant D as "Document"
  S->>A: Evaluate due occurrence
  A->>A: Serial claim; persist dispatch_pending
  A-->>I: Committed Agent-command intent
  I->>G: Separate serial create-task command
  G-->>I: Agent task ID plus dispatch-recording intent
  I->>A: Separate serial record-dispatch stage
  G-->>I: Later, committed Document-command intent
  I->>D: Public Document command
  D-->>I: Canonical ChangeSet and Agent-settlement intent
  I->>G: Record tool result and continue
  G-->>I: Task result plus Automation-settlement intent
  I->>A: Separate serial settlement stage
  A->>A: Settle Automation run idempotently
```

## Invariants

- One trigger occurrence creates at most one Automation run.
- One run links to at most one primary Agent task.
- Automation reaches watched or target mutations through Agent tasks and owning-capability commands.
- Conditions are deterministic and typed.
- Trigger claims require an active Automation.
- Editing a definition preserves past runs.
- Agent task state remains authoritative for execution detail.
- Schedule timezone and occurrence key are explicit.
- Definition commands enforce aggregate-scoped request IDs and digest mismatch semantics.
- Trigger claim persists `dispatch_pending` before Agent work is enqueued.
- Agent completion schedules Automation settlement through job wiring.
- Job wiring owns Scheduler invocation and each stage commits before follow-on dispatch.

## Conformance scenarios

1. Trigger runs manually and from interval or daily schedules.
2. Claim a change trigger from a Source or Question revision cursor.
3. Dispatch one Agent task and project the linked run in Overview.
4. Pause, resume, edit, run immediately, and list recent runs.
5. Recover idempotently from `dispatch_pending` after process restart.

## Acceptance criteria

- [ ] Duplicate scanner passes return the existing run for an occurrence.
- [ ] A successful claim persists `dispatch_pending` and returns before any Agent command is enqueued.
- [ ] Automation changes use revision CAS and replayable ChangeSets.
- [ ] A triggered run creates or steers an Agent through the Agent command port.
- [ ] Automation integrates with watched and target capabilities through typed facts, reads, and Agent commands.
- [ ] An Agent-created Resource edit is recorded by the Resource capability.
- [ ] Agent completion reaches Automation only through a separate idempotent settlement Job.
- [ ] Due and Overview projections rebuild from canonical definitions/runs.
- [ ] Pausing prevents new trigger claims while preserving already running Agent work.
- [ ] Platform Intelligence and Research remain behind Agent tools.

## References

- [Product — Icarus Complete Product Definition](https://app.notion.com/p/3aeb6410e502810ba9c0c26442d5255a)
- [Model — Icarus Request, Job & Dual-Queue Runtime](https://app.notion.com/p/3adb6410e50281c498f4d7f6a621eba2)
- [Implementation — User Agents & Personality Library](https://app.notion.com/p/3acb6410e50281229fe9eec53047607c)
- [Operation Legion — Agents, Personas, Memory, and Automation](https://app.notion.com/p/394b6410e502814994ceece646403c79)
