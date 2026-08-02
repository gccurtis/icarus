# Agents — operations

Commands, queries, endpoints, jobs, and queue placement.

## Two endpoints

```text
POST /agents/command    serial      all mutations
POST /agents/query      concurrent  all reads
```

Discriminated-union bodies, no path parameters. This is the newer house shape —
Document, Slide, and Activity all use a command/query pair, while the
fine-grained REST-ish style in Context and Structured Data is the earlier one.
The backend has no path parameters anywhere: `getEndpointKey` is exact string
equality on `` `${method} ${path}` ``, so `POST /agents/tasks/:taskId/answers`
from the older model is not expressible.

Two endpoints rather than eleven also keeps queue placement honest. Every
mutation is serial because task control reads-then-writes across several store
calls, which is the same reason Document and Slide commands are serial.

## Commands

```ts
type AgentCommand =
  | { type: "task.create";  clientRequestId: string; input: CreateTaskInput }
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
  readonly contextEntries: readonly ContextEntry[];   // [] → whole project
  readonly policy: AgentToolPolicy;
  readonly origin?: AgentOrigin;                // absent → { kind: "operator" }
  readonly limits?: Partial<AgentLimits>;
}
```

Notes on the shape:

- **`expectedRevision` on every control command.** Compare-and-swap against the
  task revision, so a stale client cannot answer a question that a concurrent
  command already changed the meaning of.
- **`requestDigest` is required on approve.** The client echoes the digest it
  was shown. If it does not match the call's current digest, the approval is
  rejected — this is the digest binding from [tools.md](tools.md) enforced at
  the wire, not just internally. It also makes a stale approval UI impossible to
  act on.
- **`clientRequestId` on create only.** Creation is the one command whose
  replay must return the original response rather than an error, so it gets a
  receipt row. The other commands are naturally idempotent under CAS: a replay
  finds the revision already moved and fails cleanly.
- **No `task.resume`.** Resuming is implied — answering, approving, or steering
  a `waiting` task enqueues the next run in the same transaction. A separate
  resume command would let a task be resumed while still blocked.
- **No `task.pause`.** A pause that must survive a restart is a state, and the
  states that exist already cover the real cases: `waiting` for blocked, cancel
  for stop. Pause was in the older model and is dropped as unearned surface.

### Command effects

| Command | State effect | Exchange | Enqueues a run |
| --- | --- | --- | --- |
| `task.create` | → `queued` | objective (seq 1) | yes |
| `task.steer` | unchanged, or `waiting` → `running` | steering | if not blocked and not terminal |
| `task.answer` | `waiting` → `running` when the last required question closes | answer | when unblocked |
| `task.approve` grant | `waiting` → `running` | approval | yes |
| `task.approve` deny | `waiting` → `running` | approval | yes — the agent must react to the refusal |
| `task.cancel` | → `cancelled` | result | no |

Steering a task that is `running` appends the message and enqueues nothing; the
in-flight run finishes and the next run picks the message up under the
consumed-prefix rule. Steering a *terminal* task is rejected with
`task_settled`.

## Queries

```ts
type AgentQuery =
  | { type: "task.get";      taskId: string }
  | { type: "task.list";     filter?: AgentTaskFilter; limit?: number; cursor?: string }
  | { type: "task.exchange"; taskId: string; afterSeq?: number; limit?: number }
  | { type: "task.runs";     taskId: string }
  | { type: "run.steps";     runId: string }
  | { type: "task.attention" }
  | { type: "task.toolCalls"; taskId: string };

interface AgentTaskFilter {
  readonly state?: readonly AgentTaskState[];
  readonly origin?: "operator" | "automation";
  readonly automationId?: string;
  readonly personaId?: string;
}
```

`task.exchange` with `afterSeq` is the polling primitive a UI uses to follow a
live task — the same shape Activity uses for its feed. `task.attention` returns
every task waiting on a person, which is the queue a person actually works from.

`run.steps` and `task.toolCalls` are the audit views. Neither exposes the run
transcript; that is model-facing state and has no read path by design.

## Jobs

| Endpoint or intent | Job | Queue | Response |
| --- | --- | --- | --- |
| `POST /agents/command` | `agents.command.v1` | serial | inline |
| `POST /agents/query` | `agents.query.v1` | concurrent | inline |
| `agents.run.execute` | `ExecuteAgentRunJob` | concurrent | internal |
| `agents.step.reason` | `AgentReasonStepJob` | concurrent | internal |
| `agents.step.tool` | `AgentToolStepJob` | concurrent | internal |
| `agents.run.settle` | `SettleAgentRunJob` | serial | internal |
| `agents.task.settle` | `SettleAgentTaskJob` | serial | internal |
| `agents.task.recover` | `RecoverAgentTaskJob` | serial | internal |

The split follows the rule the runtime already applies: **serialisation is used
where the store cannot enforce the invariant on its own.**

- Reason and tool steps are concurrent. They are long, they are I/O bound, and
  their durable writes are single-row settlements guarded by
  `(runId, stepSeq)` uniqueness.
- Settlement is serial. It reads the task, checks revision and terminal state,
  writes several tables, and stages an outbound intent — a read-then-write
  across store calls that the store cannot guard alone.
- Recovery is serial for the same reason, and because two recovery sweeps
  racing over the same task would each try to reconcile the same dispatched
  call.

More runnable agent work than the pool has capacity for waits in the concurrent
FIFO queue. A running job never changes queues.

### Internal intents

```ts
type AgentInternalJobIntent =
  | { type: "agents.run.execute";  runId: string;  idempotencyKey: string }
  | { type: "agents.step.reason";  runId: string;  stepSeq: number; idempotencyKey: string }
  | { type: "agents.step.tool";    runId: string;  stepSeq: number;
      toolCallId: string; idempotencyKey: string }
  | { type: "agents.run.settle";   runId: string;  idempotencyKey: string }
  | { type: "agents.task.settle";  taskId: string; runId: string; idempotencyKey: string }
  | { type: "agents.task.recover"; taskId: string; idempotencyKey: string };
```

Wiring uses the existing `SchedulerInternalJobsRuntime<AgentInternalJobIntent>`:
the **dispatch face** goes to the capability, the **registrar face** to
`4-job-wiring/agents/createAgentJobs.ts`. That file maps intent → queue in a
total `switch` with no `default`, so adding an intent is a compile error until
wiring handles it.

No new dispatcher is built. The older model proposed
`4-job-wiring/internal/InternalJobDispatcher.ts`; that seam already exists in
`0-utils/jobs/internalRuntime.ts`, including the dispatch/registrar split and
`isRetryableInternalJobAdmissionError`.

## Errors

```ts
class AgentTaskNotFoundError    extends Error { readonly taskId: string }
class StaleAgentTaskError       extends Error { readonly taskId: string;
                                                readonly expectedRevision: number;
                                                readonly actualRevision: number }
class AgentTaskSettledError     extends Error { readonly taskId: string;
                                                readonly state: AgentTaskState }
class AgentQuestionClosedError  extends Error { readonly questionId: string }
class AgentApprovalMismatchError extends Error { readonly toolCallId: string;
                                                 readonly expectedDigest: string }
class AgentPolicyError          extends Error { readonly reason: string }
class AgentValidationError      extends Error { readonly field: string;
                                                readonly reason: string }
```

| Error | Status | Wire code |
| --- | --- | --- |
| `AgentTaskNotFoundError` | 404 | `task_not_found` |
| `StaleAgentTaskError` | 409 | `revision_conflict` |
| `AgentTaskSettledError` | 409 | `task_settled` |
| `AgentQuestionClosedError` | 409 | `question_closed` |
| `AgentApprovalMismatchError` | 409 | `approval_digest_mismatch` |
| `AgentPolicyError` | 400 | `policy_invalid` |
| `AgentValidationError` | 400 | `agent_invalid` |

Domain throws typed errors and never mentions a status code; job wiring maps
them. Internals never leak on a 500 — the real message is logged, a fixed
generic one is returned.

## Logging

```text
agents.task.create    info   { taskId, personaId, personaDigest, scopeDigest,
                               policyEntryCount, mutatingEntryCount, origin, durationMs }
agents.task.settle    info   { taskId, outcome, runCount, toolCallCount,
                               mutationCount, totalTokens, costUsd, durationMs }
agents.task.cancel    info   { taskId, revision, durationMs }
agents.run.start      info   { taskId, runId, attempt, consumedThroughSeq }
agents.run.settle     info   { taskId, runId, status, stepCount, failureCode,
                               totalTokens, durationMs }
agents.step.settle    debug  { runId, stepSeq, kind, state, usageTotalTokens, durationMs }
agents.tool.propose   info   { taskId, toolCallId, targetKind, commandName,
                               requestDigest, decision, durationMs }
agents.tool.settle    info   { taskId, toolCallId, ok, targetRevision,
                               changeSetId, errorCode, durationMs }
agents.approval.decide info  { taskId, toolCallId, decision, actorId, durationMs }
agents.recover        warn   { taskId, finding, action, toolCallId }
agents.query          debug  { type, count, durationMs }
```

The rule that governs all of it: **objectives, exchange content, rationales,
proposal arguments, and model output never appear in a log record.** Digests,
counts, ids, and outcomes do. This follows the existing exclusion of provider
bodies and Formula source text from diagnostics, and it is what makes
`requestDigest` worth carrying — two runs can be compared for identical
proposals without writing the proposal anywhere.

`agents.recover` is `warn` rather than `info` because every one of its findings
means something did not finish cleanly, and the `outcome_unknown` branch needs
to be visible without reading a feed.
