# Agents — canonical model

## Aggregate and authority boundary

Agents owns one durable aggregate, the **task**, and everything reachable from
it: goals, runs, work units, exchange messages, questions, approvals, and tool
call records. Project ID selects the runtime and store at construction; neither
project nor user identity appears in canonical Agent values.

The aggregate's authority is deliberately narrow. A task is authoritative about
*what was asked, what was frozen, what was attempted, and what came back*. It is
never authoritative about the effect of a mutation — the owning capability's
revision is. Agents stores a reference to that effect, not a copy of it.

## The four-level hierarchy

```text
Task        durable, revisioned. The whole engagement. Never deleted.
 ├─ Goal[]  the decomposition tree. What we are trying to achieve, and how it
 │          breaks down. Objectives at the top, actionable goals at the leaves.
 ├─ exchange[]   append-only, seq-ordered. The only channel between person and agent.
 └─ Run[]   one continuous attempt at the task. Survives steering; ends on
            settlement, failure, or cancellation.
      └─ WorkUnit[]   the atomic committed unit.
                      decompose | sequence | act | verify | settle
```

Three of these four are durable records that outlive the process. The fourth —
the run — is disposable: a failed run does not fail the task, and a new run
resumes over the same goals and the accumulated exchange.

**The work unit is the atomic unit of everything.** It is the thing that
commits, the thing steering is checked between, the thing recovery resolves, and
the thing the audit trail is made of.

Reads are **not** work units. A `decompose`, `sequence`, or `verify` unit is one
model call with read tools bound, and the model reads as much as it needs inside
that call's tool loop — bounded by configuration, but otherwise its own
judgement. Only **mutations** are planned, sequenced, and committed one per
unit, because only mutations change the world.

The word *job* is reserved for the platform's scheduling primitive
(`0-utils/jobs`). A work unit is a durable domain record; a job is the mechanism
that executes one. The two are not the same noun and the design never conflates
them.

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
  /** Matches ActivityOrigin. Prose says "operator"; the wire value is "user". */
  readonly kind: "user" | "automation";
  /** Present only for automation origin; correlates the settlement notification. */
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
  readonly personaId: string;             // denormalised
  readonly personaRevision: number;       // denormalised — see below
  readonly policy: AgentToolPolicy;       // frozen; see tools.md
  readonly limits: AgentLimits;           // frozen; config defaults + overrides
  /**
   * Exactly one Context reference, or absent for the whole project.
   * A caller expressing "everything except X" composes that context first;
   * a list of entries can only ever union. See "One context entry" below.
   */
  readonly contextEntry?: ContextEntry;

  // ── Immutable once pinned, before the first model call ────────────────
  /** Absent until the task's first run pins it. See execution.md. */
  readonly scope?: KnowledgeScopeManifest;
  readonly scopePinnedAt?: string;

  // ── Maintained projection, written by the same transactions ───────────
  readonly attention?: AgentAttention;
  readonly headSeq: number;               // highest exchange sequence written
  readonly result?: AgentTaskResult;      // present exactly when terminal

  readonly createdAt: string;
  readonly updatedAt: string;
  readonly settledAt?: string;
}

interface AgentTaskResult {
  readonly outcome: "completed" | "partial" | "failed" | "cancelled";
  readonly summary: string;           // safe prose; no provider trace
  readonly unmet?: readonly string[]; // what was not achieved, for "partial"
  readonly failureCode?: string;      // machine-readable, for "failed"
}
```

### Persona is pinned by revision, not by digest

`(personaId, personaRevision, snapshot.sections)` fully determines the prompt a
task received. Persona's revision starts at 1 and increments by exactly one per
accepted update; the built-in is revision 0 and can never be written.

Persona also exposes `definitionDigest` and `promptDigest`. Neither is stored as
a task column. `definitionDigest` deliberately excludes `displayName` and
`description`, so it answers "did the behaviour change" while revision answers
"did the record change at all" — and for "which tasks ran which version of this
persona", revision is the coarser, simpler, and correct granularity.
`promptDigest` varies with section selection at a fixed revision, which the
stored `sections` list already captures. Both digests remain inside
`persona_json` for anyone who wants them; nothing indexes or compares them.

### One context entry, not a list

A task carries **at most one** `ContextEntry`. Absent means the whole project.

The reason is expressiveness, not tidiness. A list of entries can only ever
union — there is no way to say *"the whole project except this document"* by
enumerating entries. Exclusion is expressible only *inside* a Context, through
`POST /contexts/difference`, which persists the composed result as a named
context. So the caller composes what it wants first and hands Agents the single
reference.

This makes the caller's job explicit and Agents' job trivial: it never composes,
never reasons about set algebra, and never has to decide what a list of five
entries was supposed to mean.

The persona may contribute one further entry — its own private Context wrapper,
carried on the snapshot. Agents unions that with the task's entry when it
resolves the scope, following Persona's "union only" law. A persona can add
reference material; it can never narrow a task's scope.

### The four frozen inputs

`objective`, `persona`, `policy`, and `scope` are written once and never change.
This is the same freeze Derived Outputs performs before an expensive refresh,
and it exists for the same reason: work in flight must not shift underneath
itself.

Three are written in the creation transaction. **`scope` is pinned by the task's
first run**, because resolving a whole-project scope is unbounded work and
creation runs on the backend's single serial slot — the full argument is in
[execution.md](execution.md). The guarantee is unchanged in substance:

> Every input a task runs against is frozen **before its first model call**, and
> immutable for the rest of the task's life.

Consequences worth stating plainly, because each is a support request waiting to
happen if it is not designed for:

- **Editing a persona does not change a running task.** The task holds the
  rendered prompt, not a pointer.
- **Widening a task's scope requires a new task.** There is no "add a source
  mid-flight" command. Steering directs attention within the material a task was
  given; it cannot grant new material.
- **Granting a tool mid-flight is likewise impossible.** A task's blast radius
  is knowable from its creation record alone, forever.
- **A pinned scope pins membership, not content.** `resolvedSourceIds` is fixed;
  the windows behind those sources are not. A Connector sync or a General File
  replacement mid-task changes what retrieval returns. **This is accepted and
  expected** — an agent working on live project material should see live project
  material. Retrieval is always against current content; there is no
  revision-qualified search.

### State machine

```text
                    ┌────────────────────────────────┐
                    ▼                                │
  create ──► queued ──► running ──► waiting ─────────┘
                          │            │      (answer / approval / steering
                          │            │       resumes the run)
                          ▼            ▼
                   completed | partial | failed | cancelled     (terminal)
```

- `queued → running` when a run starts.
- `running → waiting` when a work unit opens a required question or requests an
  approval. `attention` is set in the same transaction.
- `waiting → running` when the blocking item is resolved. `attention` is cleared
  in the same transaction. **The same run resumes** — a person answering a
  question does not start a new attempt.
- `running → terminal` when the run's settle unit commits.
- Any non-terminal state `→ cancelled` at the next work-unit boundary.
- **Terminal states are absorbing.** No command reopens a settled task. A
  follow-up is a new task; the old exchange stays readable.

### `state` and `attention` are a maintained projection

Whether a task is blocked is fully derivable: it is blocked exactly when it has
an open required question or a pending approval, and both tables carry partial
indexes over precisely those predicates.

So `state` and `attention` are a **denormalised projection**, not an independent
authority. The questions and approvals tables are authoritative; the task
columns are maintained in the same transaction as every write that could change
the answer, because `task.attention` is the list a person works from and a join
per row would not do. Recovery recomputes them and logs any drift.

## Goals — the decomposition tree

A task's objective is prose. Goals are what the agent turns it into, and they
are durable so a restart does not re-derive them and a person can see the plan
before it is executed.

```ts
type AgentGoalState =
  | "pending"    // declared, not started
  | "active"     // currently being worked — it or its subtree
  | "achieved"   // its expectation was verified as met
  | "blocked"    // needs a person; the task is waiting
  | "abandoned"; // judged unreachable, or dropped by steering

interface AgentGoal {
  readonly id: string;
  readonly taskId: string;
  /** Absent for a top-level objective derived directly from the task. */
  readonly parentGoalId?: string;
  readonly depth: number;             // 0 for top-level; bounded by maxGoalDepth
  readonly ordinal: number;           // order among siblings
  readonly statement: string;         // what this goal is

  /**
   * What the agent expects to observe when this goal is met. Written when the
   * goal is declared, checked by a verify unit. This is what makes "did it
   * work" a question with an answer rather than the agent grading its own
   * homework in prose.
   */
  readonly expectation: string;

  /**
   * What the agent observed to be true when it planned this goal's sequence.
   * Written by the sequence unit. The pair (observedState → expectation) is the
   * transition the sequence is supposed to produce, and it is what a verify
   * unit re-reads against.
   */
  readonly observedState?: string;

  readonly state: AgentGoalState;
  readonly createdByUnitId: string;
  readonly settledByUnitId?: string;
  /** Bounded re-planning; see AgentLimits. */
  readonly sequenceAttempts: number;
  readonly decomposeAttempts: number;
  readonly verifyAttempts: number;
  readonly createdAt: string;
  readonly settledAt?: string;
}
```

### Two kinds of breakdown, and the difference between them

The tree has exactly two edges, and conflating them is what makes agent loops
mushy:

| Breakdown | Question it answers | Produces | Unit |
| --- | --- | --- | --- |
| **Decompose** | *what has to be true?* | child **goals**, each with its own expectation | `decompose` |
| **Sequence** | *what do I do to make it true?* | an ordered list of **mutations** | `sequence` |

A decompose is "this objective is really these three objectives". A sequence is
"given what I now observe, these four mutations take us from here to the
expectation". The first produces more nodes; the second produces the leaves'
actual work.

**Reads are not in either list.** A sequence unit reads as much as it needs
*while deciding*, inside its own model call. Reads do not change the world, so
they do not need to be planned, approved, ordered, or recovered. Only mutations
are sequenced.

### The traversal: build down, resolve up

The tree is walked depth-first, and the walk is **derived, never stored**:

```text
activeGoal = the first goal in depth-first pre-order whose state is
             pending or active, and which has no pending or active children
```

That is the deepest, leftmost unfinished node. Everything the runner does next
follows from one further question:

```text
does the active goal have children?
  ├─ no   → it is a leaf: DECOMPOSE it (if it is too big to sequence)
  │                        or SEQUENCE it, then ACT, then VERIFY
  └─ yes  → all its children are done: VERIFY it
```

When a leaf is verified `achieved`, re-deriving the cursor finds the next
pending sibling; when there are none, the parent becomes the deepest unfinished
node and gets its own verify. That is "resolve up", and it falls out of the same
one-line rule rather than needing a stack.

**Verification happens at every level**, not only at the leaves. A parent whose
children all succeeded can still fail its own expectation — three sub-goals each
achieved, and the thing they were supposed to add up to did not happen. That is
exactly the failure a person would catch, and it is the failure a flat action
list cannot express.

Deriving the cursor rather than storing it means there is no cursor to drift, no
column to reconcile at recovery, and no way for the traversal to disagree with
the goal states. The tree is bounded by `maxGoalsPerTask`, so walking it in
memory is cheap.

### Why decomposition does not spiral

Left alone, a model asked to decompose will happily decompose forever. Five
bounds stop it, and they are deliberately independent:

1. **`maxGoalDepth`.** At the bound, the decompose option is **not offered** —
   the structured-output schema for a leaf at maximum depth admits only
   `sequence`, `blocked`, or `abandon`. A model cannot choose what it cannot
   emit.
2. **`maxDecomposeAttemptsPerGoal`** (default 2). A goal that already has
   children is never decomposed again by the traversal, because it is no longer
   a leaf. The counter only rises when a failed verify sends it back for
   re-decomposition.
3. **`maxConsecutivePlanningUnits`** (default 2). Two planning units — decompose
   or sequence — in a row with no `act` between them forces the next unit to
   produce at least one action, or the goal is `blocked` with a question. This
   is the direct guard against "spent the whole run planning".
4. **`maxGoalsPerTask`.** A hard ceiling on the tree.
5. **The prompt states the rule.** Decompose *only* if no bounded sequence of
   the tools this task actually holds can reach the goal. The tools it holds are
   listed in the same prompt, so the judgement is grounded rather than abstract.

Bounds 1 and 3 are the load-bearing ones. The first makes runaway depth
unrepresentable; the second makes runaway breadth expensive within one unit
rather than invisible across many.

## Exchange

The exchange is the append-only, sequence-ordered timeline shared by the person
and the agent. It is the only channel between them; there is no side-band
control path.

```ts
type AgentMessageKind =
  | "objective"        // seq 1, written at creation
  | "progress"         // agent-authored safe summary of what it is doing
  | "plan"             // agent-authored: this is how I intend to break this down
  | "question"         // agent asks; may be required
  | "answer"           // operator answers a specific question
  | "steering"         // operator adds direction mid-flight
  | "approvalRequest"  // agent requests permission for one mutation
  | "approval"         // operator grants or denies that mutation
  | "result"           // agent's settlement summary
  | "system";          // runtime-authored notice (units superseded, run retried)

/** Identical to ActivityOrigin, deliberately — agent-caused changes land there. */
type AgentAuthorKind = "user" | "agent" | "automation" | "system";

interface AgentMessage {
  readonly id: string;
  readonly taskId: string;
  /** Absent for operator-authored messages arriving between work units. */
  readonly runId?: string;
  readonly unitId?: string;
  readonly seq: number;              // strictly increasing, contiguous from 1
  readonly kind: AgentMessageKind;
  readonly author: { readonly kind: AgentAuthorKind; readonly id?: string };
  /**
   * For operator-authored messages: the task's headSeq when this was written.
   * Answers "what had the agent said when the person typed this?", which is
   * what makes a steering message legible after the fact.
   */
  readonly inResponseToSeq?: number;
  readonly content: AgentMessageContent;   // discriminated on kind
  readonly createdAt: string;
}
```

### The agent narrates as it works

`progress` and `plan` messages are not decoration — they are the mechanism that
makes steering possible. **A person steers what they can see.** Every planning unit
writes what it decided and why; every act unit writes what it changed; a planning
unit writes what it was looking for when the answer changed the plan.

The rule that keeps this useful rather than noisy: a message is written when the
*agent's intent or the world* changed, not per model round trip. A retrieval
that confirmed what the agent already believed is a work unit row, not an
exchange message.

### What a work unit consumed

```ts
interface AgentWorkUnit {
  readonly consumedThroughSeq: number;  // the exchange prefix this unit was given
  // …
}
```

Each work unit records the exchange prefix it saw. This is the same
"what did it actually look at?" guarantee the earlier design put on runs, moved
down to the level where it is both cheaper and more useful — a person asking
"did it see my message?" gets an answer at the granularity of the individual
action, not the whole attempt.

Because units are small, the answer is nearly always yes, and where it is no the
unit that missed it is identifiable.

## Runs

```ts
type AgentRunStatus =
  | "queued" | "running" | "succeeded" | "failed" | "cancelled";

interface AgentRun {
  readonly id: string;
  readonly taskId: string;
  readonly attempt: number;             // 1-based, unique per task
  readonly status: AgentRunStatus;
  readonly result?: AgentRunResult;
  readonly failureCode?: string;
  readonly usage: Usage;                // accumulated across the run's model calls
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly settledAt?: string;
}
```

A run is **one continuous attempt at the task**. It spans many work units, many
goals, and any number of pauses for a person. It ends only on settlement,
failure, or cancellation.

A run has no `waiting` status. When a work unit opens a required question, the
*task* becomes `waiting` and the run stays `running` with nothing dispatched;
answering resumes the same run. Blocking is a property of the task, not of an
attempt, and keeping it off the run avoids a second place where "who are we
waiting on" can disagree.

**Steering does not end a run.** This is the change from the earlier design,
and it is the point: steering interrupts the *work unit*, not the attempt. A run
ends when the work is over or has failed, not because a person had something to
say.

A failed run does not fail the task. Retry is a new run over the same goals, the
same frozen inputs, and the accumulated exchange, bounded by `maxRunsPerTask`.

## Work units

```ts
type AgentWorkUnitKind =
  | "decompose"  // one model call: break a goal into child goals
  | "sequence"   // one model call: observe, then order the mutations for a goal
  | "act"        // one mutating command against one capability
  | "verify"     // one model call: re-observe, compare against the expectation
  | "settle";    // the run's own settlement

/** Why this unit exists. Audit legibility without a sixth kind. */
type AgentWorkUnitTrigger =
  | "planned"      // the traversal asked for it
  | "steering"     // a person redirected
  | "refusal"      // policy or a person denied a mutation
  | "verification" // a verify came back not-met
  | "recovery";    // the reconciliation sweep asked for it

type AgentWorkUnitState =
  | "queued"      // act only: sequenced, not yet reached
  | "started"
  | "succeeded"
  | "failed"
  | "superseded"  // planned but never run: steering or a refusal re-planned first
  | "dispatched"  // act only: sent to the target, outcome not yet recorded
  | "rejected";   // act only: refused by policy or by a person

interface AgentWorkUnit {
  readonly id: string;
  readonly runId: string;
  readonly taskId: string;
  readonly unitSeq: number;             // 1-based, contiguous within the run
  readonly kind: AgentWorkUnitKind;
  readonly trigger: AgentWorkUnitTrigger;
  readonly state: AgentWorkUnitState;
  readonly goalId?: string;             // which goal this served
  readonly consumedThroughSeq: number;  // the exchange prefix this unit saw
  /** Why the agent did this, in its words. Preserved even when superseded. */
  readonly rationale?: string;
  readonly safeSummary?: string;
  /** Which versioned prompt produced this unit's model call. */
  readonly promptVersion?: string;
  /** Non-mutating tool calls made inside this unit's model loop. */
  readonly readCount?: number;
  readonly usage?: Usage;
  readonly createdAt: string;
  readonly settledAt?: string;
}
```

**Sequenced mutations exist as `act` units in state `queued`.** The pending plan
is rows, not memory. That is what lets a person see what the agent is *about* to
do, what lets steering rewrite it, and what lets a restart resume it.

### Superseded, not abandoned

When steering or a refusal changes the plan, the queued `act` units become
`superseded` — and their `rationale` is carried into the model input of the
`sequence` unit that replaces them.

This is the difference between *interrupting* and *discarding*. The agent had a
reason for each queued mutation and an expectation it was working toward; a
person redirecting it usually means "also do this" or "do that part
differently", not "forget everything you were going to do". So the re-planning
unit is handed the goal, its expectation, what has already been done, the
sequence that was pending with each rationale, and the steering message — and
asked to produce an amended sequence.

Steering is therefore best understood as **an adjustment to the decomposition**,
not an interruption of it: inject a goal, re-order the remaining mutations, or
escalate to the parent. See [execution.md](execution.md).

What is **not** carried is partial work product. There is none — see the act
unit below.

## Tool calls

Every call through the gateway is recorded, read or mutation. They differ in
where they sit: an `act` unit holds **exactly one mutating call**, while a
`decompose`, `sequence`, or `verify` unit holds **any number of reads** made
inside its model loop.

```ts
interface AgentToolCall {
  readonly id: string;
  readonly taskId: string;
  readonly runId: string;
  readonly unitId: string;
  readonly mutating: boolean;
  readonly endpointKey: string;         // "POST /documents/command"
  readonly resourceKind?: string;       // "document"
  readonly resourceId?: string;         // extracted for policy scoping
  readonly request: unknown;            // exact body as dispatched
  /**
   * `agent:<toolCallId>` — minted here and committed before dispatch. The
   * target's own receipt is keyed on it, which is what makes recovery a replay
   * rather than a guess. Separate from requestDigest.
   */
  readonly requestId: string;
  /** Binds an approval to these exact arguments. Not used for idempotency. */
  readonly requestDigest: string;
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
  /**
   * Opaque target-side correlation id — a Document ChangeSet id, a source
   * transaction id, whatever that capability calls its accepted change.
   */
  readonly targetRef?: string;
  readonly errorCode?: string;
}
```

Read calls carry `requestId` too — the gateway mints one for every call — but
nothing depends on replaying a read, so it exists for correlation rather than
idempotency. Reads are also exempt from approval and from `maxMutations`; the
only bounds on them are `maxReadToolRoundsPerUnit` and `maxReadsPerUnit`, and
inside those the agent reads as much as it judges useful. **Reads do not change
the world, so they do not need to be planned, ordered, approved, or recovered.**

### One mutation per act unit, and why there is never leftover work

A mutating command at every target in this codebase is **atomic and revisioned**
— one `document.command`, one transaction, one revision. It either committed or
it did not; there is no half-applied state to clean up.

So with one mutation per act unit:

- **Steering before dispatch** supersedes the unit. Nothing happened.
- **Steering after dispatch** finds a committed change at the target. It is
  recorded, it is real, and the next sequence unit sees it as current state and
  plans forward from there.

That second case is the whole reason steering does not need an undo path: the
agent is always planning a transition *from the current state*, so a landed
mutation is simply part of the state the amended sequence starts from.

There is no third case, and therefore no "mid-edit" to unwind. This is what
makes the copy-on-write alternative — mutate a shadow resource, translate it
into the real one at unit completion — unnecessary rather than merely expensive.
Shadowing would require every target capability to support a duplicate-and-merge
protocol, which is a large amount of machinery to protect against a state the
model cannot enter.

**Retraction is a separate question from interruption.** If a landed mutation
turns out to be unwanted, that is undo, and undo belongs to the target: Document
already has `document.compensate` with generated inverse operations and
touched-ID conflict admission. Agents can *call* it as an ordinary mutation if a
future design wants agent-initiated retraction. It is not part of steering,
because "stop doing that" and "unmake what you did" are different instructions
and conflating them makes the second one happen by accident.

### Dual recording

A single effect is recorded in two places, on purpose:

```text
Agents          agent_tool_calls        what was asked for, by whom, under what approval
target capab.   its own accepted change what actually happened, with agent attribution
```

Neither is derivable from the other. The Agents row answers "why did this happen
and who allowed it"; the target's row answers "what is now true". **A rejected or
refused call exists only in the Agents row**, which is exactly the audit trail
you want when asking what an agent *tried* to do.

Two links, doing different jobs:

- **`requestId`** (`agent:<toolCallId>`) is the one the *target* holds, on its
  own receipt. It is what makes a re-dispatch a replay.
- **`targetRef`** is the one *Agents* holds. It is a copied value that must
  survive target-side history compaction — the same requirement Activity places
  on its outbox rows.

## Questions and approvals

```ts
type AgentQuestionState = "open" | "answered" | "withdrawn";

interface AgentQuestion {
  readonly id: string;
  readonly taskId: string;
  readonly goalId?: string;            // which goal is blocked, when one is
  readonly messageId: string;          // the "question" message that opened it
  readonly state: AgentQuestionState;
  readonly required: boolean;          // only required questions block
  readonly answerMessageId?: string;
  readonly openedAt: string;
  readonly closedAt?: string;
}
```

- A required open question blocks the task; an optional one does not. Optional
  questions are the agent saying "this would help"; the next unit proceeds
  without them and may withdraw them if they stop mattering.
- **A required open question accepts exactly one canonical answer.** A second
  answer is rejected, not appended — schema-enforced, so it cannot happen even
  by a bug. Ambiguity about which answer the agent acted on is not recoverable
  after the fact.
- Settling a task withdraws every still-open question in the same transaction.

```ts
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

- **An approval is bound to the exact request digest of its call.** Granting
  authorises those arguments and no others; a re-proposal with different
  arguments is a new call requiring a new approval. Without this the gate is
  theatre.
- Denial does not fail the run. The call is recorded `rejected`, the denial
  enters the exchange, and the next sequence unit sees the refusal and chooses
  differently.
- When both a required question and a pending approval exist, `attention`
  reports `"question"` — questions are usually cheaper to answer and often make
  the approval decision obvious.

## Invariants

**Task**

1. `objective`, `origin`, `actorId`, `persona`, `personaId`, `personaRevision`,
   `policy`, `limits`, and `contextEntry` never change after creation.
2. `scope` and `scopePinnedAt` are absent together or present together; once
   present they never change; and they are present before any model call.
3. `revision` increases by exactly one per accepted control command.
4. `attention` is present iff `state === "waiting"`, and agrees with the
   questions and approvals tables, **which are authoritative**.
5. `result` and `settledAt` are present iff `state` is terminal.
6. Terminal states are absorbing.

**Exchange**

7. `seq` is contiguous from 1 and strictly increasing.
8. Messages are never edited or deleted.
9. `headSeq` equals the highest `seq` written for the task.
10. An operator-authored message carries `inResponseToSeq`.

**Goals**

11. `depth` is `0` for a goal with no parent, and `parent.depth + 1` otherwise,
    bounded by `limits.maxGoalDepth`.
12. Every goal carries a non-empty `expectation` from the moment it is declared.
13. A goal's `state` is terminal (`achieved`, `abandoned`) only via a work unit,
    recorded in `settledByUnitId`, and only a `verify` unit may write
    `achieved`.
14. A goal with children is never sequenced; a goal without children is never
    verified before it has been sequenced at least once.
15. The active goal is **derived**, never stored: the first goal in depth-first
    pre-order that is `pending` or `active` and has no `pending` or `active`
    children.
16. A task settles only when every top-level goal is terminal, or the run
    settles it explicitly with `partial` / `failed`.

**Runs**

17. `attempt` is unique per task and increases by one.
18. At most one run per task is `queued` or `running`.
19. A run's status never becomes `waiting`; the task carries that state.

**Work units**

20. `unitSeq` is contiguous from 1 within a run; `(runId, unitSeq)` is unique.
21. A work unit is committed before its continuation is dispatched.
22. A superseded work unit retains its `rationale`, and that rationale is
    supplied to the unit that replaces it.
23. Every `act` unit reaching `dispatched` passed policy, and — where policy
    required it — carries a `granted` approval bound to its exact
    `requestDigest`.
24. Every tool call carries its `requestId`, committed before dispatch for
    mutations, and that value is never rewritten — a re-dispatch reuses it
    verbatim.
25. At most one `act` unit per run is in state `dispatched` at any time.
26. An `act` unit holds exactly one mutating tool call. A `decompose`,
    `sequence`, or `verify` unit holds zero mutating tool calls and any number
    of reads.
27. No two consecutive committed units are both planning units (`decompose` or
    `sequence`) more than `maxConsecutivePlanningUnits` times in a row.

**Questions and approvals**

28. A required question accepts exactly one answer.
29. An approval authorises exactly one `requestDigest`.
30. Settling a task withdraws all open questions and pending approvals in the
    same transaction.
