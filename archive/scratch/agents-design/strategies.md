# Agents — strategies

A **strategy** is how a task decides what to do next. It is the one part of this
capability that is a genuine bet, so it is the one part that is pluggable.

Everything else — task identity, frozen inputs, the queue, the exchange, cycles,
tool interception, policy, the gateway, dispatch, recovery, Activity, retention
— is the **substrate**, and does not change when the strategy does.

## The interface: two pure functions

```ts
interface AgentStrategy {
  readonly name: string;
  readonly version: string;

  /** Validate and normalise `strategy.options` at task creation. Throws on bad input. */
  validateOptions(options: unknown): Readonly<Record<string, unknown>>;

  /** The memory a fresh run starts from. */
  initialMemory(task: AgentTask): unknown;

  /**
   * Decide what to ask the model. Pure: a function of durable state.
   * Returns a request the runtime executes; it does not execute anything itself.
   */
  plan(input: AgentCycleInput): AgentModelRequest;

  /**
   * Decide what changes. Pure: a function of the input and what came back.
   * The runtime applies everything returned here, in one transaction.
   */
  interpret(input: AgentCycleInput, result: AgentModelResult): AgentCycleOutcome;
}
```

**Both functions are pure.** No I/O, no store, no model, no clock. That is what
makes a strategy testable without a database or a provider, and it is what keeps
every effect in the runtime where the crash guarantees live. A strategy that
wanted to dispatch something itself could not: it has no port to do it with.

The layer placement follows: strategies live in `domain/strategies/`, alongside
`policy.ts` and `state.ts`, because they are pure functions over values.

## What a strategy sees

```ts
interface AgentCycleInput {
  readonly task: AgentTask;                       // objective, persona, policy, scope, limits
  readonly cycleSeq: number;
  /** The item this cycle dequeued. Absent when the queue was empty. */
  readonly item?: AgentQueueItem;
  /** What remains, in order, after the dequeue. */
  readonly queue: readonly AgentQueueItem[];
  readonly plan: readonly AgentPlanNode[];
  /** Strategy-owned, from the previous cycle of this run. */
  readonly memory: unknown;
  /** A bounded tail of the exchange, for context. */
  readonly recentExchange: readonly AgentMessage[];
  /** Messages appended since the previous cycle finished. Usually empty. */
  readonly newMessages: readonly AgentMessage[];
  /** Every tool call the previous cycle made, with its outcome. */
  readonly lastOutcomes: readonly AgentToolCall[];
  /** Approvals granted or denied since the previous cycle. */
  readonly decisions: readonly AgentApproval[];
  /** Endpoints this task's policy permits, with schemas and descriptions. */
  readonly availableTools: readonly AgentEndpointDescriptor[];
  readonly budget: AgentBudget;   // cycles and tokens remaining
}
```

Note what is **not** here: no store, no gateway, no `Intelligence`. A strategy
cannot reach anything. It reads state and returns intentions.

## What a strategy asks for

```ts
interface AgentModelRequest {
  /** The strategy chooses its own model tier. See "casts" below. */
  readonly cast: Cast;
  /**
   * The runtime prepends its own contract and appends the persona fragment.
   * A strategy supplies the middle.
   */
  readonly system: string;
  readonly messages: readonly Message[];
  /** Structured output schema, if this turn wants one. */
  readonly schema?: Record<string, unknown>;
  /** Which permitted endpoints to bind as tools for this turn. */
  readonly toolNames: readonly string[];
  readonly maxRounds: number;
  /** Recorded on the cycle, so a prompt edit is attributable. */
  readonly promptVersion: string;
  /** Strategy-defined label for the audit view: "decompose" | "work" | … */
  readonly stepKind: string;
}
```

**A strategy picks which tools to bind for a given turn.** A planning turn might
bind only reads; a working turn binds reads and mutations. The policy is the
ceiling; the strategy chooses a subset of it per turn. It can never exceed the
policy, because the runtime builds the `ToolSet` from
`policy ∩ request.toolNames`.

**The persona fragment is appended by the runtime, never by the strategy.** That
is Persona's third consumer law — the fragment goes after the contract, never
before or in place of it — and putting it in the runtime means a strategy cannot
get it wrong.

## What a strategy returns

```ts
interface AgentModelResult {
  readonly structured?: unknown;      // parsed, if a schema was supplied
  readonly text: string;
  readonly toolCalls: readonly AgentToolCall[];   // what happened, with outcomes
  readonly rounds: number;
  readonly exhausted: boolean;        // the round bound was hit
  readonly usage: Usage;
  readonly interrupted?: "steering" | "approval" | "cancelled" | "budget";
}

interface AgentCycleOutcome {
  readonly memory: unknown;
  readonly messages: readonly ProposedMessage[];
  readonly planWrites: readonly PlanNodeWrite[];
  readonly queueWrites: readonly QueueWrite[];
  readonly safeSummary: string;
  readonly next:
    | { kind: "continue" }
    | { kind: "ask"; questions: readonly ProposedQuestion[] }
    | { kind: "settle"; outcome: "completed" | "partial" | "failed";
                        summary: string; unmet?: readonly string[] };
}

type QueueWrite =
  | { kind: "pushFront"; items: readonly ProposedQueueItem[] }
  | { kind: "pushBack";  items: readonly ProposedQueueItem[] }
  | { kind: "complete";  itemId: string }
  | { kind: "supersede"; itemId: string; reason: string };
```

**There is no `act` in `next`.** Mutations already happened, inside the tool
loop, intercepted and committed by the runtime. The strategy sees their outcomes
in `result.toolCalls` and in the *next* cycle's `lastOutcomes`. That is the
simplification interception buys: the strategy never has to describe a mutation
it wants, because asking for one and getting it are the same act.

## The runtime's half

```text
CYCLE
  1. dispatch any approved-but-undispatched tool calls    (runtime)
  2. dequeue the front item, mark it active               (runtime)
  3. request = strategy.plan(input)                       (strategy, pure)
  4. run the model with a ToolSet built from
     policy ∩ request.toolNames, intercepting every call  (runtime)
       └─ per round: onRound → inject steering, or stop
  5. outcome = strategy.interpret(input, result)          (strategy, pure)
  6. ONE TRANSACTION: memory, messages, plan writes,
     queue writes, cycle settle, task counters            (runtime)
  7. boundary: cancelled? blocked? budget? → dispatch the next cycle
```

Steps 3 and 5 are the strategy. Everything else is the substrate, and none of it
moves when the strategy changes.

## Casts: strategies choose their own model arrangement

`Intelligence` routes on a `Cast { purpose, strength, speed }`. A strategy
returns one per turn, so a cheap classification turn and an expensive planning
turn can use different models within the same task:

```ts
// decompose-verify
plan: (input) => input.item?.kind === "decompose"
  ? { cast: { purpose: "general", strength: "high", speed: "low" }, … }
  : { cast: { purpose: "general", strength: "medium", speed: "medium" }, … }
```

The task's `strategy.options` can override the casts, so an operator can point a
task at a stronger model without editing code.

---

# Strategy: `simple-loop`

**The one to build first.** Roughly two hundred lines, and it is enough to prove
the entire substrate.

## What it does

One item on the queue: "achieve the objective". Each cycle asks the model to
make progress, with reads and mutations both bound, and a structured output
saying whether it is done.

```text
plan()      system: the contract + "work toward the objective"
            messages: objective, recent exchange, what happened last cycle
            tools: everything the policy permits
            schema: { status: "working" | "done" | "blocked",
                      summary: string, whatIDid: string,
                      unmet?: string[], question?: … }

interpret() status "working" → memory += this cycle's summary
                               queueWrite: pushBack another "continue" item
                               next: continue
            status "done"    → next: settle completed
            status "blocked" → next: ask
```

Memory is a rolling list of cycle summaries, capped. The queue holds at most one
item at a time. `maxCyclesPerRun` and `maxTokensPerTask` are what stop it.

## What it gets for free

- **Steering.** New messages arrive in `newMessages` and, mid-cycle, are
  injected into the tool loop by `onRound`. The model reacts in the next round.
- **Every safety property.** Policy, approval, commit-before-dispatch, replay
  recovery, dual recording, Activity — all substrate.
- **Legibility.** It writes one plan node per cycle and a `progress` message,
  so `task.plan` and `task.exchange` are populated without special handling.

## What it does not do

No decomposition, no expectations, no verification. It relies entirely on the
model's own judgement of what "done" means, which for narrow objectives is
fine and for broad ones is not.

**Its value is that it is honest about being a baseline.** Building it first
means the first real agent run happens against ~200 lines of strategy rather
than ~1,500, and everything learned from watching it informs the next one.

---

# Strategy: `decompose-verify`

The structured loop. Build it **second**, after watching `simple-loop` run.

## What it does

Turns the objective into a plan tree, works the leaves, and self-checks against
written expectations — using the queue as the traversal.

```text
item "decompose"  → model produces a plan tree, possibly several levels deep
                    in ONE turn
                  → planWrites: the nodes, each with an expectation
                  → pushFront: one "work" item per leaf, in order
                    (front, so this subtree completes before later siblings)

item "work"       → model observes, then acts, in one tool loop.
                    Reads and mutations both bound.
                  → planWrite: observedState on the node
                  → the same turn self-checks against the expectation:
                      met       → planWrite: node done; nothing pushed
                      not-met   → pushFront a "work" item with the gap
                      pending   → pushFront a "recheck" item; the target
                                  accepted but has not settled yet
                      too big   → pushFront a "decompose" item for this node

item "recheck"    → reads only. Re-observe and compare.
                    Same four outcomes.

queue empty       → model reviews the plan tree
                  → all done → settle completed
                  → gaps     → pushBack work items, or settle partial
```

## Why decomposition happens in one turn, not one per level

An earlier version of this design spent one model call per level of the tree,
plus one per goal to sequence, plus one per goal to verify. For a ten-goal task
that is roughly two dozen calls, each re-serialising the full task context.

Nothing requires that. **A reasoning model can emit four levels down to
actionable leaves in a single structured output.** So `decompose` is one turn
producing a whole subtree, and the bound that matters is *how many planning
turns a task may spend*, not how many nodes it produces. That was the token
concern, and this is the answer to it.

The same logic folds verification into the working turn: a turn that just did
the work is the cheapest possible place to check it, because the context is
already loaded. A separate `recheck` item exists only for the case where the
check cannot be immediate.

## The `pending` case, which is easy to get wrong

Some target commands are **asynchronous**. Document's `prompt.create.request`
returns `202` with an `attemptId` — the prompt block does not exist yet, and
will not until Document's own freeze/compute/settle pipeline runs.

A strategy that treated `202` as *not-met* would re-plan and **re-issue the
command**, creating a duplicate attempt. So `pending` is a distinct outcome: the
strategy pushes a `recheck` item to the front and moves on. If the recheck is
still pending after `options.maxRechecks`, it blocks the node with a question
rather than assuming failure.

The runtime offers a shared helper for the common shape — poll a target's own
status endpoint, with backoff — so each strategy does not rediscover this. But
recognising `202` as "accepted, not finished" is the strategy's judgement,
because only it knows what it was expecting.

## Anti-spiral bounds

Strategy-owned, in `strategy.options`:

| Option | Default | Effect at the bound |
| --- | --- | --- |
| `maxPlanDepth` | 6 | the decompose output schema stops offering child nodes |
| `maxPlanningTurns` | 8 | the next turn must produce work, or the node blocks |
| `maxReworkPerNode` | 3 | the node is abandoned; the parent's review sees the gap |
| `maxRechecks` | 5 | the node blocks with a question |

The load-bearing one is `maxPlanDepth`, because it is enforced **in the output
schema**: at the bound, the structured output for a decompose turn simply has no
field for children. A model cannot choose what it cannot emit.

These are strategy options rather than `AgentLimits` because they are meaningless
to `simple-loop`. The substrate's bounds — cycles, tokens, mutations, queue
depth — apply to every strategy.

---

## Adding a strategy

1. Implement `AgentStrategy` in `domain/strategies/<name>.ts`. Pure functions.
2. Register it in `domain/strategies/registry.ts`, keyed on `(name, version)`.
3. Write its prompts in the same file, versioned as constants.
4. Test it with fixture inputs — no database, no model, no runtime.

**Registry lookup is by `(name, version)`, not by name.** A task's binding pins
both, so shipping `decompose-verify@2` cannot change a task already running
`decompose-verify@1`. Old versions stay registered until no live task references
them; a task naming an unregistered version fails at creation, not mid-run.

## What a strategy may never do

These are the substrate's guarantees, and a strategy has no mechanism to break
them — but they are worth writing down as the contract:

- **Dispatch anything.** It has no gateway, no store, no ports.
- **Exceed the policy.** The runtime builds the `ToolSet` from
  `policy ∩ toolNames`.
- **Skip approval.** Interception happens in the runtime's tool handler.
- **Reach outside the frozen scope.** Read tool handlers close over the
  manifest.
- **Precede the persona rule.** The runtime assembles system content.
- **Suppress steering.** `onRound` is the runtime's, not the strategy's.
- **Write the audit record.** Cycles, tool calls, and the exchange are written
  by the runtime; `safeSummary` and messages are *proposed* and validated.

## The one contract a strategy must keep

**`plan()` and `interpret()` must be idempotent with respect to memory.** Given
the same `AgentCycleInput`, calling them again must be safe and produce the same
intentions.

This matters because recovery's answer to an interrupted cycle is *"run it
again"*. The tool calls that already happened are recorded and appear in
`lastOutcomes`; the strategy must plan forward from the world as it now is
rather than assume it is resuming a half-finished turn.

In practice this falls out of the functions being pure over durable state. It is
stated explicitly because it is the one way a strategy author could get it
wrong — by stashing something in memory that assumes the previous cycle
completed.
