# Agents — execution

How a task actually advances: what is frozen, what one cycle does, how a
mutation is intercepted, how steering reaches a model mid-work, and what happens
after a crash.

## Creation and freeze

Task creation is one serial job and one SQLite transaction. Everything expensive
happens outside the serial job entirely.

```text
POST /agents/command { type: "task.create", … }        [SERIAL]
  │
  ├─ 1. decode           exactKeys; unknown keys are a 400
  ├─ 2. resolve persona  personas.resolve(personaId, { sections })
  ├─ 3. resolve limits   named preset from config, then per-task overrides
  ├─ 4. resolve strategy registry lookup on (name, version);
  │                      strategy.validateOptions(options)
  ├─ 5. validate policy  every entry names an endpoint in the agent catalogue
  │
  └─ 6. ONE TRANSACTION
         ├─ insert task        state "queued", revision 1, all inputs frozen,
         │                     contextEntry verbatim, scope NOT yet pinned
         ├─ insert message     seq 1, kind "objective"
         ├─ insert queue item  ordinal 0, the strategy's seed item
         ├─ insert run         attempt 1, status "queued"
         ├─ insert receipt     requestId → response
         └─ stage outbox row   agent.task.created
      then, AFTER commit:
         └─ dispatch { type: "agents.run.start", runId, idempotencyKey }
```

Steps 2–5 can fail without leaving anything behind: an unknown persona, an
unknown limits preset, an unregistered strategy version, invalid strategy
options, or a policy naming an endpoint the catalogue does not expose are all
400-class errors raised before any row exists.

**Dispatch happens after commit, never inside the transaction.** If the process
dies between the two, the run row is still `queued` and recovery finds it.
Durable state is the authority for what still needs doing; the in-memory queue
never is.

### Why the scope is pinned at first-run start, not at creation

`knowledge.resolveScope` with no entries — the default, meaning *the whole
project* — lists every source and then issues one `describeSource` lookup per
source. That is unbounded work proportional to the corpus.

The serial queue has **exactly one active slot for the entire backend**. Every
Document command, General File upload, Connector delete, Persona write, and
Template registration is queued behind it, and nothing currently on it does
unbounded work. Resolving a whole-project scope inside the creation job would
make Agents the first capability to hold the global write lock for as long as
the project is large.

So the run start pins it instead, on the agent pool:

```text
agents.run.start
  ├─ if task.scope is absent:
  │     entries = scopeEntriesFor(task, task.persona)
  │     scope   = knowledge.resolveScope(entries)
  │     TRANSACTION: write scope_json, scope_pinned_at   (CAS on task revision)
  │     log agents.scope.pinned
  └─ dispatch cycle 1
```

The guarantee that matters is unchanged: **frozen before the first model call,
and immutable for the life of the task.** That is the same law Persona states
for its own snapshot (*"persist before calling"*). Pinning is idempotent under
the task-revision CAS — a second attempt finds `scope_json` present and skips.

### The scope union, and the absent-entry guard

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

`resolveScope([])` means everything; `resolveScope([X])` means only X.
Appending the persona's entry to an empty scope would narrow it — the exact
opposite of intent, and the failure is silent.

Exclusion — *"the whole project except this document"* — is not expressible by
enumerating entries and is not attempted here. The caller composes it first via
`POST /contexts/difference`. See
[supplementary-changes.md](supplementary-changes.md).

### The Persona consumer contract

Persona states six laws a consumer must keep and explicitly **cannot enforce any
of them**. Agents is its first consumer, so they are restated as requirements
with the test that proves each.

| Persona law | How Agents keeps it | Test |
| --- | --- | --- |
| Resolve once per task | `personas.resolve` is called in `agentTaskService.create` and nowhere else | no `#persona` import outside that file |
| Persist before the first model call | Written in the creation transaction | a task row always has `persona_json` |
| The fragment never precedes the contract | The **runtime** assembles system content: contract, then strategy prompt, then persona | message-order assertion; a strategy cannot influence it |
| Union only — never narrows scope | `scopeEntriesFor` above | absent entry + persona context resolves to whole project |
| Never substitute silently | An unknown or deleted `personaId` is a 400 at creation | create with a deleted persona raises `PersonaNotFoundError` |
| Never log section text | Logs carry `personaId`, `personaRevision`, `sections.length` | captured-log scan finds no section text |

---

## The cycle

A run advances by repeating one shape. **This is the whole loop.**

```text
CYCLE  (one job, on the agent pool)

 1. claim            insert cycle row (runId, cycleSeq) state "started"
                     └─ unique constraint makes a duplicate claim a no-op

 2. settle approvals dispatch any granted-but-undispatched tool calls.
                     The model does not re-issue them — the call already
                     has its row, request, and digest.

 3. dequeue          take the lowest-ordinal pending item, mark it active.
                     A cycle may run with an empty queue; the strategy
                     decides what that means.

 4. plan             request = strategy.plan(input)          [pure]

 5. work             run the model with a ToolSet built from
                     policy ∩ request.toolNames, intercepting every call.
                     Bounded by maxToolRoundsPerCycle.
                       └─ between rounds: onRound → inject steering, or stop

 6. interpret        outcome = strategy.interpret(input, result)   [pure]

 7. commit           ONE TRANSACTION:
                       memory, exchange messages, plan writes, queue writes,
                       cycle row terminal, task counters, outbox rows

 8. boundary         cancelled? blocked? budget exhausted? queue empty and
                     the strategy said settle? → otherwise dispatch cycle n+1
```

Steps 4 and 6 are the strategy. Everything else is the substrate. See
[strategies.md](strategies.md).

### The bound is cycles, not queue size

A strategy can push a hundred items cheaply — pushing costs a row. What costs
money is **dequeuing and working one**, because that is a model call. So
`maxCyclesPerRun` and `maxTokensPerTask` are the real budget, and
`maxQueueDepth` exists only so a runaway strategy cannot fill the database.

A cycle may dequeue nothing (empty queue) and still cost a model call, which is
why the bound is on cycles rather than dequeues.

---

## The tool loop, and where every guarantee lives

This is the heart of the runtime and the reason the strategy can stay pure.

**The model never mutates anything.** It emits tool calls and *stops*. We
execute them. So there is a complete interception point between "the model
asked" and "anything happened":

```text
round:
  response = provider.reason(messages, tools)
  if no toolCalls → the loop is done

  ── the runtime sees ALL of this round's calls before executing ANY ──
  ├─ classify: reads vs mutations (from the catalogue descriptor)
  ├─ if any mutations: append ONE `plan` message to the exchange
  │     "about to: update doc-q3 (2 operations), refresh output out-5"
  │
  └─ for each call, in order:
       ├─ READ
       │    execute through the gateway
       │    record a tool_calls row (mutating = 0)
       │    return the result to the model
       │
       └─ MUTATION
            ├─ evaluate policy (endpointKey, extracted resourceId)
            │    rejected → record the row `rejected`
            │               append a `progress` message
            │               publish agent.mutation.refused
            │               return a refusal as the tool result   ← not an error
            │
            ├─ approval required and not granted?
            │    → record the row `awaitingApproval`
            │      append an `approvalRequest` message
            │      return "requires approval; requested" as the tool result
            │      set the unwind flag
            │
            └─ allowed
                 ├─ TRANSACTION: row `dispatched`, requestId, requestDigest
                 ├─ gateway.call(...)
                 └─ TRANSACTION: row terminal + result ref,
                                 `progress` message, task mutation_count,
                                 outbox agent.mutation.committed

  onRound hook:
    ├─ unwind flag set (approval pending)?  → "stop"
    ├─ task cancelled?                      → "stop"
    ├─ budget exhausted?                    → "stop"
    └─ task.headSeq > cycle.consumedThroughSeq, and the steer check is due?
         → inject the new exchange messages as a `user` turn and continue
```

### Interception is why the strategy can be pure

An earlier design had the model emit mutations as **structured output**, on the
belief that a tool handler could not give the same guarantee — that a mutation
dispatched from inside a model loop would land in another capability with no
committed record in Agents that it was ever asked for.

That belief was wrong, because **the handler is ours and it commits before it
dispatches**. A crash between the two transactions leaves exactly one row in
`dispatched`, which recovery resolves by replay.

Interception is strictly better than declaration:

- **No per-endpoint output schema.** Declaring mutations as structured output
  means describing every reachable command's arguments in a decision schema,
  which becomes unmanageable as the catalogue grows. A tool definition already
  carries that schema, and the provider validates against it.
- **"Here is what I am about to do" survives.** A round can emit several tool
  calls, and we see all of them before executing any — so the pre-execution
  `plan` message is one message describing the batch, not a separate planning
  turn.
- **The strategy stops needing an `act` outcome.** Asking for a mutation and
  getting one are the same act, so `AgentCycleOutcome` has no branch for it.

### Steering injection: the mechanism

**There is no way to push into an in-flight completion.** Not in OpenRouter, not
in the provider APIs beneath it. Inference is request/response; streaming is
output-only. Models only surface a turn to the caller by emitting tool calls.

But **the tool loop is ours**. `reasonWithToolsInternal` is a `while` loop that
makes a fresh request per round with a longer message array. Between
`tools.execute(call)` and the next `provider.reason(...)` we can append anything
— including a `user` turn carrying a steering message. Providers accept a user
turn after tool results; it is an ordinary multi-turn interleave.

So the injection point already exists, at every tool call, and **costs nothing
extra** — the round trip was already being paid for.

This decouples steering responsiveness from work granularity, which is the
tension the whole design was fighting. Cycles can be as large as a strategy
wants; a person's redirect still lands within one tool round.

`steerCheckRounds` (default 1) governs how often `onRound` consults the exchange.
The check is an integer comparison on a row already in hand, so raising it saves
nothing — it exists only so a coherent batch of tool calls can finish before the
model is redirected. Two rules stop it swallowing a redirect: the check always
runs before a round that would issue a mutation, and always at the end of a
cycle.

Requires the `onRound` hook described in item 1 of
[supplementary-changes.md](supplementary-changes.md).

---

## Steering, end to end

```text
person appends "steering"                   [SERIAL command job]
   ├─ CAS on task revision
   ├─ append at head_seq + 1, with in_response_to_seq = the prior head_seq
   └─ if the task was `waiting`: clear attention, task → running, dispatch a cycle

mid-cycle                                   [agent pool]
   └─ onRound sees head_seq moved, injects the messages as a user turn.
      The model reacts in the next round — it may abandon a tool call it was
      about to make, or change what it asks for.

end of cycle
   └─ strategy.interpret() receives newMessages and decides what it means:
        · amend the queue (supersede pending items, push new ones)
        · push a correction to the FRONT so it happens before anything else
        · re-plan a subtree
        · settle, if the steering says stop
```

**Steering is an adjustment to the plan, not an interruption of the attempt.**
The run continues. The queue survives, minus whatever the strategy superseded.

### Superseded, not discarded

When a strategy supersedes a pending queue item, the item keeps its `label` and
`payload` and moves to state `superseded` with a reason. Both are available to
the strategy in the next cycle's input.

That distinction matters: a person redirecting usually means "also do this" or
"do that part differently", not "forget everything you were going to do".
Handing the old plan back is what lets a strategy amend rather than restart.

The runtime writes one `system` message naming what was superseded, so the
exchange records that the redirect landed and what it cost.

### What there is to clean up: nothing

A mutating command at every target in this codebase is atomic and revisioned.
There are exactly two cases:

- **Steered before the tool call was executed.** Nothing happened anywhere.
- **Steered after.** The change committed at the target. It is recorded, it is
  real, and the next cycle's strategy sees it in `lastOutcomes` and plans forward
  from there.

There is no third case, and therefore **no leftover work to unwind**. The agent
is always planning from where things now are, so a landed mutation is simply
part of the starting state.

This is what makes copy-on-write shadowing — mutate a duplicate, translate it
into the real resource on completion — unnecessary rather than merely expensive.
Shadowing would require every target to implement duplicate-and-merge to protect
against a state the model cannot enter.

**Retraction is a different instruction from interruption.** If a landed
mutation turns out to be unwanted, that is undo, and undo belongs to the target:
Document already has `document.compensate` with generated inverse operations. A
strategy can request it as an ordinary mutation. It is deliberately not wired
into steering, because "stop doing that" and "unmake what you did" are different
instructions and conflating them makes the second happen by accident.

### Answers, approvals, and cancellation use the same path

| Event | What happens |
| --- | --- |
| `task.answer` closes the last required question | task → running; dispatch a cycle; the strategy sees the answer in `newMessages` |
| `task.approve` grant | dispatch a cycle; step 2 dispatches the approved call before any model work |
| `task.approve` deny | the call is `rejected`; the strategy sees it in `decisions` and re-plans |
| `task.cancel` | the current cycle unwinds at its next round boundary; the run settles `cancelled` |

A dispatched mutation is **allowed to complete and is recorded** even under
cancel. The target has accepted the change; a record saying it was cancelled
would be a lie. Cancel means "stop starting new work", not "undo".

### There is no cancellation primitive to do better with

`JobDefinition` carries no `AbortSignal`; `Intelligence` accepts a `signal` but
every caller passes `undefined`. So cancel unwinds at a **tool round boundary**,
not instantly. For a tool-using turn that is seconds. For a turn that makes no
tool calls at all it is one full completion. See
[supplementary-changes.md](supplementary-changes.md).

---

## Bounds

```ts
interface AgentLimits {
  maxCyclesPerRun: number;        // 200   — the real work bound
  maxToolRoundsPerCycle: number;  // 24
  maxReadsPerCycle: number;       // 60
  maxMutationsPerTask: number;    // 200   — the safety bound
  maxQueueDepth: number;          // 500   — runaway-push guard
  maxRunsPerTask: number;         // 20
  maxTokensPerTask: number;       // 10_000_000
  maxObjectiveChars: number;      // 8_000
  maxExchangeMessages: number;    // 5_000
  steerCheckRounds: number;       // 1
}
```

Everything strategy-specific — plan depth, planning turns, rework limits —
lives in `strategy.options`, because those numbers are meaningless to a strategy
that has no plan tree.

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

A caller names a preset and may override individual fields; resolution happens
at creation and the resolved set is frozen onto the task, so editing a preset
never changes a task in flight. An unknown preset is a 400.

**Presets exist because these numbers move together.** "Be thorough" is not one
knob but a longer loop, more mutations, and more tokens at once, and asking a
caller to keep ten numbers mutually consistent invites incoherent configurations
— a `maxCyclesPerRun` of 800 with a `maxTokensPerTask` of 1M is a task that
always dies for a reason nobody can act on.

### What each bound does when hit

| Bound | Effect |
| --- | --- |
| `maxToolRoundsPerCycle` | the loop returns `exhausted: true`; the strategy is told and decides |
| `maxReadsPerCycle` | further read tools return a refusal; the model must decide with what it has |
| `maxQueueDepth` | further pushes are rejected; a `system` message says so |
| `maxCyclesPerRun` | the **run** settles `failed`; the task stays alive and a new run resumes over the same queue and plan |
| `maxMutationsPerTask`, `maxRunsPerTask`, `maxTokensPerTask` | the **task** settles `partial`, with the bound named in `unmet` |

The run/task split is the important part: a bound that stops one attempt should
not end the engagement.

`maxToolRoundsPerCycle` requires the non-throwing bounded mode described in item
1 of [supplementary-changes.md](supplementary-changes.md). Today the loop throws
a bare `Error` at the round limit, with no partial result and no usage figures —
and the tokens spent still count against `maxTokensPerTask`, so losing them
corrupts a budget.

---

## Failure and retry

```ts
type AgentFailureClass =
  | "transient"   // provider timeout, queue capacity, 5xx from a target
  | "invalid"     // the model produced output the strategy could not interpret
  | "refused"     // policy or a person refused; not an error
  | "bounded"     // a limit was reached
  | "fatal";      // wiring bug, unknown endpoint, unregistered strategy
```

- **transient** — the cycle is retried in place with exponential backoff,
  reusing `isRetryableInternalJobAdmissionError` for admission failures. Bounded
  attempts, then the run fails and the task stays alive.
- **invalid** — a `system` message describes what was wrong and the cycle
  retries once with that in context. A second failure fails the run.
- **refused** — not a failure. Recorded, published as
  `agent.mutation.refused`, and visible to the next cycle.
- **bounded** — as above.
- **fatal** — the run fails and the task settles `failed`.

**A failed run never fails the task by itself.** The task fails when it runs out
of runs, or when a fatal class is hit.

---

## Recovery

Recovery reconciles durable state against an empty queue. It runs in exactly two
places, and **neither is a timer**: at startup, awaited *before* `app.listen`,
so no request can race a half-recovered task; and opportunistically whenever a
run settles, sweeping that task's siblings.

There is deliberately no recurring agent sweeper. The tree has three
recurring/recovery mechanisms already, and "no second orchestration framework"
is a stated non-goal.

| Found | Meaning | Action |
| --- | --- | --- |
| run `queued`, no cycles | dispatch lost | re-dispatch `run.start` |
| task `queued`, no scope pinned | first run never started | re-dispatch `run.start`; it pins |
| cycle `started`, no outcome | interrupted mid-turn | fail the cycle, return its queue item to `pending`, dispatch a fresh cycle |
| tool call `dispatched`, no result | outcome unknown | re-dispatch under the same `requestId` |
| tool call `awaitingApproval`, approval `granted` | grant lost | dispatch it |
| queue item `active`, no live cycle | orphaned dequeue | return it to `pending` |
| queue non-empty, run not running | continuation lost | dispatch a cycle |
| task `waiting` | correct; a person owes an answer | leave alone |
| task terminal, run non-terminal | settlement raced | settle the run `cancelled` |
| outbox row unpublished | delivery interrupted | republish |
| `state`/`attention` disagree with the tables | projection drift | recompute, log `attention_drift` |

**An interrupted cycle is re-run, not resumed.** Its in-memory model
conversation is gone, and re-deriving is cheaper and safer than pretending to
continue one. This is safe because the strategy is pure over durable state:
whatever tool calls already executed are recorded and appear in `lastOutcomes`,
so the fresh cycle plans forward from the world as it now is.

That is the one contract a strategy must keep — see
[strategies.md](strategies.md) → "The one contract".

### The unknown-outcome case

A tool call committed as `dispatched` whose result was never written may or may
not have taken effect. Agents must not guess — and does not have to, because
**it minted the request id before dispatching**.

```text
tool call `dispatched`, no result
  └─ re-dispatch the identical command with the same request_id
       ├─ the target replays its receipt   → it landed; write the result ref
       └─ the target executes              → it had not landed; it lands now
```

Either way the outcome becomes known, and the call is never applied twice. This
is the receipt mechanism every mutating capability already implements for its
own HTTP retries; Agents is just another client of it.

**The requirement on a target is therefore only: be idempotent by
caller-supplied request id.** Document (`(document_id, request_id)` receipts),
Comments, and Templates already are, with no change.

**What this trades away.** Re-dispatch *acts* if the call had not landed. It is
a retry, not a read. For every command in the tree that is the desired outcome:
the agent asked, policy allowed, and where required a person approved those
exact arguments.

An earlier draft required every target to implement `lookup(requestDigest)`, on
the belief that Document already stored a digest index. It does not — the digest
is only compared against a receipt found by request id. That would have meant a
new index and store method in every write target. Dropped. The same reasoning
retired Document's delegated command claims.

---

## Settlement

```text
TRANSACTION
  ├─ verify task.revision === frozenRevision      else → discarded, no change
  ├─ verify task.state is not terminal            else → discarded
  ├─ update task: state, result, settledAt, revision + 1
  ├─ append "result" message
  ├─ supersede every pending queue item
  ├─ close every non-terminal plan node as abandoned
  ├─ withdraw all open questions and pending approvals
  ├─ settle the run
  ├─ prune this task's run transcripts unless the outcome is "failed"
  ├─ stage outbox row: destination "activity", kind agent.task.settled
  └─ if origin.kind === "automation": stage outbox row: destination "automation"

then, AFTER commit: publish each row, mark published_at
```

A losing settlement is recorded as discarded and changes nothing. Two runs
cannot both settle a task, and a settlement racing a cancel loses to whichever
commits first — both terminal, both honest.

The settlement summary is produced from the **plan tree and queue with
outcomes**, not from the transcript, so it is grounded in what happened rather
than in what the model remembers.

### Activity carries everything the agent does

```ts
/** Narrow source-side Activity port; Agents never imports the Activity runtime. */
export interface AgentActivityPublisher {
  publish(transaction: AgentCommittedTransaction): Promise<void>;
}
```

| Published | Kind | When |
| --- | --- | --- |
| Task created | `agent.task.created` | in the creation transaction |
| Mutation landed | `agent.mutation.committed` | in the interception's settle transaction |
| Mutation refused | `agent.mutation.refused` | policy rejection or a person's denial |
| Task settled | `agent.task.settled` | in the settlement transaction |

Reads, cycles, and plan writes are **not** published. They are in the exchange,
which is where a person follows a live task; a project feed carrying a line per
retrieval would be unusable. The rule: *Activity carries what changed the
project or was refused permission to; the exchange carries how the agent got
there.*

**The overlap with the target's own publication is kept deliberately.** When an
agent edits a document, Document publishes its transaction with `origin: "agent"`
*and* Agents publishes `agent.mutation.committed`. Two different facts — "the
document changed" and "an agent was allowed to change it" — and a refused
mutation exists only in the second. A future Activity read may want to collapse
the pair for display; that is a presentation concern to solve when a feed UI
exists, and it will be obvious then.

`sourceTransactionId` is allocated with each staged row and passed to Activity
as its `idempotencyKey`. Delivery failure logs `agents.activity.publish-failed`
and leaves the row for `publishPendingActivity()` at startup; it never changes
committed agent state.

---

## The run transcript

Rebuilding a model conversation within a cycle needs the assistant and tool
messages from earlier rounds. Those live in a **run transcript** — a per-run
table of provider-facing messages, written as each cycle completes.

| | Exchange | Run transcript |
| --- | --- | --- |
| Audience | people | the model |
| Lifetime | forever | the run, plus a retention window |
| Exposed by the read API | yes | never |
| Contains | plans, progress, questions, results | assistant turns, tool results |

It holds no hidden reasoning or provider traces — those never leave the
Intelligence port.

Note that a cycle's model input is assembled mostly from **rows**: the task, the
queue, the plan, the exchange tail, the previous cycle's outcomes, and strategy
memory. The transcript supplies continuity within a cycle's own tool loop. That
is what makes an interrupted cycle safe to re-run rather than resume.

**Retrieved material is delimited and labelled as untrusted third-party data**
when it enters the transcript: a fixed wrapper naming the source and stating
that its contents are data to be considered, never instructions to be followed.
That guarantees nothing — see the threat model in [tools.md](tools.md) — but it
costs nothing and makes the trust boundary legible.

Transcripts are pruned in the task's settlement transaction, except for tasks
that settled `failed`. Those are the one thing Agents hands to the shared
retention sweep — see [store.md](store.md) → Retention.
