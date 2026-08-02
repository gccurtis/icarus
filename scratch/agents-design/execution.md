# Agents — execution

How a task actually advances: what is frozen, how an objective becomes work,
what is committed when, what steering changes, and what happens after a crash.

## Creation and freeze

Task creation is one serial job and one SQLite transaction. Everything expensive
happens outside the serial job entirely.

```text
POST /agents/command { type: "task.create", … }        [SERIAL]
  │
  ├─ 1. decode          exactKeys; unknown keys are a 400
  ├─ 2. resolve persona personas.resolve(personaId, { sections })
  ├─ 3. resolve limits  preset from config, then per-task overrides
  ├─ 4. validate policy every entry names an endpoint in the agent catalogue
  │
  └─ 5. ONE TRANSACTION
         ├─ insert task     state "queued", revision 1,
         │                  objective + persona + policy + limits frozen,
         │                  contextEntry stored verbatim, scope NOT yet pinned
         ├─ insert message seq 1  kind "objective"
         ├─ insert run attempt 1  status "queued"
         ├─ insert creation receipt (requestId → response)
         └─ stage outbox row  agent.task.created
      then, AFTER commit:
         └─ dispatch { type: "agents.run.start", runId, idempotencyKey }
```

Steps 2–4 can fail without leaving anything behind: an unknown persona, an
unknown limits preset, or a policy naming an endpoint the catalogue does not
expose are 400-class errors raised before any row exists.

**Dispatch happens after commit, never inside the transaction.** If the process
dies between the two, the run row is still `queued` and recovery finds it.
Durable state is the authority for what still needs doing; the in-memory queue
never is.

### Why the scope is pinned at first-run start, not at creation

`knowledge.resolveScope` with no entries — the default, meaning *the whole
project* — lists every source in the project and then issues one
`describeSource` lookup per source. That is unbounded work proportional to the
corpus.

The serial queue has **exactly one active slot for the entire backend**. Every
Document command, General File upload, Connector delete, Persona write, and
Template registration is queued behind it. Nothing currently on that queue does
unbounded work. Resolving a whole-project scope inside the creation job would
make Agents the first capability to hold the global write lock for as long as
the project is large.

So the run start pins it instead, on the **concurrent** queue:

```text
agents.run.start                                        [CONCURRENT]
  ├─ if task.scope is absent:
  │     entries = scopeEntriesFor(task, task.persona)
  │     scope   = knowledge.resolveScope(entries)
  │     TRANSACTION: write scope_json, scope_pinned_at   (CAS on task revision)
  │     log agents.scope.pinned
  └─ dispatch the first unit for the derived active goal
```

**The guarantee that matters is unchanged: the scope is frozen before the first
model call, and immutable for the life of the task.** What changes is the
wording — not "frozen at creation" but "frozen before the first model call",
which is exactly how Persona states the same law for its own snapshot
(*"persist before calling"*). Under a normal queue this is milliseconds; under
sustained backlog a task resolves the corpus as it stands when its run starts.

Pinning is idempotent under the task-revision CAS: a second attempt finds
`scope_json` present and skips it.

### The scope union

The task carries at most one `ContextEntry`; the persona may carry one more —
its own private Context wrapper. The union is formed here and nowhere else:

```ts
const scopeEntriesFor = (task, snapshot): ContextEntry[] => {
  // An absent task entry already means the whole project, which subsumes
  // anything the persona could reference. Adding the persona entry here would
  // narrow the task from everything to one context.
  if (!task.contextEntry) return [];
  return snapshot.context
    ? [task.contextEntry, snapshot.context]
    : [task.contextEntry];
};
```

Two rules are load-bearing:

- **Absent means the whole project**, and an absent task entry is *not* unioned
  with the persona's. `resolveScope([])` means everything; `resolveScope([X])`
  means only X. Appending the persona's entry to an empty scope would narrow it
  — the exact opposite of intent, and the failure is silent.
- **Union only.** A persona may add reference material; it may never narrow a
  task's scope. That is Persona's own law, and Persona cannot enforce it.

Exclusion — *"the whole project except this document"* — is not expressible by
enumerating entries and is not attempted here. The caller composes it first via
`POST /contexts/difference` and hands Agents the single resulting reference. See
[supplementary-changes.md](supplementary-changes.md) for what Context still owes
this story.

### The Persona consumer contract

Persona states six laws a consumer must keep and explicitly **cannot enforce any
of them**. Agents is its first consumer, so they are restated here as
requirements with the test that proves each.

| Persona law | How Agents keeps it | Test |
| --- | --- | --- |
| Resolve once per task, never per run | `personas.resolve` is called in `agentTaskService.create` and nowhere else | no `#persona` import outside that file |
| Persist before the first model call | The snapshot is written in the creation transaction | a task row always has `persona_json` |
| The fragment never precedes the contract | Model input is `[system: UNIT_PROMPT, system: snapshot.prompt, …]` | message-order assertion on the built input |
| Union only — never narrows scope | `scopeEntriesFor` above, with the absent-entry guard | absent task entry + persona context resolves to whole project |
| Never substitute silently | An unknown or deleted `personaId` is a 400 at creation, never a fallback | create with a deleted persona id raises `PersonaNotFoundError` |
| Never log section text | Logs carry `personaId`, `personaRevision`, `sections.length` only | captured-log scan finds no section text |

---

## The work loop

The loop has one shape, repeated at every level of the goal tree: **build down
until you can act, act, verify, resolve up.**

### The traversal rule

Everything the runner does next follows from two derived facts.

```text
activeGoal = the first goal in depth-first pre-order that is `pending` or
             `active` and has no `pending` or `active` children
```

```text
does the active goal have children?
  ├─ YES → every child is settled. VERIFY the parent.
  └─ NO  → it is a leaf.
            ├─ has queued act units?  → run the next one
            ├─ has been sequenced?    → VERIFY it
            └─ otherwise              → DECOMPOSE or SEQUENCE it
```

The cursor is **derived, never stored**. There is no column to drift, nothing to
reconcile at recovery, and no way for the traversal to disagree with the goal
states. The tree is bounded by `maxGoalsPerTask`, so walking it in memory is
cheap.

"Resolve up" is not a separate mechanism — when a leaf becomes `achieved`,
re-deriving the cursor finds the next pending sibling, and when there are none,
the parent is now the deepest unfinished node and gets its own verify.

### The four unit kinds

```text
        ┌─────────────────────────────────────────────────────────┐
        │ DECOMPOSE   goal → child goals                          │
        │   input:  the goal, its expectation, the tools this task │
        │           holds, the exchange, ancestor context          │
        │   reads:  as needed, inside the model loop               │
        │   output: 2–7 child goals, each with its own expectation │
        └─────────────────────────────────────────────────────────┘
                                  │  (descend to the first child)
                                  ▼
        ┌─────────────────────────────────────────────────────────┐
        │ SEQUENCE    goal → ordered mutations                     │
        │   input:  the goal, its expectation, the exchange,       │
        │           any superseded sequence + rationales           │
        │   reads:  as needed — THIS is where "where are we now?"  │
        │           gets answered                                  │
        │   output: observedState + an ordered list of mutations   │
        └─────────────────────────────────────────────────────────┘
                                  │
                                  ▼
        ┌─────────────────────────────────────────────────────────┐
        │ ACT × n     one mutation each, committed before dispatch │
        └─────────────────────────────────────────────────────────┘
                                  │
                                  ▼
        ┌─────────────────────────────────────────────────────────┐
        │ VERIFY      re-observe, compare against the expectation  │
        │   output: met | not-met | pending | unverifiable         │
        └─────────────────────────────────────────────────────────┘
                    │            │           │
             achieved      re-SEQUENCE   wait and re-VERIFY
                    │
                    ▼
             resolve up: next sibling, or the parent's VERIFY
```

### Decompose and sequence are different questions

Conflating them is what makes agent loops mushy, so the design keeps them apart:

| | Decompose | Sequence |
| --- | --- | --- |
| Question | *what has to be true?* | *what do I do to make it true?* |
| Produces | child **goals**, each with an expectation | ordered **mutations** |
| Chosen when | no bounded sequence of the granted tools reaches the goal | one does |
| Recorded as | goal rows | `act` units in state `queued` |

A sequence unit writes **two** things about the world: `observedState` — what it
found when it looked — and the ordered mutations it believes take that state to
the goal's `expectation`. The pair is the transition the sequence is supposed to
produce, and it is exactly what the verify unit re-reads against.

**Reads are not sequenced.** They happen inside a decompose, sequence, or verify
unit's own model call, bounded by `maxReadToolRoundsPerUnit` and
`maxReadsPerUnit` but otherwise the agent's judgement. Reads do not change the
world, so they do not need to be planned, ordered, approved, or recovered.

### The decisions

```ts
type AgentDecomposeDecision =
  | { kind: "decompose"; children: readonly ProposedGoal[];
      rationale: string; progress: string }
  | { kind: "sequenceable"; rationale: string }   // "this is small enough; sequence it"
  | { kind: "blocked";   question: ProposedQuestion }
  | { kind: "abandon";   reason: string };

type AgentSequenceDecision =
  | { kind: "sequence"; observedState: string;
      actions: readonly ProposedAction[]; rationale: string; progress: string }
  | { kind: "satisfied"; observedState: string; evidence: string }  // already true
  | { kind: "escalate"; reason: string }   // this needs re-decomposition at the parent
  | { kind: "blocked";  question: ProposedQuestion }
  | { kind: "abandon";  reason: string };

type AgentVerifyDecision =
  | { kind: "met";           observedState: string; evidence: string }
  | { kind: "not-met";       observedState: string; gap: string }
  | { kind: "pending";       observedState: string; waitingOn: string }
  | { kind: "unverifiable";  question: ProposedQuestion };

interface ProposedGoal {
  readonly statement: string;
  /** What we expect to observe when this is met. Required. */
  readonly expectation: string;
}

interface ProposedAction {
  readonly endpointKey: string;      // must be in the task's policy
  readonly request: unknown;         // validated against the descriptor schema
  readonly rationale: string;        // shown to a person on approval paths
}
```

`escalate` matters more than it looks. Without it, a sequence unit that
discovers the goal was mis-framed can only fail; with it, the runner marks the
goal `abandoned`, moves the cursor to the parent, and issues a `decompose` there
with the reason in context. That is how the tree repairs itself.

### Why decomposition does not spiral

Left alone, a model asked to decompose will happily decompose forever. Five
bounds stop it, deliberately independent:

1. **`maxGoalDepth`.** At the bound, the decompose option is **not offered** —
   the structured-output schema for a leaf at maximum depth admits only
   `sequenceable`, `blocked`, or `abandon`. A model cannot choose what it cannot
   emit.
2. **`maxDecomposeAttemptsPerGoal`** (default 2). A goal with children is never
   decomposed again by the traversal, because it is no longer a leaf. The
   counter only rises when a failed verify sends it back.
3. **`maxConsecutivePlanningUnits`** (default 2). Two planning units in a row
   with no `act` between them forces the next unit to produce at least one
   action, or the goal is `blocked` with a question. This is the direct guard
   against "spent the whole run planning".
4. **`maxGoalsPerTask`.** A hard ceiling on the tree.
5. **The prompt states the rule.** Decompose *only* if no bounded sequence of
   the tools this task actually holds can reach the goal. Those tools are listed
   in the same prompt, so the judgement is grounded rather than abstract.

Bounds 1 and 3 are the load-bearing ones: the first makes runaway depth
unrepresentable, the second makes runaway breadth expensive inside one unit
rather than invisible across many.

### Prompts are versioned in code

Each unit kind has its own prompt, in `domain/prompts.ts`, versioned as a
constant — the same pattern Derived Outputs uses for its planning and synthesis
prompts.

| Prompt | Frames |
| --- | --- |
| `DECOMPOSE_V1` | the goal, its expectation, ancestor goals, the **exact tool list**, the decompose-only-if rule, `maxGoalDepth` remaining |
| `SEQUENCE_V1` | the goal, its expectation, current observations, the exact tool list with schemas, any superseded sequence and why it was superseded |
| `VERIFY_V1` | the goal, its `expectation`, the `observedState` the sequence recorded, what was actually done, and the four permitted outcomes |
| `SETTLE_V1` | the whole goal tree with outcomes, for the task's closing summary |

Every unit records the `promptVersion` it ran under, so a behavioural change
after a prompt edit is attributable rather than mysterious.

The persona fragment is appended **after** the unit prompt, never before it —
Persona's third consumer law. A persona shapes how the agent works; it cannot
dissolve the contract that tells the agent what shape its answer must take.

---

## Work unit lifecycle

Every unit follows the same four beats:

```text
1. claim     insert unit row (runId, unitSeq) state "started"
                └─ unique constraint makes a duplicate claim a no-op
2. work      the model call (with read tools bound) / the mutation
3. settle    update the row, write safeSummary, append exchange messages,
             update goal state, insert any queued act units — ONE transaction
4. boundary  run the boundary check, dispatch the next unit — AFTER commit
```

### The act unit is the strict case

```text
ACT unit
  ├─ evaluate policy for (endpointKey, resourceId)
  │     rejected? → settle "rejected", write the reason to the exchange,
  │                 publish agent.mutation.refused, boundary check.
  │                 NOT a failure.
  ├─ approval required and not granted?
  │     → write the approval request, task → waiting, dispatch nothing
  ├─ TRANSACTION: insert tool call row, unit state "dispatched",
  │               request_id = "agent:<toolCallId>", request_digest
  ├─ gateway.call(endpointKey, request, requestId, actor)
  └─ TRANSACTION: unit → succeeded|failed with the result ref,
                  append a progress message, task mutation_count,
                  publish agent.mutation.committed
```

**Minting the request id before dispatch is what makes recovery a replay rather
than a guess.** If the process dies between the two transactions, recovery finds
a unit in `dispatched` with the exact request id the target was given, and
re-sending the identical command replays the target's own receipt.

`requestDigest` is computed over the canonical request (sorted keys, `undefined`
dropped, SHA-256) by Agents' own `domain/canonical.ts`. **The id makes dispatch
idempotent; the digest binds an approval to exact arguments.** Neither
substitutes for the other.

**One mutation per act unit, and at most one `dispatched` unit per run.** That
is what makes the crash story finite: there is never more than one call whose
outcome is unknown.

### Verify has four outcomes, and `pending` is the one people forget

```text
VERIFY unit
  ├─ met          → goal achieved; resolve up
  ├─ not-met      → re-SEQUENCE the same goal (trigger "verification"),
  │                 bounded by maxSequenceAttemptsPerGoal
  ├─ pending      → the change was accepted but has not settled yet.
  │                 Re-dispatch this same verify after a backoff.
  └─ unverifiable → open an optional question; treat as not-met for now
```

**`pending` exists because some target commands are asynchronous.** Document's
`prompt.create.request` returns **202 with an `attemptId`** — the prompt block
does not exist yet, and will not until Document's own freeze/compute/settle
pipeline runs. A verify that treated 202 as "not met" would re-sequence and
re-issue the command, creating a duplicate attempt.

So the verify decision distinguishes *"it did not work"* from *"it has not
finished yet"*, and the runner re-dispatches the same verify unit on a backoff
(`verifyBackoffMs`, default `[1s, 2s, 5s, 15s, 30s]`) up to
`maxVerifyAttemptsPerGoal`. Exhausting the backoff settles the goal `blocked`
with a question rather than assuming failure.

The agent can also *observe* the async state directly — `POST /documents/query
{ document.attempt }` is an ordinary read — which is why `pending` carries
`waitingOn`: the model names what it is waiting for, and that string goes into
the progress message so a person watching sees "waiting for the prompt output to
settle" rather than silence.

---

## The boundary check

This runs after **every** work unit commits, before the next is dispatched. It
is the single place the loop can be redirected, and it is why steering,
answering, approving, and cancelling all work without an interrupt mechanism.

```text
after unit N commits:
  1. cancelled?                       → settle the run "cancelled", stop
  2. task blocked (required question
     or pending approval)?            → leave the run "running", dispatch nothing
  3. steer check due, and new exchange
     messages since unit N's
     consumedThroughSeq?              → the steering path, below
  4. run bounds exceeded?             → settle the run "failed"
  5. active goal has queued act units?→ dispatch the next one
  6. otherwise                        → derive the active goal, dispatch its
                                         decompose / sequence / verify
```

### The steer check interval

Step 3 is gated by `steerCheckInterval` (default 1 — check after every unit).

The check itself is free: it compares `task.head_seq` against the unit's
`consumed_through_seq`, both of which are already in hand. The knob does not
exist to save work — it exists so that a **coherent run of mutations can finish
before being re-planned**. With an interval of 3, a sequence of five actions
interrupts after action 3 rather than after action 1, which for a set of edits
that only makes sense together is the difference between a clean intermediate
state and a strange one.

Three rules constrain it so it can never swallow a redirect:

- The check is **always** performed before a `decompose`, `sequence`, or
  `verify` unit, regardless of the interval. Only runs of `act` units are
  batched.
- The check is **always** performed before an act unit that requires approval —
  a person about to be asked for permission must be asked against the latest
  instruction.
- The counter resets at the end of every sequence, so a redirect never waits
  past the goal it applies to.

---

## Steering

Steering is an ordinary exchange message. It needs no interrupt path, no control
channel, and no special state — and, critically, **it does not throw away the
plan.**

```text
person appends "steering"                   [SERIAL command job]
   ├─ CAS on task revision
   ├─ append the message at head_seq + 1, with
   │    in_response_to_seq = the prior head_seq
   └─ if the task was `waiting`: clear attention, task → running,
        dispatch a sequence unit for the active goal

in-flight unit                              [CONCURRENT]
   └─ finishes its atomic work and commits.
      An act unit re-checks the steer flag immediately before dispatching and
      supersedes itself cleanly if it has not yet dispatched.

boundary check
   ├─ mark the remaining `queued` act units `superseded` (rationales kept)
   ├─ write one `system` message naming what was dropped and why it was queued
   └─ dispatch a SEQUENCE unit for the active goal, trigger "steering"

that SEQUENCE unit's model input carries
   ├─ the active goal and its expectation
   ├─ the ancestor goals, so the redirect can be judged in context
   ├─ what has already been done for this goal
   ├─ the superseded sequence, each action with its rationale
   ├─ the steering message(s), and what the agent had said before them
   └─ fresh reads of current state
```

**Steering is an adjustment to the decomposition, not an interruption of it.**
The unit that consumes it can return any of:

| Outcome | Meaning |
| --- | --- |
| `sequence` | an amended action list for the same goal — often the superseded actions, re-ordered or edited, plus new ones |
| `decompose` (via `escalate`) | the redirect warrants new structure: the runner moves the cursor up and decomposes there, injecting a goal |
| `satisfied` | the redirect made this goal moot; mark it achieved and resolve up |
| `blocked` | the redirect is ambiguous; ask |

That is why the superseded rationales are input rather than discarded. The agent
had a reason for each pending mutation and an expectation it was working toward;
a person redirecting usually means *"also do this"* or *"do that part
differently"*, not *"forget everything"*. Handing it the old plan is what lets it
produce an amended one instead of starting over.

A `plan` message goes into the exchange showing the amended sequence, so the
person sees that their steering was received **and what it changed**.

### What there is to clean up: nothing

A mutating command at every target in this codebase is atomic and revisioned.
There are exactly two cases:

- **Steered before dispatch.** The unit supersedes. Nothing happened anywhere.
- **Steered after dispatch.** The change committed at the target. It is
  recorded, it is real, and the re-sequencing unit reads it as part of current
  state.

There is no third case, and therefore **no leftover work to unwind**. The agent
is always planning a transition *from where things now are*, so a landed
mutation is simply part of the starting state of the amended plan.

This is what makes copy-on-write shadowing — mutate a duplicate, translate it
into the real resource on completion — unnecessary rather than merely expensive.
Shadowing would require every target to implement a duplicate-and-merge protocol
to protect against a state the model cannot enter.

**Retraction is a different instruction from interruption.** If a landed
mutation turns out to be unwanted, that is undo, and undo belongs to the target:
Document already has `document.compensate` with generated inverse operations.
Agents can call it as an ordinary mutation if a future design wants
agent-initiated retraction. It is deliberately not wired into steering, because
"stop doing that" and "unmake what you did" are different instructions and
conflating them makes the second happen by accident.

### Answers, approvals, and cancellation use the same path

| Event | Where it lands | What happens next |
| --- | --- | --- |
| `task.answer` closes the last required question | exchange message | task → running; dispatch a `sequence` unit for the active goal, trigger `steering` |
| `task.approve` grant | exchange message + approval row | dispatch the waiting act unit |
| `task.approve` deny | exchange message + approval row | settle that unit `rejected`, supersede the rest of the sequence, dispatch a `sequence` unit with trigger `refusal` |
| `task.steer` | exchange message | as above |
| `task.cancel` | exchange message | settle the run `cancelled` at the next boundary |

A denial re-sequences rather than continuing blindly with the remaining
actions — a refused mutation usually invalidates the premise of the ones queued
behind it.

A dispatched mutation is **allowed to complete and is recorded** even under
cancel. The target has accepted the change; a record saying it was cancelled
would be a lie, and the operator needs to know the effect landed. Cancel means
"stop starting new work", not "undo".

### There is no cancellation primitive to do better with

`JobDefinition` carries no `AbortSignal`. `Intelligence`'s methods accept a
`signal` parameter but every caller passes `undefined`, and
`knowledge/embedder.ts` carries the standing comment *"AbortSignal is undefined
for now — wire it through when request-level cancellation is added."*

So the practical consequence is worth stating rather than discovering: **steer
and cancel latency is one work unit** — times `steerCheckInterval` for runs of
act units. For a mutation that is fast. For a decompose, sequence, or verify
unit it is one model call. If that becomes the complaint, the fix is
request-level cancellation across the whole runtime, not something Agents can
solve locally. See [supplementary-changes.md](supplementary-changes.md).

---

## Bounds

```ts
interface AgentLimits {
  // Traversal
  maxGoalDepth: number;                  // 6
  maxGoalsPerTask: number;               // 200
  maxDecomposeAttemptsPerGoal: number;   // 2
  maxSequenceAttemptsPerGoal: number;    // 3
  maxVerifyAttemptsPerGoal: number;      // 5
  maxConsecutivePlanningUnits: number;   // 2
  verifyBackoffMs: readonly number[];    // [1000, 2000, 5000, 15000, 30000]

  // Work
  maxUnitsPerRun: number;                // 500
  maxActionsPerSequence: number;         // 12
  maxMutationsPerTask: number;           // 200
  steerCheckInterval: number;            // 1

  // Reads
  maxReadToolRoundsPerUnit: number;      // 8
  maxReadsPerUnit: number;               // 24

  // Task
  maxRunsPerTask: number;                // 20
  maxTokensPerTask: number;              // 10_000_000
  maxObjectiveChars: number;             // 8_000
  maxExchangeMessages: number;           // 5_000
}
```

### Limits come from named configuration sets

Defaults live in an `agents:` section of `apps/backend/etc/configuration.yaml`
as **named presets**, not a single flat block:

```yaml
agents:
  defaultLimits: standard
  limits:
    quick:     { maxGoalDepth: 3, maxUnitsPerRun: 60,  maxMutationsPerTask: 20,  … }
    standard:  { maxGoalDepth: 6, maxUnitsPerRun: 500, maxMutationsPerTask: 200, … }
    thorough:  { maxGoalDepth: 8, maxUnitsPerRun: 2000, maxMutationsPerTask: 800, … }
```

A caller selects one by name and may override individual fields:

```ts
readonly limitsPreset?: string;                 // absent → agents.defaultLimits
readonly limits?: Partial<AgentLimits>;         // applied on top
```

Resolution happens at creation — preset, then overrides — and the **resolved
set is frozen onto the task**, so editing a preset never changes a task already
in flight. An unknown preset name is a 400 raised before any row exists.

Presets exist because these numbers move together. "Be thorough" is not one
knob; it is a deeper tree, more units, more mutations, and more read rounds all
at once, and asking a caller to get seventeen numbers mutually consistent is
asking for incoherent configurations.

These defaults are deliberately liberal. The earlier draft's numbers were
guesses set low out of caution, which mostly produces tasks that settle
`partial` for reasons the user cannot act on. The bounds that matter for safety
are `maxMutationsPerTask` and the policy — not the ones that merely stop the
loop being long.

### What each bound does when it is hit

| Bound | Effect |
| --- | --- |
| `maxGoalDepth` | the decompose option is not offered; the model must sequence |
| `maxConsecutivePlanningUnits` | the next unit must produce an action, or the goal is `blocked` |
| `maxSequenceAttemptsPerGoal` | the goal is `abandoned`; the parent's verify sees the gap |
| `maxVerifyAttemptsPerGoal` | the goal is `blocked` with a question |
| `maxActionsPerSequence` | the sequence is truncated and the model told so; the remainder comes from the next sequence |
| `maxUnitsPerRun` | the **run** settles `failed`; the task stays alive and a new run resumes over the same goals |
| `maxMutationsPerTask`, `maxRunsPerTask`, `maxTokensPerTask` | the **task** settles `partial`, with the bound named in `unmet` |

The run/task split is the important part: a bound that stops one attempt should
not end the engagement.

### `maxReadToolRoundsPerUnit` needs a platform change

`Intelligence.reasonWithToolsInternal` currently ends its loop with a bare
`throw` at the round limit — no structured decision, no partial result, and no
usage figures for the rounds it did run. A sequence unit that spends its read
budget is an *ordinary* event that must produce a `system` message telling the
model to decide with what it has, and it must be distinguishable from a provider
failure without matching on a message string. Its tokens also still count
against `maxTokensPerTask`.

Tracked as item 1 in [supplementary-changes.md](supplementary-changes.md).

---

## Failure and retry

```ts
type AgentFailureClass =
  | "transient"   // provider timeout, queue capacity, 5xx from a target
  | "invalid"     // model produced an unusable decision
  | "refused"     // policy or a person refused; not an error
  | "bounded"     // a limit was reached
  | "fatal";      // wiring bug, unknown endpoint, corrupt state
```

- **transient** — the unit is retried in place with exponential backoff, reusing
  `isRetryableInternalJobAdmissionError` for admission failures. Bounded
  attempts, then the run fails and the task stays alive.
- **invalid** — the decision failed validation. A `system` message describes
  what was wrong and the unit retries once with that message in the transcript.
  A second failure fails the run.
- **refused** — not a failure. Recorded on the unit, appended to the exchange,
  published as `agent.mutation.refused`, and fed to the re-sequencing unit.
- **bounded** — as above.
- **fatal** — the run fails and the task settles `failed`. A policy naming an
  endpoint the catalogue does not expose is fatal, not transient.

**A failed run never fails the task by itself.** The task fails when it runs out
of runs, or when a fatal class is hit.

---

## Recovery

Recovery reconciles durable state against an empty queue. It runs in exactly two
places, and **neither of them is a timer**:

- **At startup**, awaited *before* `app.listen`, so no request can race a
  half-recovered task. This is what `document.recoverPendingAttempts()` does.
- **Opportunistically**, whenever a run settles: the settlement job sweeps that
  task's siblings.

There is deliberately no recurring agent sweeper. The tree has three
recurring/recovery mechanisms already, and "no second orchestration framework"
is a stated non-goal.

| Found | Meaning | Action |
| --- | --- | --- |
| run `queued`, no units | dispatch lost | re-dispatch `run.start` |
| task `queued`, no scope pinned | first run never started | re-dispatch `run.start`; it pins |
| unit `started`, kind decompose/sequence/verify | replayable work interrupted | fail the unit, re-derive the cursor, dispatch afresh (trigger `recovery`) |
| unit `dispatched`, kind act | outcome unknown | re-dispatch the call — see below |
| act units `queued`, run not running | continuation lost | dispatch the next one |
| task `waiting` | correct; a person owes an answer | leave alone |
| task terminal, run non-terminal | settlement raced | settle the run `cancelled` |
| outbox row unpublished | delivery interrupted | republish |
| `state`/`attention` disagree with the tables | projection drift | recompute, log `attention_drift` |

An interrupted planning unit is **re-derived, not resumed**. Its in-memory model
conversation is gone, and re-deriving is cheaper and safer than pretending to
continue one. **The goal tree and the queued act units are what carry forward** —
which is exactly why they are rows rather than transcript. A restart mid-sequence
resumes the remaining mutations without re-planning them.

### The unknown-outcome case

A act unit committed as `dispatched` whose result was never written may or may
not have taken effect. Agents must not guess — and does not have to, because
**it minted the request id before dispatching**.

```text
unit `dispatched`, no result
  └─ re-dispatch the identical command with the same request_id
       ├─ the target replays its receipt   → it landed; write the result ref,
       │                                      settle the unit normally
       └─ the target executes              → it had not landed; it lands now
```

Either way the outcome becomes known, and the call is never applied twice. This
is the receipt mechanism every mutating capability already implements for its
own HTTP retries; Agents is just another client of it.

**The requirement on a target is therefore only: be idempotent by
caller-supplied request id.** Document (`(document_id, request_id)` receipts),
Comments, and Templates already are, with no change.

**What this trades away, stated plainly.** Re-dispatch *acts* if the call had
not landed. It is a retry, not a read. For every command in the tree that is the
desired outcome: the agent asked, policy allowed, and where required a person
approved those exact arguments.

An earlier draft required every target to implement `lookup(requestDigest)`, on
the belief that Document already stored a digest index. It does not — the digest
is only compared against a receipt found by request id. That requirement would
have meant a new index and a new store method in every write target. It is
dropped. The same reasoning retired Document's delegated command claims.

---

## Settlement

The root objective's verify returning `met` — or a bound, a fatal failure, or a
cancel — produces a `settle` unit. Settling is one transaction with
compare-and-swap on the task revision.

```text
TRANSACTION
  ├─ verify task.revision === frozenRevision      else → discarded, no change
  ├─ verify task.state is not terminal            else → discarded
  ├─ update task: state, result, settledAt, revision + 1
  ├─ append "result" message
  ├─ close every non-terminal goal as abandoned
  ├─ withdraw all open questions
  ├─ withdraw all pending approvals
  ├─ settle the run
  ├─ prune this task's run transcripts unless the outcome is "failed"
  ├─ stage an outbox row: destination "activity", kind agent.task.settled
  └─ if origin.kind === "automation":
        stage an outbox row: destination "automation"

then, AFTER commit: publish each row, mark published_at
```

A losing settlement is recorded as discarded and changes nothing. Two runs
cannot both settle a task, and a settlement racing a cancel loses to whichever
commits first — both are terminal, both are honest.

The settle unit's summary is produced from the **goal tree with outcomes**, not
from the transcript: which objectives were achieved, which were abandoned and
why, and what remains unmet. That is a structured input, so the summary is
grounded in what actually happened rather than in what the model remembers.

### Activity carries everything the agent does

Agents publishes through a narrow outbound port, using the same local-outbox
discipline Document, Comments, and Templates use:

```ts
/** Narrow source-side Activity port; Agents never imports the Activity runtime. */
export interface AgentActivityPublisher {
  publish(transaction: AgentCommittedTransaction): Promise<void>;
}
```

| Published | Kind | When |
| --- | --- | --- |
| Task created | `agent.task.created` | in the creation transaction |
| Mutation landed | `agent.mutation.committed` | in the act unit's settle transaction |
| Mutation refused | `agent.mutation.refused` | policy rejection or a person's denial |
| Task settled | `agent.task.settled` | in the settlement transaction |

Reads, decompose, sequence, and verify units are **not** published. They are in
the exchange, which is where a person follows a live task; a project feed
carrying a line per retrieval would be unusable. The rule: *Activity carries
what changed the project or was refused permission to; the exchange carries how
the agent got there.*

**The overlap with the target's own publication is deliberate and kept.** When
an agent edits a document, Document publishes its own transaction with
`origin: "agent"` *and* Agents publishes `agent.mutation.committed`. Those are
two different facts — "the document changed" and "an agent was allowed to change
it" — and a refused mutation exists only in the second. A future Activity read
or list may want to collapse the pair for display; that is a presentation
concern to solve when a feed UI exists, not a reason to drop a record now.

`sourceTransactionId` is allocated with each staged row and passed to Activity
as its `idempotencyKey`. Delivery failure logs `agents.activity.publish-failed`
and leaves the row for `publishPendingActivity()` at startup; it never changes
committed agent state.

---

## The run transcript

Rebuilding a model conversation across separate jobs needs the assistant and
tool messages from earlier units. Those live in a **run transcript** — a per-run
table of provider-facing messages, written as each unit completes.

The transcript is *not* the exchange, and the distinction matters:

| | Exchange | Run transcript |
| --- | --- | --- |
| Audience | people | the model |
| Lifetime | forever | the run, plus a retention window |
| Exposed by the read API | yes | never |
| Contains | plans, progress, questions, results | assistant turns, tool results |

It holds no hidden reasoning or provider traces — those never leave the
Intelligence port.

Note that a unit's model input is assembled mostly from **rows**, not from the
transcript: the goal tree, the goal's expectation and observed state, the
superseded sequence, and the exchange prefix. The transcript supplies continuity
within a unit's own tool loop and recent context, not the plan. That is what
makes an interrupted unit safe to re-derive rather than resume.

**Retrieved material is delimited and labelled as untrusted third-party data**
when it enters the transcript: a fixed wrapper naming the source and stating
that its contents are data to be considered, never instructions to be followed.
That guarantees nothing — see the threat model in [tools.md](tools.md) — but it
costs nothing, raises the bar on naive injections, and makes the trust boundary
legible to anyone reading a transcript during a failure investigation.

Transcripts are pruned in the task's settlement transaction, except for tasks
that settled `failed`. Those are the one thing Agents hands to the shared
retention sweep — see [store.md](store.md) → Retention.
