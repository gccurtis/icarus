# Agents — canonical model

## Aggregate and authority boundary

Agents owns one durable aggregate, the **task**, and everything reachable from
it: runs, steps, exchange messages, questions, approvals, and tool call records.
Project ID selects the runtime and store at construction; neither project nor
user identity appears in canonical Agent values.

The aggregate's authority is deliberately narrow. A task is authoritative about
*what was asked, what was frozen, what was proposed, and what came back*. It is
never authoritative about the effect of a tool call — the owning capability's
revision is. Agents stores a reference to that effect, not a copy of it.

## Task

```ts
type AgentTaskState =
  | "queued"     // created; no run has started
  | "running"    // a run is in flight
  | "waiting"    // blocked on a person
  | "completed"  // objective met
  | "partial"    // settled, objective partly met
  | "failed"     // settled, objective not met
  | "cancelled"; // settled by operator request

type AgentAttention = "question" | "approval";

interface AgentOrigin {
  readonly kind: "operator" | "automation";
  /** Present only for automation origin; correlates the settlement intent. */
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
  readonly persona: PersonaSnapshot;         // frozen, from #persona
  readonly scope: KnowledgeScopeManifest;    // frozen, from knowledge.resolveScope
  readonly policy: AgentToolPolicy;          // frozen; see tools.md

  // ── Derived, maintained by settlement ─────────────────────────────────
  /** Why a person is being waited on. Present exactly when state is "waiting". */
  readonly attention?: AgentAttention;
  /** Highest exchange sequence written. */
  readonly headSeq: number;
  /** Safe settlement summary. Present exactly when state is terminal. */
  readonly result?: AgentTaskResult;

  readonly createdAt: string;
  readonly updatedAt: string;
  readonly settledAt?: string;
}

interface AgentTaskResult {
  readonly outcome: "completed" | "partial" | "failed" | "cancelled";
  readonly summary: string;          // safe prose; no provider trace
  readonly unmet?: readonly string[]; // what was not achieved, for "partial"
  readonly failureCode?: string;      // machine-readable, for "failed"
}
```

### The four frozen inputs

`objective`, `persona`, `scope`, and `policy` are written once at creation and
never change. This is the same freeze Derived Outputs performs when it pins a
definition revision, context digest, and Knowledge generation before an
expensive refresh, and it exists for the same reason: work in flight must not
shift underneath itself.

The consequences are worth stating plainly, because each is a support request
waiting to happen if it is not designed for:

- **Editing a persona does not change a running task.** The task holds the
  rendered prompt, not a pointer.
- **Widening a task's scope requires a new task.** There is no "add a source
  mid-flight" command. Steering can tell the agent what to prioritise within
  its scope; it cannot grant new material.
- **Granting a tool mid-flight is likewise impossible.** A task that needs a
  capability it was not given must be superseded, not amended. This is a
  deliberate cost: a task's blast radius is knowable from its creation record
  alone, forever.

### State machine

```text
                    ┌────────────────────────────────┐
                    ▼                                │
  create ──► queued ──► running ──► waiting ─────────┘
                          │            │      (answer / approval / steer
                          │            │       enqueues the next run)
                          │            │
                          ▼            ▼
                   completed | partial | failed | cancelled     (terminal)
```

- `queued → running` when a run starts.
- `running → waiting` when a run settles having opened a required question or
  requested an approval. `attention` is set in the same transaction.
- `waiting → running` when the blocking item is resolved *and* the next run is
  admitted. `attention` is cleared in the same transaction.
- `running → terminal` when a run settles the task.
- Any non-terminal state `→ cancelled` on operator cancel, at the next step
  boundary. See [execution.md](execution.md) for what happens to a tool call
  that is already dispatched.
- **Terminal states are absorbing.** No command reopens a settled task. A
  follow-up is a new task; the exchange of the old one remains readable.

`waiting` is a task-level state rather than a run-level one because it describes
the *task's* need for a person, and it must survive the run that discovered it.

## Exchange

The exchange is the append-only, sequence-ordered timeline shared by the person
and the agent. It is the only channel between them; there is no side-band
control path.

```ts
type AgentMessageKind =
  | "objective"        // seq 1, written at creation
  | "progress"         // agent-authored safe summary
  | "question"         // agent asks; may be required
  | "answer"           // operator answers a specific question
  | "steering"         // operator adds direction mid-flight
  | "approvalRequest"  // agent requests permission for one tool call
  | "approval"         // operator grants or denies that call
  | "result"           // agent's settlement summary
  | "system";          // runtime-authored notice (e.g. run failed, retrying)

type AgentAuthorKind = "operator" | "agent" | "automation" | "system";

interface AgentMessage {
  readonly id: string;
  readonly taskId: string;
  /** Absent for operator-authored messages arriving between runs. */
  readonly runId?: string;
  readonly seq: number;              // strictly increasing, contiguous from 1
  readonly kind: AgentMessageKind;
  readonly author: { readonly kind: AgentAuthorKind; readonly id?: string };
  readonly content: AgentMessageContent;   // discriminated on kind
  readonly createdAt: string;
}
```

### The consumed-prefix rule

This is the single most load-bearing rule in the model, and everything about
mid-flight interaction falls out of it.

```ts
interface AgentRun {
  readonly consumedThroughSeq: number;  // the exchange prefix this run was given
  // …
}
```

A run is handed the exchange **up to and including** `consumedThroughSeq` and
never sees anything appended after. When it settles, the next run is created
with a `consumedThroughSeq` equal to the task's current `headSeq`, so everything
appended in the meantime is picked up exactly once.

That is the whole mechanism. It means:

- **Steering needs no interrupt.** An operator appends a `steering` message
  whenever they like. The in-flight run does not see it; the next run does.
- **Answers and approvals are ordinary messages.** They arrive the same way,
  and are consumed the same way.
- **Replay is exact.** Re-running a run over the same prefix produces the same
  input, because the prefix is immutable and the four task inputs are frozen.
- **No message is consumed twice, and none is skipped**, because prefixes are
  contiguous and each run's start is the previous run's end.

The cost is latency: steering appended one millisecond after a run starts waits
for that run to finish. That is accepted. The alternative — interrupting a run
mid-model-call — would make "what did this run see?" unanswerable, and that
question has to stay answerable for the record to be worth keeping.

### Message ordering

`seq` is allocated under the task's serial command lane and is contiguous from
1. Contiguity is not merely cosmetic: the consumed-prefix rule uses `seq`
arithmetic to define "everything since", so a gap would silently widen or narrow
a run's input.

## Questions

```ts
type AgentQuestionState = "open" | "answered" | "withdrawn";

interface AgentQuestion {
  readonly id: string;
  readonly taskId: string;
  readonly messageId: string;         // the "question" message that opened it
  readonly state: AgentQuestionState;
  /** A required question blocks the task; an optional one does not. */
  readonly required: boolean;
  readonly answerMessageId?: string;  // the "answer" message that closed it
  readonly openedAt: string;
  readonly closedAt?: string;
}
```

Invariants:

- A question is `open` with no answer and no close time, `answered` with both,
  or `withdrawn` with a close time and no answer.
- **A required open question accepts exactly one canonical answer.** A second
  answer to the same question is rejected, not appended. Ambiguity about which
  answer the agent acted on is not recoverable after the fact.
- A task is `waiting` with `attention: "question"` if and only if it has at
  least one open required question.
- Optional questions never block. They are the agent saying "this would help";
  the next run proceeds without them and may withdraw them if they stop
  mattering.
- Settling a task withdraws every still-open question in the same transaction.

## Approvals

An approval is structurally a question about one specific tool call, and it is
modelled separately only because it references a call and carries a verdict.

```ts
interface AgentApproval {
  readonly id: string;
  readonly taskId: string;
  readonly toolCallId: string;        // exactly one call
  readonly requestMessageId: string;
  readonly state: "pending" | "granted" | "denied" | "withdrawn";
  readonly decisionMessageId?: string;
  readonly requestedAt: string;
  readonly decidedAt?: string;
}
```

- A pending approval sets the task `waiting` with `attention: "approval"`.
- **An approval is bound to the exact request digest of its call.** Granting
  approval for a call authorises those arguments and no others; a re-proposal
  with different arguments is a new call requiring a new approval. Without this
  the gate is theatre.
- Denial does not fail the task. The denied call is recorded as `rejected`, the
  denial enters the exchange, and the next run sees that it was refused and may
  choose differently.
- Settling withdraws every pending approval.

When both a required question and a pending approval exist, `attention` reports
`"question"`. Questions are usually cheaper to answer and often make the
approval decision obvious.

## Runs and steps

```ts
type AgentRunStatus =
  | "queued" | "running" | "succeeded" | "failed" | "cancelled";

interface AgentRun {
  readonly id: string;
  readonly taskId: string;
  readonly attempt: number;             // 1-based, unique per task
  readonly status: AgentRunStatus;
  readonly consumedThroughSeq: number;  // immutable once created
  readonly result?: AgentRunResult;
  readonly failureCode?: string;
  readonly usage: Usage;                // accumulated across the run's calls
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly settledAt?: string;
}
```

A run has no `waiting` status. If a run discovers it needs a person, it *settles
as `succeeded`* having opened a question or requested an approval, and the
**task** becomes `waiting`. Runs are attempts at advancing the task; blocking is
a property of the task, not of an attempt. Keeping `waiting` off the run avoids
a second place where "who are we waiting on" can disagree.

```ts
type AgentStepKind =
  | "reason"      // one model call
  | "retrieve"    // one Knowledge retrieval
  | "tool"        // one tool call, dispatched and settled
  | "settle";     // the run's own settlement

interface AgentStep {
  readonly id: string;
  readonly runId: string;
  readonly stepSeq: number;          // 1-based, contiguous within the run
  readonly kind: AgentStepKind;
  readonly state: "started" | "succeeded" | "failed" | "cancelled";
  readonly safeSummary?: string;
  readonly inputDigest?: string;
  readonly outputDigest?: string;
  readonly usage?: Usage;
  readonly createdAt: string;
  readonly settledAt?: string;
}
```

**`(runId, stepSeq)` is the idempotency key for the entire execution path.** A
continuation that arrives twice — a duplicate dispatch, a restart replaying
work — finds the step already settled and returns its recorded outcome instead
of doing it again. There is no separate stage-receipt table; the step row is the
receipt, which keeps one mechanism where the older model had two.

## Tool calls

```ts
type AgentToolCallState =
  | "proposed"          // the model asked for it; policy not yet applied
  | "awaitingApproval"  // policy requires a person
  | "rejected"          // policy or a person refused it
  | "dispatched"        // sent to the owning capability
  | "succeeded"
  | "failed";

interface AgentToolCall {
  readonly id: string;
  readonly taskId: string;
  readonly runId: string;
  readonly stepId?: string;
  readonly callSeq: number;             // 1-based within the run
  readonly target: { readonly kind: string; readonly id?: string };
  readonly commandName: string;         // e.g. "document.command"
  readonly request: unknown;            // exact arguments as dispatched
  readonly requestDigest: string;
  readonly state: AgentToolCallState;
  readonly result?: AgentToolResultRef;
  readonly safeSummary?: string;
  readonly rejectionReason?: string;
  readonly createdAt: string;
  readonly settledAt?: string;
}

/** A reference to the target's authoritative record — never a copy of it. */
interface AgentToolResultRef {
  readonly ok: boolean;
  readonly targetRevision?: number;
  readonly changeSetId?: string;
  readonly errorCode?: string;
}
```

### Dual recording

A single effect is recorded in two places, on purpose:

```text
Agents          agent_tool_calls   what was asked for, by whom, under what approval
target capab.   its own ChangeSet  what actually happened, with agent attribution
```

Neither is derivable from the other. The Agents row answers "why did this
happen and who allowed it"; the target's row answers "what is now true". A
rejected or failed call exists only in the Agents row, which is exactly the
audit trail you want when asking what an agent *tried* to do.

The link between them is `AgentToolResultRef.changeSetId`. It is a copied value
that must survive target-side history compaction, the same requirement Activity
places on its outbox rows.

## Invariants

Task:

1. `objective`, `origin`, `actorId`, `persona`, `scope`, and `policy` never
   change after creation.
2. `revision` increases by exactly one per accepted control command.
3. `attention` is present if and only if `state === "waiting"`.
4. `result` and `settledAt` are present if and only if `state` is terminal.
5. Terminal states are absorbing.

Exchange:

6. `seq` is contiguous from 1 and strictly increasing.
7. Messages are never edited or deleted.
8. `headSeq` equals the highest `seq` written for the task.

Runs:

9. `attempt` is unique per task and increases by one.
10. At most one run per task is `queued` or `running`.
11. `consumedThroughSeq` is immutable, and equals the task's `headSeq` at the
    moment the run was created.
12. A run's `consumedThroughSeq` is greater than or equal to the previous run's.

Steps and tool calls:

13. `stepSeq` is contiguous from 1 within a run; `(runId, stepSeq)` is unique.
14. A step is committed before its continuation is dispatched.
15. Every tool call reaching `dispatched` passed policy, and — where policy
    required it — carries a `granted` approval bound to its exact
    `requestDigest`.
16. A tool call in a terminal state has `settledAt` set.

Questions and approvals:

17. A required question accepts exactly one answer.
18. An approval authorises exactly one `requestDigest`.
19. Settling a task withdraws all open questions and pending approvals in the
    same transaction.
