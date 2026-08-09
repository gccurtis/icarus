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
closest model for a new one. `getEndpointKey` is exact string equality on
`` `${method} ${path}` ``, so `POST /agents/tasks/:taskId/answers` from the older
model is not expressible.

The fine-grained REST-ish style in Context and Structured Data is the earlier
one, but chronology alone does not settle it — Investigation was built after
both and registers 22 fine-grained routes. The reason to choose command/query
here is that Agents has one aggregate with a state machine, so one discriminated
command union keeps queue placement and the error ladder in one place.

Every mutation is serial because task control reads-then-writes across several
store calls — the same reason Document and Persona commands are serial.

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
   * a list of entries can only ever union.
   */
  readonly contextEntry?: ContextEntry;
  readonly policy: AgentToolPolicy;
  /** Absent → agents.defaultStrategy from config. */
  readonly strategy?: { name: string; version: string; options?: unknown };
  readonly origin?: AgentOrigin;                // absent → { kind: "user" }
  /** A named preset from config. Absent → agents.defaultLimits. */
  readonly limitsPreset?: string;
  /** Applied on top of the preset. */
  readonly limits?: Partial<AgentLimits>;
}
```

Notes on the shape:

- **`expectedRevision` on every control command.** Compare-and-swap against the
  task revision, so a stale client cannot answer a question that a concurrent
  command already changed the meaning of.
- **`requestDigest` is required on approve.** The client echoes the digest it
  was shown. A mismatch is rejected — digest binding enforced at the wire, not
  just internally, which also makes a stale approval UI impossible to act on.
- **`requestId` on create only.** Creation is the one command whose replay must
  return the original response rather than an error, so it gets a receipt row
  keyed on the request id alone — the same shape as Document's
  `create_receipts`, because there is no task id at retry time. The other
  commands are naturally idempotent under CAS.
- **`strategy` is pinned by name and version.** The registry is keyed on the
  pair, so shipping a new version cannot change a task in flight. An
  unregistered `(name, version)` is a 400 at creation, and `options` is
  validated by the strategy itself before any row is written.
- **No `task.resume`.** Answering, approving, or steering a `waiting` task
  resumes the run in the same transaction.
- **No `task.pause`.** A pause that must survive a restart is a state, and the
  states that exist cover the real cases: `waiting` for blocked, cancel for stop.

### Limits come from named configuration sets

```yaml
agents:
  defaultLimits: standard
  defaultStrategy: { name: simple-loop, version: "1" }
  limits:
    quick:    { maxCyclesPerRun: 20,  maxMutationsPerTask: 20,  maxTokensPerTask: 1_000_000,  … }
    standard: { maxCyclesPerRun: 200, maxMutationsPerTask: 200, maxTokensPerTask: 10_000_000, … }
    thorough: { maxCyclesPerRun: 800, maxMutationsPerTask: 800, maxTokensPerTask: 50_000_000, … }
```

Resolution happens at creation — preset, then per-task overrides — and the
resolved set is frozen onto the task, so editing a preset never changes a task
already in flight. An unknown preset is a 400 raised before any row exists.

**Presets exist because these numbers move together.** "Be thorough" is not one
knob but a longer loop, more mutations, and more tokens at once; asking a caller
to keep ten numbers mutually consistent invites incoherent configurations.

Limits belong in `configuration.yaml` rather than `domain/validation.ts` because
they are operational cost controls. Persona and Comments keep theirs in the
domain because those are content-shape rules; that precedent does not transfer.

Strategy-specific bounds — plan depth, planning turns, rework limits — live in
`strategy.options`, not here, because they are meaningless to a strategy with no
plan tree.

### Command effects

Every command lands as an exchange message. Nothing interrupts a running cycle
directly; the effect is picked up by the tool loop's `onRound` hook mid-cycle,
or by the next cycle's strategy input.

| Command | Task state | Exchange | What happens |
| --- | --- | --- | --- |
| `task.create` | → `queued` | objective (seq 1) | run starts, scope pins, cycle 1 |
| `task.steer` | unchanged, or `waiting` → `running` | steering | `onRound` injects it mid-cycle; the strategy sees it in `newMessages` and amends the queue |
| `task.answer` | `waiting` → `running` when the last required question closes | answer | dispatch a cycle; the strategy sees the answer |
| `task.approve` grant | `waiting` → `running` | approval | dispatch a cycle; **step 2 dispatches the approved call** before any model work |
| `task.approve` deny | `waiting` → `running` | approval | the call is `rejected`; the strategy sees it in `decisions` |
| `task.cancel` | → `cancelled` | result | the cycle unwinds at its next tool round; the run settles `cancelled` |

Steering a `running` task enqueues nothing directly. **Latency is one tool
round, not one cycle and not one run** — see [execution.md](execution.md) →
"Steering injection". Steering a *terminal* task is rejected with
`task_settled`.

## Queries

```ts
type AgentQuery =
  | { type: "task.get";       taskId: string }
  | { type: "task.list";      filter?: AgentTaskFilter; limit?: number; cursor?: string }
  | { type: "task.exchange";  taskId: string; afterSeq?: number; limit?: number }
  | { type: "task.plan";      taskId: string }
  | { type: "task.queue";     taskId: string; includeSettled?: boolean }
  | { type: "task.runs";      taskId: string }
  | { type: "run.cycles";     runId: string }
  | { type: "task.attention" }
  | { type: "task.toolCalls"; taskId: string; mutatingOnly?: boolean };

interface AgentTaskFilter {
  readonly state?: readonly AgentTaskState[];
  readonly origin?: "user" | "automation";
  readonly automationId?: string;
  readonly personaId?: string;
  readonly strategyName?: string;
}
```

`task.exchange` with `afterSeq` is the polling primitive a UI uses to follow a
live task — the same shape Activity uses for its feed. `task.attention` returns
every task waiting on a person, which is the queue a person actually works from.

**`task.plan` and `task.queue` are what make a task legible before it acts.**
The plan is what the agent intends; the queue is what it has left to do, in
order. Both are populated by the strategy but rendered generically, so a UI does
not need to know which strategy a task runs.

`run.cycles` and `task.toolCalls` are the audit views. `run.cycles` carries each
cycle's `stepKind`, `promptVersion`, tool-round and read counts, and why it
unwound. Neither exposes the run transcript; that is model-facing state with no
read path by design.

## Jobs

| Endpoint or intent | Job name | Queue | Response |
| --- | --- | --- | --- |
| `POST /agents/command` | `agents.command.v1` | serial | inline |
| `POST /agents/query` | `agents.query.v1` | concurrent | inline |
| `agents.run.start` | `agents.run.start` | **agent** | internal |
| `agents.cycle` | `agents.cycle` | **agent** | internal |
| `agents.run.settle` | `agents.run.settle` | serial | internal |
| `agents.task.settle` | `agents.task.settle` | serial | internal |
| `agents.task.recover` | `agents.task.recover` | serial | internal |

Five intents, down from eight — the unit kinds collapsed into one `agents.cycle`
because the runtime no longer branches on what kind of turn it is. That is the
substrate/strategy line showing up in the job table.

```ts
type AgentInternalJobIntent =
  | { type: "agents.run.start";    runId: string;  idempotencyKey: string }
  | { type: "agents.cycle";        runId: string;  cycleSeq: number; idempotencyKey: string }
  | { type: "agents.run.settle";   runId: string;  idempotencyKey: string }
  | { type: "agents.task.settle";  taskId: string; runId: string; idempotencyKey: string }
  | { type: "agents.task.recover"; taskId: string; idempotencyKey: string };
```

### Queue placement

The split follows the rule the runtime already applies: **serialisation is used
where the store cannot enforce the invariant on its own.**

- **`agents.run.start` and `agents.cycle` run on the agent pool.** They are long
  and I/O-bound, and their durable writes are guarded by `(runId, cycleSeq)`
  uniqueness. Running them concurrently is also what makes loopback dispatch
  safe: a concurrent job may enqueue the serial job a target command becomes.
- **`agents.run.start` pinning the scope** is the reason it is not serial.
  `knowledge.resolveScope` walks every source in the project when the scope is
  absent — the default — and issues one lookup per source. Doing that on the
  serial queue would hold the backend's single write slot for an unbounded walk.
- **Settlement is serial.** It reads the task, checks revision and terminal
  state, writes several tables, and stages outbound rows — a read-then-write
  across store calls the store cannot guard alone.
- **Recovery is serial** for the same reason, and because two sweeps racing over
  the same task would each try to reconcile the same dispatched call.

### A third pool, not a reservation

Agent work does not share `workerPool.concurrentWorkers` with HTTP reads. It
gets its own pool.

The existing default of 4 concurrent workers is sized for **synchronous
SQLite**: with `better-sqlite3`, extra workers do not help CPU-bound
store work and only add memory and contention. Agent cycles are the opposite —
almost entirely blocked on model responses, where 4 is absurdly low.

One pool cannot be right for both shapes, so the scheduler grows a third array
with the same admission logic and its own size (`workerPool.agentWorkers`,
default 16). Agent work never competes with document queries for a slot, and
each pool is sized for its actual bottleneck. See
[supplementary-changes.md](supplementary-changes.md) item 5c.

### The re-entrancy rule

**A concurrent job may enqueue a serial job. A serial job must never await
one.** The serial queue has a single active slot; a serial job awaiting another
serial job deadlocks the whole backend.

Every cycle runs on the agent pool, never serial. `agents.run.settle` and
`agents.task.settle` are serial and touch only Agents' own store — they never
call the gateway. There is an architectural regression test asserting no serial
agent intent reaches `AgentEndpointGateway.call`.

### No timers

`agents.task.recover` is dispatched from two places and never from a timer: once
per recoverable task at startup, before the HTTP listener binds, and
opportunistically for a task's siblings whenever a run settles. The tree has
three recurring or recovery mechanisms already, and a fourth would be the
"second orchestration framework" the codebase lists as a non-goal.

Wiring uses the existing `SchedulerInternalJobsRuntime<AgentInternalJobIntent>`:
the **dispatch face** goes to the capability, the **registrar face** to
`4-job-wiring/agents/createAgentJobs.ts`, which maps intent → queue in a total
`switch` with no `default`.

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
class AgentStrategyError         extends Error { readonly name: string;
                                                 readonly version: string;
                                                 readonly reason: string }
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
| `AgentStrategyError` | 400 | `strategy_invalid` |
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
agents.strategies.registered info  { strategies: ["simple-loop@1", …] }

agents.task.create      info   { taskId, personaId, personaRevision, sectionCount,
                                 strategyName, strategyVersion, limitsPreset,
                                 policyEntryCount, mutatingEntryCount, origin, durationMs }
agents.scope.pinned     info   { taskId, runId, sourceCount, hasContextEntry,
                                 hasPersonaContext, durationMs }
agents.run.start        info   { taskId, runId, attempt }
agents.run.settle       info   { taskId, runId, status, cycleCount, failureCode,
                                 totalTokens, durationMs }

agents.cycle.start      debug  { taskId, runId, cycleSeq, queueItemKind, queueDepth }
agents.cycle.settle     info   { taskId, runId, cycleSeq, stepKind, state,
                                 promptVersion, toolRounds, readCount, mutationCount,
                                 interruptedBy, usageTotalTokens, durationMs }
agents.queue.push       debug  { taskId, cycleId, position, count, kinds }
agents.queue.supersede  info   { taskId, cycleId, count, reason }
agents.plan.write       debug  { taskId, cycleId, nodeCount, maxDepth }

agents.steer.injected   info   { taskId, runId, cycleSeq, round, messageCount }
agents.mutation.propose info   { taskId, cycleId, endpointKey, resourceKind,
                                 resourceId, requestDigest, decision, durationMs }
agents.mutation.settle  info   { taskId, cycleId, endpointKey, ok, statusCode,
                                 targetRevision, targetRef, errorCode, durationMs }
agents.approval.decide  info   { taskId, toolCallId, decision, actorId, durationMs }
agents.bound.reached    warn   { taskId, runId, bound, value }

agents.task.settle      info   { taskId, outcome, runCount, cycleCount, planNodeCount,
                                 mutationCount, totalTokens, costUsd, durationMs }
agents.task.cancel      info   { taskId, revision, durationMs }
agents.activity.publish-failed warn { taskId, sourceTransactionId, errorName }
agents.recover          warn   { taskId, finding, action, cycleId, toolCallId }
agents.query.completed  debug  { type, count, durationMs }
agents.command.failed   error  { requestId, errorName, errorMessage }
agents.query.failed     error  { requestId, errorName, errorMessage }
```

The rule that governs all of it: **objectives, exchange content, plan
statements, queue labels and payloads, strategy memory, request bodies, persona
section text, and model output never appear in a log record.** Digests, counts,
ids, endpoint keys, kinds, and outcomes do. This follows the existing exclusion
of provider bodies, Formula source, and persona prose from diagnostics, and it
is what makes `requestDigest` worth carrying — two cycles can be compared for
identical proposals without writing the proposal anywhere.

`agents.runtime.created`, `agents.endpoints.registered`, `.query.completed`,
`.command.failed`, and `.query.failed` are not optional decoration — they are
the recurring vocabulary required by the logging practice in
`docs/platform/observability.md`, where Activity and Comments are the reference
implementations.

`agents.steer.injected` deserves its own event because it is the one place a
person's intent enters a running model call, and "did my steering land, and
when" is the first question anyone will ask when it appears not to have.
