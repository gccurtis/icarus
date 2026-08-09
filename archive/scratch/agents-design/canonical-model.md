# Agents — canonical model

## Aggregate and authority boundary

Agents owns one durable aggregate, the **task**, and everything reachable from
it: its work queue, its plan, its runs and cycles, its exchange, questions,
approvals, and tool call records. Project ID selects the runtime and store at
construction; neither project nor user identity appears in canonical Agent
values.

The aggregate's authority is deliberately narrow. A task is authoritative about
*what was asked, what was frozen, what was attempted, and what came back*. It is
never authoritative about the effect of a mutation — the owning capability's
revision is. Agents stores a reference to that effect, not a copy of it.

## The shape

```text
Task              durable, revisioned. The whole engagement. Never deleted.
 ├─ objective     immutable after creation
 ├─ origin        { user } | { automation, automationId }
 ├─ persona       frozen PersonaSnapshot, pinned by (personaId, revision)
 ├─ policy        frozen AgentToolPolicy, over endpoint keys
 ├─ limits        frozen AgentLimits
 ├─ strategy      frozen { name, version, options } — how this task works
 ├─ contextEntry  at most one; absent means the whole project
 ├─ scope         frozen KnowledgeScopeManifest, pinned by run 1
 │
 ├─ queue[]       ordered work items. push-front | push-back | dequeue.
 │                Append-mostly: an item is pushed, dequeued, and settled —
 │                never edited.
 │
 ├─ plan[]        optional nodes the strategy writes. What a person sees.
 │
 ├─ exchange[]    append-only, seq-ordered. The only person↔agent channel.
 │
 └─ Run[]         one continuous attempt. Survives steering.
      └─ Cycle[]  one turn of the loop: dequeue → plan → model + tool loop →
                  interpret → commit
           └─ ToolCall[]   reads and mutations, every one intercepted by us
```

### The five ideas that carry the weight

**1 · The queue is the work.** A task advances by dequeuing an item, doing it,
and pushing whatever it discovered back on. It is a **deque**: a strategy may
push to the back (more to do later) or to the front (do this next, before
anything else). Depth-first planning is just "push children to the front";
"that came out wrong, fix it before moving on" is a front push from a self-check.

This replaces an earlier design's derived goal-tree traversal. A traversal rule
and a queue discipline express the same thing, and the queue expresses it as
data rather than as a rule the reader has to hold in their head.

**2 · The cycle is the atomic committed unit.** One dequeue, one strategy turn,
one bounded model call with tools, one transaction. It is what commits, what
steering is checked within and between, what recovery resolves, and what the
audit trail is made of.

The platform's word *job* stays reserved for the scheduling primitive that
executes one cycle. A cycle is a durable domain record; a job is a mechanism.

**3 · The bound is on cycles, not on queue size.** Queue length is incidental —
a strategy can push as much as it likes. What costs money is **work performed**,
and a cycle is one model call. `maxCyclesPerRun` and `maxTokensPerTask` are the
two honest bounds; `maxQueueDepth` exists only as a runaway-push guard.

**4 · Every tool call is intercepted.** The model emits tool calls and *stops*.
The runtime executes them. So a mutating tool call is a **declaration** the
runtime records, gates, and dispatches — the model cannot change anything
directly, only ask us to. See [tools.md](tools.md).

**5 · The strategy decides; the runtime acts.** A strategy is two pure functions
over durable state — one builds the model request, one interprets the result.
Every effect is applied by the runtime, in one transaction. See
[strategies.md](strategies.md).

## Task

```ts
type AgentTaskState =
  | "queued"     // created; no run has started
  | "running"    // a run is in flight
  | "waiting"    // blocked on a person
  | "completed" | "partial" | "failed" | "cancelled";   // terminal

type AgentAttention = "question" | "approval";

interface AgentOrigin {
  /** Matches ActivityOrigin. Prose says "operator"; the wire value is "user". */
  readonly kind: "user" | "automation";
  readonly automationId?: string;
}

interface AgentTask {
  readonly id: string;
  readonly revision: number;          // monotone; CAS target for control commands
  readonly state: AgentTaskState;

  // ── Immutable after creation ──────────────────────────────────────────
  readonly objective: string;
  readonly origin: AgentOrigin;
  readonly actorId: string;
  readonly persona: PersonaSnapshot;      // frozen, from #persona
  readonly personaId: string;
  readonly personaRevision: number;
  readonly policy: AgentToolPolicy;
  readonly limits: AgentLimits;
  /** Which loop this task runs, pinned so a strategy change cannot reach it. */
  readonly strategy: AgentStrategyBinding;
  readonly contextEntry?: ContextEntry;    // absent → the whole project

  // ── Immutable once pinned, before the first model call ────────────────
  readonly scope?: KnowledgeScopeManifest;
  readonly scopePinnedAt?: string;

  // ── Maintained projection, written by the same transactions ───────────
  readonly attention?: AgentAttention;
  readonly headSeq: number;
  readonly result?: AgentTaskResult;

  readonly createdAt: string;
  readonly updatedAt: string;
  readonly settledAt?: string;
}

interface AgentStrategyBinding {
  readonly name: string;         // "simple-loop" | "decompose-verify"
  readonly version: string;
  /** Strategy-specific configuration, validated by the strategy at creation. */
  readonly options: Readonly<Record<string, unknown>>;
}
```

### Persona is pinned by revision, not by digest

`(personaId, personaRevision, snapshot.sections)` fully determines the prompt a
task received. Persona's revision starts at 1 and increments by exactly one per
accepted update; the built-in is revision 0.

Persona also exposes `definitionDigest` and `promptDigest`. Neither is a task
column. `definitionDigest` excludes `displayName` and `description`, so it
answers "did the behaviour change" while revision answers "did the record change
at all" — and for "which tasks ran which version", revision is the right
granularity. `promptDigest` varies with section selection at fixed revision,
which the stored `sections` list already captures. Both stay inside
`persona_json`; nothing indexes them.

### One context entry, not a list

A task carries **at most one** `ContextEntry`. Absent means the whole project.

The reason is expressiveness. A list can only ever union — there is no way to
say *"the whole project except this document"* by enumerating entries. Exclusion
is expressible only *inside* a Context, through `POST /contexts/difference`. So
the caller composes what it wants and hands Agents the single reference.

Agents never performs set algebra and never has to decide what a list of five
entries was supposed to mean.

The persona may contribute one further entry — its own private Context wrapper.
Agents unions that in when it pins the scope, following Persona's "union only"
law: a persona may add reference material, never narrow a task's scope.

### The frozen inputs

`objective`, `persona`, `policy`, `limits`, `strategy`, and `scope` are written
once and never change. Five in the creation transaction; **`scope` is pinned by
the task's first run**, because resolving a whole-project scope is unbounded
work and creation runs on the backend's single serial slot — see
[execution.md](execution.md).

> Every input a task runs against is frozen **before its first model call**, and
> immutable for the rest of the task's life.

Consequences worth stating, because each is a support request waiting to happen:

- **Editing a persona does not change a running task.** The task holds the
  rendered prompt, not a pointer.
- **Editing a strategy does not change a running task.** The binding carries a
  version, and a strategy registry keyed on `(name, version)` means an in-flight
  task keeps the loop it started with.
- **Widening scope or granting a tool requires a new task.** Steering directs
  attention within what a task was given; it cannot grant new material or reach.
- **A pinned scope pins membership, not content.** A connector re-sync mid-task
  changes what retrieval returns. **Accepted and expected** — an agent working on
  live project material should see live project material, and retrieval is
  always against current content.

### State machine

```text
                    ┌────────────────────────────────┐
                    ▼                                │
  create ──► queued ──► running ──► waiting ─────────┘
                          │            │      (answer / approval / steering
                          │            │       resumes the same run)
                          ▼            ▼
                   completed | partial | failed | cancelled     (terminal)
```

Terminal states are **absorbing**. A follow-up is a new task; the old exchange
stays readable.

`waiting` is a task-level state, never a run-level one. A blocked task keeps its
run `running` with nothing dispatched, and answering resumes that same run.

### `state` and `attention` are a maintained projection

Whether a task is blocked is derivable from the questions and approvals tables,
both of which carry partial indexes over exactly those predicates. The task
columns are a **cache**, written in the same transaction as anything that could
change the answer, because `task.attention` is the list a person works from.
Recovery recomputes them and logs drift.

## The queue

```ts
type AgentQueueItemState =
  | "pending"     // waiting to be dequeued
  | "active"      // dequeued; a cycle is working it
  | "done"        // completed by a cycle
  | "superseded"; // dropped without being worked

interface AgentQueueItem {
  readonly id: string;
  readonly taskId: string;
  /**
   * Position. Lower runs first. Front pushes take a value below the current
   * minimum; back pushes above the current maximum. Sparse, so an insertion
   * never renumbers the queue.
   */
  readonly ordinal: number;
  /** Strategy-defined. The runtime never branches on it. */
  readonly kind: string;
  /** Strategy-defined payload. Opaque to the runtime. */
  readonly payload: unknown;
  /** Short, person-facing. Rendered in the queue view. */
  readonly label: string;
  readonly state: AgentQueueItemState;
  /** Which cycle pushed this, and which one worked it. Provenance for audit. */
  readonly pushedByCycleId?: string;
  readonly workedByCycleId?: string;
  readonly planNodeId?: string;
  readonly createdAt: string;
  readonly settledAt?: string;
}
```

### Why a deque, and why the cap is on dequeues

**Push-back** is "more to do after this" — the ordinary output of planning.
**Push-front** is "do this next, before anything already queued", and it is what
makes two important behaviours fall out for free:

- **Depth-first planning.** Decomposing an item into sub-items and pushing them
  to the front *is* depth-first traversal. No cursor, no derivation rule.
- **Correction before progress.** A cycle that checks its own work and finds it
  wrong pushes the fix to the front, so it is addressed before the task moves on
  to unrelated work. Under a plain FIFO the fix would queue behind everything.

**Work already performed is immutable.** A cycle dequeues, works, and settles;
what it can influence is only the *remaining* queue. That keeps the structure
ledger-shaped like the rest of the capability.

**The bound is on cycles, not queue size.** A strategy can push a hundred items
cheaply — pushing costs a row. What costs money is dequeuing and working one,
because that is a model call. `maxQueueDepth` exists only so a runaway strategy
cannot fill the database; the real budget is `maxCyclesPerRun` and
`maxTokensPerTask`.

## Plan nodes

Optional, strategy-populated, and the answer to *"what does a person see?"*

```ts
interface AgentPlanNode {
  readonly id: string;
  readonly taskId: string;
  readonly parentId?: string;
  readonly depth: number;
  readonly ordinal: number;
  /** Strategy-defined: "objective" | "goal" | "step" | "attempt" | … */
  readonly kind: string;
  readonly statement: string;
  /** What the strategy expects to observe when this is satisfied. Optional. */
  readonly expectation?: string;
  /** What it observed when it last looked. Optional. */
  readonly observedState?: string;
  readonly state: "pending" | "active" | "done" | "blocked" | "abandoned";
  readonly detail?: unknown;
  readonly createdByCycleId: string;
  readonly settledByCycleId?: string;
  readonly createdAt: string;
  readonly settledAt?: string;
}
```

This is deliberately generic rather than a goal tree. A decompose-verify
strategy writes goals with expectations; a simple loop writes one node per
attempt; something later writes whatever it needs. **A UI renders a tree either
way**, and `task.plan` is a query that always means something.

The property being protected is that **a person can see what the agent intends
before it acts**, which is what makes steering directive rather than reactive.
Keeping that in a structured table rather than inside opaque strategy memory is
the whole reason plan nodes exist as core schema.

## Exchange

The append-only, sequence-ordered timeline shared by the person and the agent.
It is the only channel between them; there is no side-band control path — and it
is also the queue a person writes to when they steer.

```ts
type AgentMessageKind =
  | "objective"        // seq 1, written at creation
  | "plan"             // agent: this is what I intend to do
  | "progress"         // agent: this is what I did or found
  | "question" | "answer"
  | "steering"         // person: direction, mid-flight
  | "approvalRequest" | "approval"
  | "result"           // agent's settlement summary
  | "system";          // runtime notice (items superseded, run retried, bound hit)

/** Identical to ActivityOrigin, deliberately — agent changes land there. */
type AgentAuthorKind = "user" | "agent" | "automation" | "system";

interface AgentMessage {
  readonly id: string;
  readonly taskId: string;
  readonly runId?: string;
  readonly cycleId?: string;
  readonly seq: number;              // strictly increasing, contiguous from 1
  readonly kind: AgentMessageKind;
  readonly author: { readonly kind: AgentAuthorKind; readonly id?: string };
  /**
   * For person-authored messages: the task's headSeq when it was written.
   * Answers "what had the agent said when the person typed this?", which is what
   * makes a steering message legible after the fact.
   */
  readonly inResponseToSeq?: number;
  readonly content: AgentMessageContent;
  readonly createdAt: string;
}
```

### The agent narrates as it works

`plan` and `progress` messages are not decoration — they are the mechanism that
makes steering possible. **A person steers what they can see**, and steering is
useless if the first visible output is the finished result.

The rule that keeps this from becoming noise: a message is written when the
**agent's intent or the world changed**, not per model round trip. A retrieval
that confirmed what the agent already believed is a `tool_calls` row, not an
exchange message. A batch of tool calls about to be executed is one `plan`
message, not one per call.

## Runs and cycles

```ts
type AgentRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

interface AgentRun {
  readonly id: string;
  readonly taskId: string;
  readonly attempt: number;             // 1-based, unique per task
  readonly status: AgentRunStatus;
  readonly result?: AgentRunResult;
  readonly failureCode?: string;
  readonly usage: Usage;
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly settledAt?: string;
}
```

A run is **one continuous attempt at the task**. It spans many cycles and any
number of pauses for a person, and ends only on settlement, failure, or
cancellation. **Steering does not end a run**; it changes what the next cycle
does. A failed run does not fail the task — a new run resumes over the same
queue and plan, bounded by `maxRunsPerTask`.

Strategy memory is **per-run**, so a new run starts fresh over durable queue and
plan state. That is what makes runs disposable in the way the design claims.

```ts
type AgentCycleState = "started" | "succeeded" | "failed" | "cancelled";

interface AgentCycle {
  readonly id: string;
  readonly runId: string;
  readonly taskId: string;
  readonly cycleSeq: number;            // 1-based, contiguous within the run
  readonly state: AgentCycleState;
  /** The item this cycle dequeued, if any. A cycle may run with an empty queue. */
  readonly queueItemId?: string;
  readonly consumedThroughSeq: number;  // the exchange prefix this cycle started from
  /** Strategy-defined label for what this turn was: "decompose" | "work" | … */
  readonly stepKind?: string;
  readonly promptVersion?: string;
  readonly toolRounds: number;
  readonly readCount: number;
  readonly mutationCount: number;
  readonly safeSummary?: string;
  readonly usage?: Usage;
  readonly createdAt: string;
  readonly settledAt?: string;
}
```

`(runId, cycleSeq)` is the idempotency key for the execution path. A duplicate
continuation attempts the claim insert, hits the constraint, reads the existing
row, and returns its recorded outcome. **The cycle row is its own receipt** —
one mechanism where an earlier model had a separate stage-receipts table.

`stepKind` is strategy-defined metadata so `run.cycles` reads legibly ("this one
was a decompose"), but **nothing in the runtime branches on it**. That is the
line between the substrate and the strategy.

## Tool calls

Every call through the gateway is recorded, read or mutation.

```ts
type AgentToolCallState =
  | "recorded"          // a read, executed and returned
  | "rejected"          // policy refused it
  | "awaitingApproval"  // policy requires a person; not dispatched
  | "dispatched"        // sent to the target, outcome not yet recorded
  | "succeeded" | "failed";

interface AgentToolCall {
  readonly id: string;
  readonly taskId: string;
  readonly runId: string;
  readonly cycleId: string;
  readonly roundIndex: number;          // which tool round of the cycle
  readonly mutating: boolean;
  readonly endpointKey: string;         // "POST /documents/command"
  readonly resourceKind?: string;
  readonly resourceId?: string;         // extracted for policy scoping
  readonly request: unknown;            // exact body as dispatched
  /**
   * `agent:<toolCallId>` — minted and committed before dispatch. The target's
   * own receipt is keyed on it, which is what makes recovery a replay rather
   * than a guess. Separate from requestDigest.
   */
  readonly requestId: string;
  /** Binds an approval to these exact arguments. Not used for idempotency. */
  readonly requestDigest: string;
  readonly state: AgentToolCallState;
  readonly result?: AgentToolResultRef;
  readonly rejectionReason?: string;
  readonly createdAt: string;
  readonly settledAt?: string;
}

/** A reference to the target's authoritative record — never a copy of it. */
interface AgentToolResultRef {
  readonly ok: boolean;
  readonly statusCode: number;
  readonly targetRevision?: number;
  /** Opaque target-side correlation id — a ChangeSet id, a transaction id, … */
  readonly targetRef?: string;
  readonly errorCode?: string;
}
```

Reads carry a `requestId` too — the gateway mints one for every call — but
nothing depends on replaying a read, so it exists for correlation rather than
idempotency. Reads are exempt from approval and from `maxMutations`; the only
bounds on them are the cycle's tool-round and read caps. **Reads do not change
the world, so they do not need to be gated, ordered, or recovered.**

### Why interception is enough

A mutating tool call **is a declaration**. The model emits it and stops; the
runtime executes it. So there is a complete interception point between "the
model asked" and "anything happened", and every guarantee hangs off it:

```text
model emits toolCalls
      ▼
runtime sees ALL of them before executing ANY
      ├─ publish one `plan` message: here is what I am about to do
      ├─ per call: policy → reject | require approval | allow
      ├─ allowed: commit the row (state "dispatched", requestId, digest)
      ├─          gateway.call(...)
      └─          commit the result
      ▼
tool results returned to the model, loop continues
```

An earlier design had the model emit mutations as *structured output* instead,
on the belief that a tool handler could not give the same guarantee. It can —
the handler is ours, and it commits before it dispatches. Interception is
strictly better because it needs no per-endpoint output schema, and because
seeing a whole round's calls at once preserves "here is what I am about to do"
without a separate planning turn.

### Dual recording

```text
Agents          agent_tool_calls        what was asked for, by whom, under what approval
target capab.   its own accepted change what actually happened, with agent attribution
```

Neither is derivable from the other. The Agents row answers "why did this happen
and who allowed it"; the target's answers "what is now true". **A rejected or
refused call exists only in the Agents row**, which is exactly the audit trail
you want when asking what an agent *tried* to do.

Two links, doing different jobs:

- **`requestId`** is the one the *target* holds, on its own receipt. It makes a
  re-dispatch a replay.
- **`targetRef`** is the one *Agents* holds. It is a copied value that must
  survive target-side history compaction — the same requirement Activity places
  on its outbox rows.

## Questions and approvals

```ts
interface AgentQuestion {
  readonly id: string;
  readonly taskId: string;
  readonly planNodeId?: string;
  readonly messageId: string;
  readonly state: "open" | "answered" | "withdrawn";
  readonly required: boolean;          // only required questions block
  readonly answerMessageId?: string;
  readonly openedAt: string;
  readonly closedAt?: string;
}

interface AgentApproval {
  readonly id: string;
  readonly taskId: string;
  readonly toolCallId: string;         // exactly one call
  readonly requestDigest: string;      // held here, not looked up
  readonly requestMessageId: string;
  readonly state: "pending" | "granted" | "denied" | "withdrawn";
  readonly decisionMessageId?: string;
  readonly decidedBy?: string;
  readonly requestedAt: string;
  readonly decidedAt?: string;
}
```

- A required open question blocks the task; an optional one does not.
- **A required question accepts exactly one canonical answer** — schema-enforced,
  so a second answer cannot be written even by a bug.
- **An approval is bound to the exact request digest of its call.** Granting
  authorises those arguments and no others. Without this the gate is theatre.
- **A granted approval is dispatched by the runtime**, at the start of the next
  cycle, before any model call. The model does not re-issue it — the call
  already has its row, request, and digest.
- Denial does not fail the run. The call is recorded `rejected`, the denial
  enters the exchange, and the next cycle sees the refusal in its outcomes.
- Settling withdraws every open question and pending approval in one
  transaction.
- When both a required question and a pending approval exist, `attention`
  reports `"question"` — questions are usually cheaper to answer and often make
  the approval decision obvious.

## Invariants

**Task**

1. `objective`, `origin`, `actorId`, `persona`, `personaId`, `personaRevision`,
   `policy`, `limits`, `strategy`, and `contextEntry` never change after
   creation.
2. `scope` and `scopePinnedAt` are absent together or present together; once
   present they never change; and they are present before any model call.
3. `revision` increases by exactly one per accepted control command.
4. `attention` is present iff `state === "waiting"`, and agrees with the
   questions and approvals tables, **which are authoritative**.
5. `result` and `settledAt` are present iff `state` is terminal.
6. Terminal states are absorbing.

**Queue**

7. `ordinal` is unique per task. Front pushes take a value below the current
   minimum, back pushes above the current maximum; existing items are never
   renumbered.
8. An item leaves `pending` exactly once, to `active`, `done`, or `superseded`.
9. A `done` or `superseded` item is never re-queued; a strategy that wants the
   work again pushes a new item.
10. At most one item per task is `active`.

**Exchange**

11. `seq` is contiguous from 1 and strictly increasing.
12. Messages are never edited or deleted.
13. `headSeq` equals the highest `seq` written for the task.
14. A person-authored message carries `inResponseToSeq`.

**Runs and cycles**

15. `attempt` is unique per task and increases by one.
16. At most one run per task is `queued` or `running`.
17. A run's status never becomes `waiting`; the task carries that state.
18. `cycleSeq` is contiguous from 1 within a run; `(runId, cycleSeq)` is unique.
19. A cycle is committed before its continuation is dispatched.
20. Strategy memory is per-run; a new run starts from its strategy's initial
    memory over the existing queue and plan.

**Tool calls**

21. Every mutating call reaching `dispatched` passed policy, and — where policy
    required it — carries a `granted` approval bound to its exact
    `requestDigest`.
22. Every tool call carries its `requestId`, committed before dispatch for
    mutations, and that value is never rewritten — a re-dispatch reuses it.
23. At most one mutating call per run is in state `dispatched` at any time.
24. The model never supplies `requestId`, `origin`, or `actorId`; the gateway
    strips any it finds and injects its own.
