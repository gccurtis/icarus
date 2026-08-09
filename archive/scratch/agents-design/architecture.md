# Agents — architecture walkthrough

The whole capability in one pass: the object model, the data behind it, what it
depends on, the endpoints, the loop, a fully worked example, and what you can
expect to do with it.

**Nothing of Agents exists in code yet.** Everything here is design.

---

## 1 · What Agents is

> **A model call becomes real only by passing through the owning capability's
> public endpoint, which validates it, revisions it, and records it as its own
> change.**

Agents owns durable agentic *tasks*: the objective, the frozen inputs a task
runs against, the queue of work it has left, the plan it is working to, the
conversation between a person and the agent, the record of every mutation it
asked for, and the settled result.

It changes nothing directly. It proposes; owning capabilities decide.

It is deliberately **not Automation**. Automation owns triggers and creates
tasks by calling Agents' command port like any other caller.

---

## 2 · The object model

```text
Task              durable, revisioned. Never deleted.
 ├─ objective / origin / persona / policy / limits / strategy / contextEntry
 ├─ scope         frozen KnowledgeScopeManifest, pinned by run 1
 ├─ queue[]       ordered work items. push-front | push-back | dequeue.
 ├─ plan[]        strategy-populated nodes. What a person sees.
 ├─ exchange[]    append-only. The only person↔agent channel.
 └─ Run[]         one continuous attempt. Survives steering.
      └─ Cycle[]  dequeue → plan → model + tool loop → interpret → commit
           └─ ToolCall[]   reads and mutations, every one intercepted
```

### The six ideas that carry the weight

**1 · The queue is the work.** Dequeue an item, do it, push what you discovered
back on. A **deque**: push-back is "more to do later"; push-front is "do this
next, before anything already queued". Depth-first planning is just pushing
children to the front; "that came out wrong, fix it first" is a front push from
a self-check. Work already performed is immutable — a cycle influences only the
*remaining* queue.

**2 · The bound is on cycles, not queue size.** Pushing costs a row; dequeuing
and working an item costs a model call. `maxCyclesPerRun` and `maxTokensPerTask`
are the real budget.

**3 · Every tool call is intercepted.** The model emits tool calls and *stops*;
the runtime executes them. A mutating tool call **is a declaration** — there is
a complete interception point between "the model asked" and "anything happened".

**4 · Steering is injected into the running tool loop.** No provider lets you
push into an in-flight completion. But the tool loop is *ours* — a fresh request
per round with a longer message array — so between rounds we append the new
exchange messages as a `user` turn. Latency is one tool round.

**5 · The strategy is pluggable; the substrate is not.** Two pure functions,
no ports.

**6 · Every cycle commits before its continuation is dispatched.** A restart
mid-plan resumes from the durable queue without re-planning.

### The state machines

```text
                    ┌────────────────────────────────┐
                    ▼                                │
  create ──► queued ──► running ──► waiting ─────────┘
                          │            │      (answer / approval / steering
                          ▼            ▼       resumes the same run)
                   completed | partial | failed | cancelled     (terminal)
```

| Object | States |
| --- | --- |
| Queue item | `pending → active → done \| superseded` |
| Plan node | `pending → active → done \| blocked \| abandoned` |
| Run | `queued → running → succeeded \| failed \| cancelled` |
| Cycle | `started → succeeded \| failed \| cancelled` |
| Tool call | `recorded` (reads) · `rejected \| awaitingApproval \| dispatched → succeeded \| failed` |

Terminal task states are **absorbing**. `waiting` is a task-level state, never a
run-level one — a blocked task keeps its run `running` with nothing dispatched.

---

## 3 · The data model

One SQLite file, `data/agents.db`, twelve tables, prefixed
`ag_<sha256(projectId)[0..16]>_`.

| Table | Holds | The interesting constraint |
| --- | --- | --- |
| `tasks` | the aggregate root | paired scope `CHECK`; attention only when waiting |
| `task_receipts` | create replay | keyed on `request_id` alone |
| `messages` | the exchange | `UNIQUE (task_id, seq)` |
| `queue_items` | the deque | `UNIQUE (task_id, ordinal)`, sparse ordinals |
| `plan_nodes` | what a person sees | generic; the runtime never interprets `kind` |
| `runs` | attempts + strategy memory | `UNIQUE (task_id, attempt)` |
| `cycles` | one turn each | **`UNIQUE (run_id, cycle_seq)`** |
| `tool_calls` | reads and mutations | `request_id UNIQUE` |
| `questions` | question lifecycle | `answer_message_id UNIQUE` |
| `approvals` | approval lifecycle | `tool_call_id UNIQUE`, holds its own digest |
| `transcript` | model-facing messages | `PRIMARY KEY (run_id, msg_seq)` |
| `settlement_outbox` | Activity + Automation | `source_transaction_id UNIQUE` |

### Seven things worth understanding

**Frozen values are stored whole.** `persona_json` and `scope_json` hold
complete snapshots — a task must be readable when the persona has been edited
and the context deleted.

**Persona is `(persona_id, persona_revision)`.** Revision already exists and is
the granularity that answers "which version ran". Both digests stay inside the
snapshot; nothing indexes them.

**The strategy is pinned by name *and* version.** The registry is keyed on the
pair, so `decompose-verify@2` cannot reach a task running `@1`.

**`context_entry_json` holds at most one entry; NULL is the whole project.** A
list can only ever union, so exclusion lives inside a Context.

**Queue ordinals are sparse** — allocated in steps of 1000, so a front push is
`min - 1000` and a back push is `max + 1000`. Renumbering would rewrite the
whole queue on every insertion and break "work already performed is immutable".

**`UNIQUE (run_id, cycle_seq)` makes a duplicate claim a no-op.** The cycle row
is its own receipt.

**Strategy memory lives on the run, not the task**, is capped, and is
explicitly *not* the audit record — cycles, tool calls, plan nodes, the queue,
and the exchange are, and all of those are structured. Losing memory degrades to
"start a fresh run over durable state".

The recovery working set is partial indexes, and the one that matters most:

```sql
CREATE INDEX ag_${prefix}_calls_unsettled
  ON ag_${prefix}_tool_calls(state, created_at)
  WHERE state IN ('dispatched', 'awaitingApproval');
```

### Retention

Agents is a **ledger**, not a revisioned resource. No history table, no
`task.delete`, no `task.purge`. The precedent is Activity. A task is the only
Agents-side evidence of calls that were proposed, refused, or denied.

**It is still bound into `ResourceRetentionScheduler`**, with a `pruneHistory`
that sweeps failed-task transcripts and a `purgeExpired` that returns a constant
zero — which makes "kept forever" a visible decision rather than an absence.

---

## 4 · Runtime dependencies

```text
application ──► #persona                    resolve() — at creation only
            ──► #platform/knowledge         resolveScope, retrieve, read
            ──► #platform/intelligence      reasonWithToolsStructured, ToolSet
            ──► #platform/observability     Logger
            ──► ports/activityPublisher     adapter built in 1-init
            ──► ports/endpointGateway       adapter built in 1-init
```

### Persona — creation-time only

`personas.resolve(personaId, { sections })` is called **once**, in
`agentTaskService.create`. Every later use reads the frozen snapshot.

Persona states six consumer laws and **cannot enforce any of them**:

| Law | How Agents keeps it |
| --- | --- |
| Resolve once per task | One call site, enforced by a grep test |
| Persist before the first model call | Written in the creation transaction |
| The fragment never precedes the contract | The **runtime** assembles system content: contract, strategy prompt, then persona. A strategy cannot influence the order. |
| Union only — never narrows scope | The absent-entry guard, below |
| Never substitute silently | Unknown/deleted persona is a 400 |
| Never log section text | Logs carry ids, revision, and section *count* |

That last is a prohibition, not a feature — `background` is "standing facts the
task should assume", user-authored prose that can hold anything.

```ts
const scopeEntriesFor = (task, snapshot): ContextEntry[] => {
  // An absent task entry already means the whole project, which subsumes
  // anything the persona could reference. Adding it here would narrow the task.
  if (!task.contextEntry) return [];
  return snapshot.context ? [task.contextEntry, snapshot.context]
                          : [task.contextEntry];
};
```

### Knowledge

`resolveScope` once, by the first run. `knowledge_retrieve` and `knowledge_read`
bound as tools in every cycle. The manifest pins **membership, not content** —
retrieval is always against current material, and mid-task drift is accepted and
expected.

### Intelligence

`reasonWithToolsStructured` runs each cycle's model call. **Two platform changes
are needed**: a non-throwing bounded mode, and an `onRound` hook for steering
injection. Both land in the same function. See
[supplementary-changes.md](supplementary-changes.md).

### Activity

Everything the agent does reaches Activity through a narrow outbound port:
`agent.task.created`, `agent.mutation.committed`, `agent.mutation.refused`,
`agent.task.settled`. Reads and cycles do not.

### Every other capability — one gateway

```ts
export interface AgentEndpointGateway {
  catalogue(): readonly AgentEndpointDescriptor[];
  call(input: AgentEndpointCall): Promise<AgentEndpointOutcome>;
}
```

`call()` builds a `RequestEnvelope`, hands it to `registry.createJob`, admits
the job, awaits the `JobResponse`. The transport path minus Fastify — so
validation, queue placement, error mapping, and receipt idempotency are all the
target's own, and **a new capability becomes reachable by adding one
descriptor**.

The catalogue is **declared in one file**, not derived. One runtime rule makes
it safe: **a concurrent job may enqueue a serial job; a serial job must never
await one.** Every cycle runs on the agent pool.

---

## 5 · Endpoints

```text
POST /agents/command    serial      inline
POST /agents/query      concurrent  inline
```

```ts
type AgentCommand =
  | { type: "task.create";  requestId; input: CreateTaskInput }
  | { type: "task.steer";   taskId; expectedRevision; message }
  | { type: "task.answer";  taskId; expectedRevision; questionId; answer }
  | { type: "task.approve"; taskId; expectedRevision; toolCallId; requestDigest;
                            decision: "grant" | "deny"; note? }
  | { type: "task.cancel";  taskId; expectedRevision; reason? };

type AgentQuery =
  | { type: "task.get" | "task.list" | "task.exchange" | "task.plan"
           | "task.queue" | "task.runs" | "run.cycles" | "task.attention"
           | "task.toolCalls"; … };
```

`task.exchange` with `afterSeq` is the UI's polling primitive. `task.attention`
is the inbox. **`task.plan` and `task.queue`** are what make a task legible
before it acts — the plan is what the agent intends, the queue is what it has
left, in order.

Five internal intents:

```text
agents.run.start   agents.cycle          [agent pool]
agents.run.settle  agents.task.settle  agents.task.recover   [serial]
```

Down from eight, because the runtime no longer branches on what kind of turn a
cycle is. That is the substrate/strategy line showing up in the job table.

---

## 6 · The loop

```text
CYCLE  (one job, on the agent pool)

 1. claim            insert cycle row (runId, cycleSeq) state "started"
 2. settle approvals dispatch any granted-but-undispatched tool calls
 3. dequeue          take the lowest-ordinal pending item, mark it active
 4. plan             request = strategy.plan(input)                [pure]
 5. work             run the model with ToolSet = policy ∩ request.toolNames,
                     intercepting every call
                       └─ between rounds: onRound → inject steering, or stop
 6. interpret        outcome = strategy.interpret(input, result)   [pure]
 7. commit           ONE TRANSACTION: memory, messages, plan writes,
                     queue writes, cycle settle, counters, outbox
 8. boundary         cancelled? blocked? budget? → else dispatch cycle n+1
```

Steps 4 and 6 are the strategy. Everything else is the substrate.

### The tool loop, and where every guarantee lives

```text
round:
  response = provider.reason(messages, tools)
  if no toolCalls → done

  ── the runtime sees ALL of this round's calls before executing ANY ──
  ├─ classify read vs mutation from the catalogue descriptor
  ├─ if any mutations: append ONE `plan` message
  │     "about to: update doc-q3 (2 operations), refresh output out-5"
  │
  └─ per call:
       READ      → gateway, record a row, return the result
       MUTATION  → policy → reject | require approval | allow
                   allowed: TX(row `dispatched`, requestId, digest)
                            gateway.call(...)
                            TX(row terminal, progress message, outbox)

  onRound:
    ├─ approval pending / cancelled / budget → "stop"
    └─ headSeq moved → inject the new messages as a `user` turn, continue
```

**The model never mutates anything.** It asks; we act. That interception point
is where policy, approval, the durable record, attribution injection, and the
Activity row all live — one place, one order.

---

## 7 · A task, start to finish

Objective: *"Add a summary block at the top of the Q3 review that pulls from the
customer interviews."*

Policy: `POST /documents/query` (read), `POST /documents/command` scoped to
`resourceIds: ["doc-q3"]`, `approval: "never"`. Context entry: absent — the
whole project. Strategy: `simple-loop@1`.

### Creation (serial job, not a cycle)

```text
POST /agents/command { task.create, requestId: "req-1", … }
  ├─ resolve persona   → snapshot (revision 4, five sections)
  ├─ resolve limits    → preset "standard"
  ├─ resolve strategy  → simple-loop@1; validateOptions({})
  ├─ validate policy   → both keys exist in the catalogue
  └─ TX: task (queued, scope NULL), message seq 1 "objective",
         queue item ordinal 0 { kind: "work", label: "Achieve the objective" },
         run 1, receipt, outbox agent.task.created
  → 201 { taskId: "tsk-7" }
```

### `agents.run.start`

Pins the scope — whole project, ~340 sources — and dispatches cycle 1.

### Cycle 1

Dequeues the seed item. `simple-loop.plan()` builds: the contract, its own
working prompt, the persona fragment, the objective, and a structured schema
`{ status, whatIDid, summary, unmet?, question? }`. Binds all permitted tools.

The tool loop runs:

```text
round 1  knowledge_retrieve "Q3 review"          → 3 regions       [read row]
round 2  document_query { document.list }        → 12 documents    [read row]
round 3  document_query { document.load doc-q3 } → rev 12, row-1   [read row]
round 4  ── mutations in this round ──
         plan message: "about to: create a prompt block in doc-q3"
         document_command { prompt.create.request, blockId: "blk-summary",
                            placement: { in-row, row-1, before blk-a }, … }
           ├─ policy: permitted, doc-q3 in resourceIds, approval never
           ├─ TX: tool_call `dispatched`, request_id "agent:tc-9"
           ├─ gateway → POST /documents/command
           │     injected: requestId, origin "agent",
           │               actorId "agent:tsk-7:tc-9"
           │     Document runs its own decoder, serial queue, receipt
           │     ← 202 { prompt.create-requested, attemptId: "att-3" }
           └─ TX: row succeeded, progress message, outbox
         → tool result returned to the model: { ok: true, statusCode: 202, … }
round 5  model returns structured output, no tool calls
```

```json
{ "status": "working",
  "whatIDid": "Created a prompt block request (attempt att-3). Document accepted
               it with 202 — the block will not exist until its pipeline settles.",
  "summary": "Requested the summary block; waiting for it to settle." }
```

`interpret()` pushes a `work` item to the **back** with a payload noting the
pending attempt, writes a plan node, and returns `continue`.

**Surfaced:** *"about to: create a prompt block in doc-q3"*, then *"Requested
the summary block; waiting for it to settle."* Activity gets
`agent.mutation.committed`.

### Cycle 2 — the async case

Dequeues the follow-up. Two reads — `document.attempt` and `document.load` —
show `att-3` still `computing`.

```json
{ "status": "working",
  "whatIDid": "Attempt att-3 is still computing. Did not re-issue the command.",
  "summary": "Still waiting for the prompt output." }
```

**This is the case a naive loop gets wrong.** `202` means *accepted, not
finished*. A strategy that read it as failure would re-issue
`prompt.create.request` and create a duplicate attempt. The descriptor's
`asynchronous: true` flag and the prompt both tell the model so, and the
substrate offers a poll-with-backoff helper.

### Cycle 3

Reads show rev 13, `blk-summary` first in row 1, output `out-5` published with
evidence citing interview sources.

```json
{ "status": "done",
  "whatIDid": "Verified the block exists at the top with a grounded output.",
  "summary": "Added a summary block at the top of the Q3 review, grounded in the
              customer interviews." }
```

`interpret()` returns `settle: completed`. The settle transaction writes the
result, supersedes nothing (the queue is empty), prunes transcripts, and stages
`agent.task.settled`.

**Total:** 3 cycles, 1 mutation, 6 reads, 4 Activity rows.

Note what did *not* happen: no separate planning turn, no per-mutation
declaration round trip, no verify call. The self-check happened in the same tool
loop that did the work, because the context was already loaded.

---

## 8 · What steering does to that run

Suppose that during cycle 1, round 3, the user sends:

> *"Actually put it at the end, not the top — and mention the pricing feedback
> specifically."*

**Step 1 — the command lands.** Serial job: CAS on the task revision, append at
`head_seq + 1` with `in_response_to_seq` = the prior head. Returns 200. No run
is dispatched — one is already running.

**Step 2 — `onRound` injects it.** After round 3's read results are appended,
`onRound` sees `head_seq` moved and appends:

```json
{ "role": "user",
  "content": "New direction from the operator: Actually put it at the end, not
              the top — and mention the pricing feedback specifically." }
```

**Step 3 — the model reacts in round 4.** It has not made the mutation yet. It
issues `prompt.create.request` with a different placement and a different prompt
body. **The redirect cost one tool round.**

Had the steering arrived one round later — after the mutation dispatched — the
block would exist at the top, recorded and real. Cycle 2's `plan()` would see it
in `lastOutcomes`, and the model would plan a *move* rather than a create,
because it is always planning forward from the current state.

### Three things this illustrates

**Steering does not require chopping work into small units.** That was the
tension the whole design was fighting. The injection point is every tool call,
and the model is hitting those constantly anyway.

**Nothing is ever left half-finished.** A mutation either dispatched (recorded,
real, part of current state) or did not. There is no third case, which is what
makes copy-on-write shadowing unnecessary rather than merely expensive.

**Bigger redirects reshape the queue.** If the steering had been *"forget the
summary, I want a comparison table"*, `interpret()` would supersede the pending
queue items — **keeping their labels, payloads, and reasons** — and push new
ones. The superseded plan is handed to the next cycle, which is what lets a
strategy amend rather than restart.

| Event | What happens |
| --- | --- |
| `task.answer` closes the last required question | task → running; dispatch a cycle |
| `task.approve` grant | dispatch a cycle; **step 2 dispatches the approved call** before any model work |
| `task.approve` deny | the call is `rejected`; the strategy sees it in `decisions` |
| `task.cancel` | the cycle unwinds at its next round; the run settles `cancelled` |

---

## 9 · The safety model

```text
model tool call       untrusted   the model asks; nothing has happened yet
      ▼
Agents interception   trusted     policy: is this endpoint reachable for this task?
      ▼
approval gate         human       does a person allow these exact arguments?  (opt-in)
      ▼
capability endpoint   trusted     is this request valid for that resource?
      ▼
capability state      canonical   its own revision, history, and validation
```

Policy evaluation is deny-by-default, total, and runs **inside the tool
handler**:

```text
1. catalogue must hold the key       else → rejected "unknown_endpoint"
2. an entry must match the key        else → rejected "not_permitted"
3. resourceIds present? extract and check
                                      else → rejected "resource_not_permitted"
4. non-mutating?                       → dispatch
5. mutation count < maxMutations      else → rejected "mutation_budget"
6. approval "always"?                  → awaitingApproval, else dispatch
```

**A rejection is returned to the model as a tool result, not thrown.** The model
sees `{ ok: false, error: "not_permitted" }` and can choose differently in the
very next round.

**Tools are built from `policy ∩ request.toolNames`.** A strategy chooses a
subset of its policy per turn and can never exceed it.

**Approval defaults to `"never"`, and the gate is still strict.** The policy is
already the blast radius — mandatory, reviewed at creation, immutable, able to
name explicit resource ids. When the gate *is* on, it authorises one call with
those exact arguments, bound to its digest, and **the runtime dispatches the
granted call** rather than asking the model to re-issue it.

**Attribution is injected by the gateway**, stripping anything the model
supplied:

```ts
{ requestId: `agent:${toolCallId}`, origin: "agent",
  actorId: `agent:${taskId}:${toolCallId}`, command: /* unmodified */ }
```

**A strategy bug cannot become a safety bug.** Strategies are pure functions
with no ports — they cannot dispatch, exceed policy, skip approval, reach
outside the frozen scope, or write the audit record.

---

## 10 · Recovery

Two places, **neither a timer**: startup, awaited before `app.listen`; and
opportunistically when a run settles.

| Found | Action |
| --- | --- |
| run `queued`, no cycles | re-dispatch `run.start` |
| task `queued`, no scope pinned | re-dispatch `run.start`; it pins |
| cycle `started`, no outcome | fail it, return its queue item to `pending`, dispatch a fresh cycle |
| tool call `dispatched`, no result | **re-dispatch under the same `requestId`** |
| tool call `awaitingApproval`, approval `granted` | dispatch it |
| queue item `active`, no live cycle | return it to `pending` |
| queue non-empty, run not running | dispatch a cycle |
| outbox row unpublished | republish |

**An interrupted cycle is re-run, not resumed.** Safe because the strategy is
pure over durable state — tool calls that already executed are recorded and
appear in `lastOutcomes`, so the fresh cycle plans forward from the world as it
now is. **The durable queue and plan carry forward**, so a restart mid-plan does
not re-plan.

```text
tool call `dispatched`, no result
  └─ re-dispatch the identical command with the same request_id
       ├─ the target replays its receipt   → it landed; write the result ref
       └─ the target executes              → it had not landed; it lands now
```

**The only requirement on a target: be idempotent by caller-supplied request
id.** Document, Comments, and Templates already are.

---

## 11 · What this gives you

### What you'll be able to do

**Create a task** with an objective, a persona, one context reference (or none),
a limits preset, a strategy, and a policy naming exactly which endpoints and
resources it can reach.

**See what it intends before it acts** — `task.plan` and `task.queue`.

**Watch it work** — `task.exchange` with `afterSeq`.

**Steer it mid-flight** and have the redirect land within one tool round, with
the superseded plan handed to the re-planner rather than thrown away.

**Answer questions. Approve or deny mutations. Cancel. Work a queue**
(`task.attention`).

**Audit it completely.** Every read and every mutation is a `tool_calls` row.
Every cycle records what it did, which prompt version, how many rounds, and why
it unwound. **This is the only place a refused mutation exists.**

**See it in the project feed** — creation, every committed mutation, every
refusal, and settlement.

### What the design promises

- **A task's blast radius is knowable from its creation record, forever.**
- **Every effect is attributable from three directions** — the Agents row, the
  target's own change, and Activity.
- **A crash never hides an effect, and never loses a plan** — queue and plan are
  rows.
- **No effect is applied twice**, given a target idempotent by request id.
- **A persona or strategy edited tomorrow can't reach a task started today.**
- **Steering never leaves half-finished work.**
- **The loop can change without touching the substrate.**

### What it does not promise

- **A permitted command used badly.** Policy constrains reach, not judgment.
- **Prompt injection defence.** With approval off by default, **the policy is
  doing nearly all of this work**.
- **Cost exhaustion by a hostile objective.** Bounds cap it.
- **Mid-completion cancellation.** No `AbortSignal` exists; cancel unwinds at a
  tool round boundary.
- **Task deletion.** By design.
- **Undo of effects.** That belongs to the target capabilities.
- **A stable corpus mid-task.** Retrieval is always current.

---

## 12 · The machinery, on one page

| Moving part | Where |
| --- | --- |
| Two endpoints, command (serial) / query (concurrent) | `4-job-wiring/agents/registerAgentEndpoints.ts` |
| Five internal intents, total switch | `createAgentJobs.ts` |
| Twelve SQLite tables | `persistence/sqliteSchema.ts` |
| The deque, sparse ordinals, front/back push | `domain/state.ts` + schema |
| Cycle idempotency `UNIQUE (run_id, cycle_seq)` | schema |
| **Tool interception** — policy, approval, commit-before-dispatch, attribution | `application/agentToolHost.ts` |
| Steering injection via `onRound` | `application/agentRunner.ts` |
| Strategies — two pure functions, no ports | `domain/strategies/` |
| Reaching capabilities — one gateway, declared catalogue | `ports/endpointGateway.ts`, `1-init/create/agentEndpointGateway.ts` |
| Outbound notification — one outbox, two destinations | schema + `ports/activityPublisher.ts` |
| Recovery — startup + opportunistic | `application/agentRecovery.ts` |
| Retention — prune failed transcripts, purge returns 0 | bound in `startBackend.ts` |
| Limits — named presets, resolved and frozen per task | `0-utils/config` + `domain/limits.ts` |

**Blocking prerequisites outside Agents** — full list in
[supplementary-changes.md](supplementary-changes.md):

1. `reasonWithToolsStructured` needs a non-throwing bounded mode **and** an
   `onRound` hook. Same function; land them together.
2. `buildInternalEnvelope` beside `RequestEnvelope`, plus the re-entrancy rule
   written down and tested.
3. A third worker pool for agent work.
4. An `agents:` config section with named limit presets.
5. `#agents` aliases and the wiring-test assertion.

Notably **not** on that list: any change to Document, Derived Outputs, Comments,
Templates, Activity, or Persona.

**The build order** — full detail in
[implementation-plan.md](implementation-plan.md):

1. Task, queue, and exchange — no runs.
2. `simple-loop` with read-only policy. **The first real agent run.**
3. Steering injection and questions.
4. Mutation interception, against Derived Outputs.
5. Approval gating.
6. Document as a mutating target.
7. `decompose-verify`.
8. Automation origin.
