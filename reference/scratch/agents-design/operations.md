# Agents — operations

Commands, queries, endpoints, jobs, and queue placement.

## Two endpoints

```text
POST /agents/command    serial      all mutations
POST /agents/query      concurrent  all reads
```

Discriminated-union bodies, no path parameters. This is the preferred house
shape: Document, Activity, Comments, Templates, and Persona all use a
command/query pair, and Persona — the most recently built capability — is the
closest model for a new one. The backend has no path parameters anywhere:
`getEndpointKey` is exact string equality on `` `${method} ${path}` ``, so
`POST /agents/tasks/:taskId/answers` from the older model is not expressible.

The fine-grained REST-ish style in Context and Structured Data is the earlier
one, but chronology alone does not settle it — Investigation was built after
both and registers 22 fine-grained routes. The reason to choose command/query
here is that Agents has one aggregate with a state machine, so one discriminated
command union keeps queue placement and the error ladder in one place instead of
eleven.

Every mutation is serial because task control reads-then-writes across several
store calls, which is the same reason Document and Persona commands are serial.

## Commands

```ts
type AgentCommand =
  | { type: "task.create";  requestId: string; input: CreateTaskInput }
  | { type: "task.steer";   taskId: string; expectedRevision: number; message: string }
  | { type: "task.answer";  taskId: string; expectedRevision: number;
                            questionId: string; answer: string }
  | { type: "task.approve"; taskId: string; expectedRevision: number;
                            toolCallId: string; requestDigest: string;
                            decision: "grant" | "deny"; note?: string }
  | { type: "task.cancel";  taskId: string; expectedRevision: number; reason?: string };

interface CreateTaskInput {
  readonly objective: string;
  readonly personaId?: string;                  // absent → builtin:default
  readonly personaSections?: readonly PersonaSectionName[];
  /**
   * At most one entry. Absent means the whole project.
   * A caller wanting "everything except X" composes that Context first —
   * a list of entries can only ever union. See canonical-model.md.
   */
  readonly contextEntry?: ContextEntry;
  readonly policy: AgentToolPolicy;
  readonly origin?: AgentOrigin;                // absent → { kind: "user" }
  /** A named preset from config. Absent → agents.defaultLimits. */
  readonly limitsPreset?: string;
  /** Applied on top of the preset. */
  readonly limits?: Partial<AgentLimits>;
}
```

### Limits come from named configuration sets

Defaults live in an `agents:` section of `apps/backend/etc/configuration.yaml`
as **named presets**, not a single flat block:

```yaml
agents:
  defaultLimits: standard
  limits:
    quick:    { maxGoalDepth: 3, maxUnitsPerRun: 60,   maxMutationsPerTask: 20,  … }
    standard: { maxGoalDepth: 6, maxUnitsPerRun: 500,  maxMutationsPerTask: 200, … }
    thorough: { maxGoalDepth: 8, maxUnitsPerRun: 2000, maxMutationsPerTask: 800, … }
```

Resolution happens at creation — preset, then per-task overrides — and the
resolved set is frozen onto the task, so editing a preset never changes a task
already in flight. An unknown preset name is a 400 raised before any row exists.

**Presets exist because these numbers move together.** "Be thorough" is not one
knob; it is a deeper tree, more units, more mutations, and more read rounds at
once, and asking a caller to keep seventeen numbers mutually consistent is
asking for incoherent configurations.

Limits belong in `configuration.yaml` rather than `domain/validation.ts` because
they are operational cost controls. Persona and Comments keep their limits in
the domain because theirs are content-shape rules (`maxSectionChars`); that
precedent does not transfer.

Notes on the shape:

- **`expectedRevision` on every control command.** Compare-and-swap against the
  task revision, so a stale client cannot answer a question that a concurrent
  command already changed the meaning of.
- **`requestDigest` is required on approve.** The client echoes the digest it
  was shown. If it does not match the call's current digest, the approval is
  rejected — digest binding enforced at the wire, not just internally. It also
  makes a stale approval UI impossible to act on.
- **`requestId` on create only.** Creation is the one command whose replay must
  return the original response rather than an error, so it gets a receipt row
  keyed on the request id alone — the same shape as Document's
  `create_receipts`, because there is no task id at retry time. The other
  commands are naturally idempotent under CAS: a replay finds the revision
  already moved and fails cleanly.
- **No `task.resume`.** Answering, approving, or steering a `waiting` task
  resumes the run in the same transaction. A separate resume command would let a
  task be resumed while still blocked.
- **No `task.pause`.** A pause that must survive a restart is a state, and the
  states that exist already cover the real cases: `waiting` for blocked, cancel
  for stop.

### Command effects

Every one of these lands as an exchange message and is picked up by the
**boundary check** that runs after each work unit — there is no interrupt path.
See [execution.md](execution.md).

| Command | Task state | Exchange | Effect at the next boundary |
| --- | --- | --- | --- |
| `task.create` | → `queued` | objective (seq 1) | run starts, scope pins, first `decompose` unit |
| `task.steer` | unchanged, or `waiting` → `running` | steering | supersede queued `act` units, dispatch a `sequence` unit (trigger `steering`) |
| `task.answer` | `waiting` → `running` when the last required question closes | answer | dispatch a `sequence` unit for the active goal |
| `task.approve` grant | `waiting` → `running` | approval | dispatch the waiting `act` unit |
| `task.approve` deny | `waiting` → `running` | approval | settle that unit `rejected`, supersede the rest of the sequence, dispatch a `sequence` unit (trigger `refusal`) |
| `task.cancel` | → `cancelled` | result | settle the run `cancelled` |

Steering a `running` task appends the message and enqueues nothing directly; the
in-flight work unit finishes, and its boundary check sees the new message.
**Latency is one work unit, not one run.** Steering a *terminal* task is
rejected with `task_settled`.

A denial re-sequences rather than continuing blindly with the remaining queued
actions — a refused mutation usually invalidates the premise of the ones behind
it.

## Queries

```ts
type AgentQuery =
  | { type: "task.get";       taskId: string }
  | { type: "task.list";      filter?: AgentTaskFilter; limit?: number; cursor?: string }
  | { type: "task.exchange";  taskId: string; afterSeq?: number; limit?: number }
  | { type: "task.goals";     taskId: string }
  | { type: "task.runs";      taskId: string }
  | { type: "run.units";      runId: string }
  | { type: "task.attention" }
  | { type: "task.toolCalls"; taskId: string };

interface AgentTaskFilter {
  readonly state?: readonly AgentTaskState[];
  readonly origin?: "user" | "automation";
  readonly automationId?: string;
  readonly personaId?: string;
}
```

`task.exchange` with `afterSeq` is the polling primitive a UI uses to follow a
live task — the same shape Activity uses for its feed. `task.attention` returns
every task waiting on a person, which is the queue a person actually works from.

`task.goals` returns the decomposition tree with each goal's state and
expectation. This is what makes a task legible *before* it acts: a person can
see what the agent intends to do and steer it, rather than only reacting to what
it has already done.

`run.units` and `task.toolCalls` are the audit views. Neither exposes the run
transcript; that is model-facing state and has no read path by design.

## Jobs

| Endpoint or intent | Job name | Queue | Response |
| --- | --- | --- | --- |
| `POST /agents/command` | `agents.command.v1` | serial | inline |
| `POST /agents/query` | `agents.query.v1` | concurrent | inline |
| `agents.run.start` | `agents.run.start` | concurrent | internal |
| `agents.work.decompose` | `agents.work.decompose` | concurrent | internal |
| `agents.work.sequence` | `agents.work.sequence` | concurrent | internal |
| `agents.work.act` | `agents.work.act` | concurrent | internal |
| `agents.work.verify` | `agents.work.verify` | concurrent | internal |
| `agents.run.settle` | `agents.run.settle` | serial | internal |
| `agents.task.settle` | `agents.task.settle` | serial | internal |
| `agents.task.recover` | `agents.task.recover` | serial | internal |

The split follows the rule the runtime already applies: **serialisation is used
where the store cannot enforce the invariant on its own.**

- **Every work unit is concurrent.** They are long, they are I/O bound, and
  their durable writes are single-row settlements guarded by
  `(runId, unitSeq)` uniqueness. This is also what keeps loopback dispatch safe:
  a concurrent job may enqueue the serial job a target command becomes.
- **`agents.run.start` is concurrent, and that is what makes it the right place
  to pin the scope manifest.** `knowledge.resolveScope` walks every source in
  the project when the scope is absent — which is the default — and issues one
  resource lookup per source. Doing that inside the serial command job would
  hold the backend's single serial slot, which every Document command, General
  File upload, and Persona write queues behind, for an unbounded walk.
- **Settlement is serial.** It reads the task, checks revision and terminal
  state, writes several tables, and stages outbound rows — a read-then-write
  across store calls the store cannot guard alone.
- **Recovery is serial** for the same reason, and because two recovery sweeps
  racing over the same task would each try to reconcile the same dispatched
  call.

### The re-entrancy rule

**A concurrent job may enqueue a serial job. A serial job must never await
one.** The serial queue has a single active slot; a serial job awaiting another
serial job deadlocks the whole backend.

This is why every work unit is concurrent even though `agents.work.act`
triggers a serial `POST /documents/command` through the gateway. It is an
architectural regression test, not a convention: no serial agent intent may call
`AgentEndpointGateway.call`.

`agents.run.settle` and `agents.task.settle` are serial and touch only Agents'
own store — they never call the gateway.

### Internal intents

```ts
type AgentInternalJobIntent =
  | { type: "agents.run.start";      runId: string;  idempotencyKey: string }
  | { type: "agents.work.decompose"; runId: string;  unitSeq: number;
      goalId?: string; idempotencyKey: string }   // goalId absent = the root objective
  | { type: "agents.work.sequence";  runId: string;  unitSeq: number;
      goalId: string; trigger: AgentWorkUnitTrigger; idempotencyKey: string }
  | { type: "agents.work.act";       runId: string;  unitSeq: number;
      idempotencyKey: string }
  | { type: "agents.work.verify";    runId: string;  unitSeq: number;
      goalId: string; attempt: number; idempotencyKey: string }
  | { type: "agents.run.settle";     runId: string;  idempotencyKey: string }
  | { type: "agents.task.settle";    taskId: string; runId: string; idempotencyKey: string }
  | { type: "agents.task.recover";   taskId: string; idempotencyKey: string };
```

`agents.work.verify` carries an `attempt` so the `pending` outcome — the change
was accepted but has not settled at the target yet — can re-dispatch the same
verify on a backoff without looking like a duplicate.

There is no `agents.work.read` intent. Reads happen inside a decompose,
sequence, or verify unit's own model call and are recorded as `tool_calls` rows
on that unit. Only mutations get their own unit and their own job.

Wiring uses the existing `SchedulerInternalJobsRuntime<AgentInternalJobIntent>`:
the **dispatch face** goes to the capability, the **registrar face** to
`4-job-wiring/agents/createAgentJobs.ts`. That file maps intent → queue in a
total `switch` with no `default`, so adding an intent is a compile error until
wiring handles it.

No new dispatcher is built. That seam already exists in
`0-utils/jobs/internalRuntime.ts`, including the dispatch/registrar split and
`isRetryableInternalJobAdmissionError`.

`agents.task.recover` is dispatched from two places and never from a timer: once
per recoverable task at startup, before the HTTP listener binds, and
opportunistically for a task's siblings whenever a run settles. There is no
recurring agent sweeper — the tree has three recurring or recovery mechanisms
already, and a fourth would be the "second orchestration framework" the codebase
lists as a non-goal.

## Errors

```ts
class AgentTaskNotFoundError     extends Error { readonly taskId: string }
class StaleAgentTaskError        extends Error { readonly taskId: string;
                                                 readonly expectedRevision: number;
                                                 readonly actualRevision: number }
class AgentTaskSettledError      extends Error { readonly taskId: string;
                                                 readonly state: AgentTaskState }
class AgentQuestionClosedError   extends Error { readonly questionId: string }
class AgentApprovalMismatchError extends Error { readonly toolCallId: string;
                                                 readonly expectedDigest: string }
class AgentPolicyError           extends Error { readonly reason: string }
class AgentValidationError       extends Error { readonly field: string;
                                                 readonly reason: string }
class AgentWireError             extends Error { }
```

| Error | Status | Wire code |
| --- | --- | --- |
| `AgentTaskNotFoundError` | 404 | `task_not_found` |
| `StaleAgentTaskError` | 409 | `revision_conflict` |
| `AgentTaskSettledError` | 409 | `task_settled` |
| `AgentQuestionClosedError` | 409 | `question_closed` |
| `AgentApprovalMismatchError` | 409 | `approval_digest_mismatch` |
| `AgentPolicyError` | 400 | `policy_invalid` |
| `AgentWireError` / `AgentValidationError` | 400 | `agent_invalid` |

Domain throws typed errors and never mentions a status code; job wiring maps
them. Internals never leak on a 500 — the real message is logged, a fixed
generic one is returned (`"Agent operation failed"`), matching every other
`errorResponse` ladder in `4-job-wiring`.

There are no `ResourceNotDeletedError` / `ResourceHistoryNotFoundError`
branches, because there is no `task.delete` and no `task.purge` — see
[store.md](store.md) → Retention.

The wiring file logs `agents.command.failed` and `agents.query.failed` at
`error` level, and **only when `statusCode >= 500`**. Expected 4xx outcomes are
not error-logged; that rule is uniform across the tree.

## Logging

```text
agents.runtime.created      info   {}
agents.endpoints.registered info   { count, endpoints }
agents.catalogue.validated  info   { descriptorCount, mutatingCount }
agents.task.create      info   { taskId, personaId, personaRevision, sectionCount,
                                 limitsPreset, policyEntryCount, mutatingEntryCount,
                                 origin, durationMs }
agents.scope.pinned     info   { taskId, runId, sourceCount, hasContextEntry,
                                 hasPersonaContext, durationMs }
agents.run.start        info   { taskId, runId, attempt }
agents.run.settle       info   { taskId, runId, status, unitCount, failureCode,
                                 totalTokens, durationMs }
agents.goal.declared    info   { taskId, goalId, parentGoalId, depth, ordinal }
agents.goal.settle      info   { taskId, goalId, state, depth, unitCount,
                                 sequenceAttempts, verifyAttempts, durationMs }
agents.unit.settle      debug  { runId, unitSeq, kind, trigger, state, goalId,
                                 promptVersion, readCount, usageTotalTokens, durationMs }
agents.unit.superseded  info   { runId, unitSeq, kind, supersededCount, reason }
agents.verify.pending   info   { taskId, goalId, attempt, waitingOn, backoffMs }
agents.bound.reached    warn   { taskId, runId, goalId, bound, value }
agents.mutation.propose info   { taskId, unitId, endpointKey, resourceKind,
                                 resourceId, requestDigest, decision, durationMs }
agents.mutation.settle  info   { taskId, unitId, endpointKey, ok, statusCode,
                                 targetRevision, targetRef, errorCode, durationMs }
agents.approval.decide  info   { taskId, toolCallId, decision, actorId, durationMs }
agents.task.settle      info   { taskId, outcome, runCount, unitCount, goalCount,
                                 mutationCount, totalTokens, costUsd, durationMs }
agents.task.cancel      info   { taskId, revision, durationMs }
agents.activity.publish-failed warn { taskId, sourceTransactionId, errorName }
agents.recover          warn   { taskId, finding, action, unitId }
agents.query.completed  debug  { type, count, durationMs }
agents.command.failed   error  { requestId, errorName, errorMessage }
agents.query.failed     error  { requestId, errorName, errorMessage }
```

The rule that governs all of it: **objectives, exchange content, goal
statements, rationales, request bodies, persona section text, and model output
never appear in a log record.** Digests, counts, ids, endpoint keys, and
outcomes do. This follows the existing exclusion of provider bodies, Formula
source text, and persona prose from diagnostics, and it is what makes
`requestDigest` worth carrying — two units can be compared for identical
proposals without writing the proposal anywhere.

`agents.runtime.created`, `agents.endpoints.registered`, `.query.completed`,
`.command.failed`, and `.query.failed` are not optional decoration — they are
the recurring vocabulary required by the logging practice in
`docs/platform/observability.md`, where Activity and Comments are the reference
implementations. A capability that logs only its failures is invisible when it
is working.

`agents.recover` is `warn` rather than `info` because every one of its findings
means something did not finish cleanly.
