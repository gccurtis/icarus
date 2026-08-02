# Agents — execution

How a task actually advances: what is frozen, what a run does, what is committed
when, and what happens after a crash.

## Creation and freeze

Task creation is one serial job and one SQLite transaction. Everything expensive
happens *before* the transaction; the transaction only writes.

```text
POST /agents/command { type: "task.create", … }
  │
  ├─ 1. resolve persona           personas.resolve(personaId, { sections })
  ├─ 2. resolve scope             knowledge.resolveScope(scopeEntriesFor(input, snapshot))
  ├─ 3. validate policy           every entry names a registered target + command
  │
  └─ 4. ONE TRANSACTION
         ├─ insert task           state "queued", revision 1, all four inputs frozen
         ├─ insert message seq 1  kind "objective"
         ├─ insert run attempt 1  status "queued", consumedThroughSeq 1
         └─ insert creation receipt (clientRequestId → response)
      then, after commit:
         └─ dispatch { type: "agents.run.execute", runId, idempotencyKey }
```

Steps 1–3 can fail without leaving anything behind: an unknown persona, an
unresolvable scope, or a policy naming a command that no capability registers
are all 400-class errors raised before any row exists.

The scope union follows the rule Persona defines, including the empty-scope
guard — an empty caller scope already means the whole project, so the persona's
context must not be appended to it or the task would be *narrowed* from
everything to one context.

Dispatch happens after commit, never inside the transaction. If the process
dies between commit and dispatch, the run row is still `queued` and recovery
finds it. **Durable state is the authority for what still needs doing; the
in-memory queue never is.**

## The run loop

A run is a sequence of committed steps. Each step is one job. The step's
continuation is dispatched only after the step's row is committed.

```text
run.execute
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│ REASON step                                                 │
│   build model input from frozen inputs + consumed prefix    │
│   + run transcript                                          │
│   call intelligence with READ-ONLY tools bound              │
│   model returns a structured decision                       │
└─────────────────────────────────────────────────────────────┘
  │
  ├─ decision "settle"   ──►  SETTLE step  ──►  task terminal
  │
  ├─ decision "ask"      ──►  commit questions, settle run,
  │                            task → waiting (attention "question")
  │
  └─ decision "propose"  ──►  for each proposed call:
                                ├─ apply policy
                                ├─ needs approval? ──► commit approval request,
                                │                       settle run,
                                │                       task → waiting
                                └─ allowed ──► TOOL step (commit, dispatch, settle)
                                                  │
                                                  └─► dispatch run.continue
                                                        └─► back to REASON
```

### Why mutations are structured output, not tool calls

This is the central execution decision and it is worth the paragraph.

`0-platform/intelligence` already exposes `reasonWithToolsStructured`, which
runs a bounded tool loop **inside a single call** — the model asks, the handler
runs, the result goes back, repeat, up to `maxToolRounds`. Derived Outputs uses
exactly this, with handlers closing over a frozen evidence manifest.

That mechanism is perfect for reads and wrong for writes:

- **Reads are replayable.** A retrieval redone after a crash returns the same
  regions against a frozen scope. Losing an in-flight read loop costs tokens
  and nothing else.
- **Writes are not.** A mutation dispatched from inside an in-process loop that
  then crashes leaves an effect in another capability with no committed record
  in Agents that it was ever asked for. That is precisely the state the dual
  recording exists to make impossible.

So the split is by risk, not by taste:

| | Read-only tools | Mutating commands |
| --- | --- | --- |
| Offered to the model as | real tool definitions | structured-output proposals |
| Executed | inside the model loop, by `ToolSet` | as their own committed step |
| Recorded | as a `retrieve` step summary | as an `agent_tool_calls` row, before dispatch |
| On crash | redone; harmless | recovered from the committed row |

There is no `agents.step.retrieve` intent, because a retrieval never gets its
own job. A `reason` job writes `retrieve` step rows as child records for the
read-tool rounds that happened inside its model loop, then settles them
alongside itself. The step kind exists so the run is explainable; it is not a
separate scheduling unit.

A `reason` step therefore ends in one of three declared decisions rather than in
an open-ended tool loop:

```ts
type AgentDecision =
  | { kind: "propose"; progress: string; calls: readonly ProposedCall[] }
  | { kind: "ask";     progress: string; questions: readonly ProposedQuestion[] }
  | { kind: "settle";  outcome: "completed" | "partial" | "failed";
                       summary: string; unmet?: readonly string[] };

interface ProposedCall {
  readonly target: { readonly kind: string; readonly id?: string };
  readonly commandName: string;
  readonly request: unknown;
  /** Why this call, in the agent's words. Shown to a person on approval. */
  readonly rationale: string;
}
```

The model never emits a mutation as a side effect. It *declares an intention*,
which the runner then validates, records, gates, and dispatches. Every one of
those four verbs is code the model cannot skip.

### The run transcript

Rebuilding a multi-step model conversation across separate jobs needs the
assistant and tool messages from earlier steps. Those live in a **run
transcript** — a per-run table of provider-facing messages, written as each step
completes.

The transcript is *not* the exchange, and the distinction matters:

| | Exchange | Run transcript |
| --- | --- | --- |
| Audience | people | the model |
| Lifetime | forever | the run, plus a retention window |
| Exposed by the read API | yes | never |
| Contains | safe summaries, questions, results | assistant turns, tool results |

The transcript still holds no hidden reasoning or provider traces — those never
leave the Intelligence port. It holds the message array needed to continue a
conversation, and it is prunable once the run settles, because a settled run's
product-facing record is complete in the exchange.

Retention default: transcripts for settled runs are pruned after the task
itself settles. A task that fails mid-way keeps its transcripts so the failure
can be diagnosed.

## Step commit discipline

Every step follows the same four beats:

```text
1. claim     insert step row (runId, stepSeq) state "started"
                └─ unique constraint makes a duplicate claim a no-op
2. work      the model call / retrieval / tool dispatch
3. settle    update step row to succeeded|failed, write safeSummary,
             append any exchange messages, in ONE transaction
4. continue  dispatch the next step's intent, after commit
```

`(runId, stepSeq)` is the idempotency key. A duplicate continuation — from a
retried dispatch, or a restart replaying work — finds the row already settled
and returns its recorded outcome without redoing the work. There is no separate
receipts table; the step row is the receipt.

### The tool step is the strict case

A mutating tool step commits **before** it dispatches:

```text
TOOL step
  ├─ TRANSACTION: insert agent_tool_calls row, state "dispatched",
  │               with the exact request and requestDigest
  ├─ call the owning capability's command port
  └─ TRANSACTION: update the row to succeeded|failed with the result ref,
                  append a progress message, settle the step
```

If the process dies between the two transactions, recovery finds a row in
`dispatched` with no result — a call whose outcome is *unknown*. That state is
represented honestly rather than guessed at; see Recovery below.

**One mutating call per step.** Batching two mutations into one step would
create a crash window in which one effect landed and the other did not, with no
committed record distinguishing them. The cost is a round trip per mutation,
and it is worth paying.

## Bounds

Every run is bounded, and exceeding a bound settles the run rather than hanging.

```ts
interface AgentLimits {
  maxStepsPerRun: number;        // default 24
  maxToolCallsPerRun: number;    // default 12
  maxReadToolRoundsPerStep: number; // default 6 — passed to reasonWithTools
  maxRunsPerTask: number;        // default 50
  maxTokensPerTask: number;      // default 2_000_000
  maxObjectiveChars: number;     // default 8_000
  maxExchangeMessages: number;   // default 2_000
}
```

Exceeding `maxStepsPerRun` or `maxToolCallsPerRun` settles the *run* as
`failed` with `failureCode: "run_bounds_exceeded"`; the task remains alive and
the next run starts fresh with the accumulated exchange. Exceeding
`maxRunsPerTask` or `maxTokensPerTask` settles the *task* as `partial` with the
bound named in `unmet`, because at that point the loop itself is the problem.

Bounds are per-task configuration frozen at creation, so raising a default does
not change a task already in flight.

## Failure and retry

```ts
type AgentFailureClass =
  | "transient"   // provider timeout, queue capacity, 5xx from a target
  | "invalid"     // model produced an unusable decision
  | "refused"     // policy or a person refused; not an error
  | "bounded"     // a limit was reached
  | "fatal";      // wiring bug, unknown target, corrupt state
```

- **transient** — the step is retried in place with exponential backoff,
  reusing the existing `isRetryableInternalJobAdmissionError` predicate for
  admission failures. Bounded attempts, then the run fails and the task stays
  alive.
- **invalid** — the decision failed validation. The run appends a `system`
  message describing what was wrong and retries the reason step once with that
  message in the transcript. A second failure fails the run.
- **refused** — not a failure. Recorded and fed back; the agent chooses again.
- **bounded** — as above.
- **fatal** — the run fails and the task settles `failed`. A tool policy naming
  an unregistered command is fatal, not transient, because retrying cannot fix
  a wiring bug.

A failed run never fails the task by itself. The task fails when it runs out of
runs, or when a fatal class is hit.

## Recovery

Startup and a periodic sweep reconcile durable state against the empty queue.

| Found | Meaning | Action |
| --- | --- | --- |
| run `queued`, no steps | dispatch was lost | re-dispatch `run.execute` |
| run `running`, last step `started`, kind `reason` or `retrieve` | replayable work interrupted | reset the step, re-dispatch |
| run `running`, last step `started`, kind `tool`, call `dispatched`, no result | **outcome unknown** | reconcile — see below |
| task `waiting` | correct; a person owes an answer | leave alone |
| task terminal, run non-terminal | settlement raced | settle the run `cancelled` |

### The unknown-outcome case

A tool call committed as `dispatched` whose result was never written may or may
not have taken effect in the target capability. Agents must not guess.

Recovery asks the target capability whether it holds a change matching the
call's `requestDigest` — the same idempotency lookup that makes command replay
safe there. Three outcomes:

- **Found** — write the result ref from the target's record; the step settles
  normally.
- **Not found** — the call never landed; mark it `failed` with
  `errorCode: "dispatch_lost"` and let the next run decide whether to retry.
- **Target cannot answer** — mark the call `failed` with
  `errorCode: "outcome_unknown"`, append a `system` message saying so, and set
  the task `waiting` with `attention: "approval"`. A person decides.

The third branch is the honest one. An agent that silently retries a mutation
whose first attempt may have succeeded is how duplicate work happens, and no
amount of downstream cleverness recovers the information that was lost.

This places a real requirement on every mutating target: **its command port must
support idempotency lookup by request digest.** Document already stores
`client_request_id` and `request_digest` for exactly this. A capability that
cannot do this cannot be a mutating agent target.

## Settlement

Settling a task is one transaction with compare-and-swap on the task revision,
matching the compare-and-publish pattern Derived Outputs uses:

```text
TRANSACTION
  ├─ verify task.revision === frozenRevision      else → discarded, no change
  ├─ verify task.state is not terminal            else → discarded
  ├─ update task: state, result, settledAt, revision + 1
  ├─ append "result" message
  ├─ withdraw all open questions
  ├─ withdraw all pending approvals
  ├─ settle the run
  └─ if origin.kind === "automation": stage the settlement intent
```

A losing settlement is recorded as discarded and changes nothing. Two runs
cannot both settle a task, and a settlement racing a cancel loses to whichever
commits first — both are terminal, both are honest.

The automation settlement intent is staged inside the transaction and dispatched
after commit, so Automation is notified exactly once per settled task even
across a crash.

## Cancellation

Cancel takes effect at the next step boundary. The current step finishes and
commits.

A tool call already dispatched to a target is **allowed to complete and is
recorded**. The target has already accepted the change; a record saying the call
was cancelled would be a lie, and the operator needs to know the effect landed.
Cancel means "stop starting new work", not "undo".

Undo of effects is not Agents' job. It belongs to the target capabilities and,
later, to Activity-mediated compensation.
