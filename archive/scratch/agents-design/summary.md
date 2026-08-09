# Agents capability — design summary

## Purpose

Agents is a regular project-scoped capability under `3-capabilities/agents/`.
It owns **durable agentic tasks and the management of them**: the objective, the
frozen inputs a task runs against, the queue of work it has left, the plan it is
working to, the exchange through which a person and the agent talk, the record
of every mutation it asked for, and the settled result.

An agent changes nothing directly. It proposes; owning capabilities decide.

> **A model call becomes real only by passing through the owning capability's
> public endpoint, which validates it, revisions it, and records it as its own
> change.**

Agents is deliberately **not** Automation. Automation owns triggers — schedules,
source changes, data conditions — and creates or steers tasks by calling Agents'
command port like any other caller. Agents has no timers and no opinion about
why a task was created. The seam is one field on a task (`origin`) and one
outbound notification when an automation-origin task settles.

## The shape

```text
Task              durable, revisioned. The whole engagement. Never deleted.
 ├─ objective     immutable after creation
 ├─ origin        { user } | { automation, automationId }
 ├─ persona       frozen PersonaSnapshot, pinned by (personaId, revision)
 ├─ policy        frozen AgentToolPolicy, over endpoint keys
 ├─ limits        frozen AgentLimits, resolved from a named preset
 ├─ strategy      frozen { name, version, options } — how this task works
 ├─ contextEntry  at most one; absent means the whole project
 ├─ scope         frozen KnowledgeScopeManifest, pinned by run 1
 │
 ├─ queue[]       ordered work items. push-front | push-back | dequeue.
 ├─ plan[]        strategy-populated nodes. What a person sees.
 ├─ exchange[]    append-only. The only person↔agent channel.
 │
 └─ Run[]         one continuous attempt. Survives steering.
      └─ Cycle[]  dequeue → plan → model + tool loop → interpret → commit
           └─ ToolCall[]   reads and mutations, every one intercepted
```

## The six ideas that carry the weight

**1 · The queue is the work.** A task advances by dequeuing an item, doing it,
and pushing what it discovered back on. It is a **deque**: push-back is "more to
do later", push-front is "do this next, before anything already queued".
Depth-first planning is just pushing children to the front; "that came out
wrong, fix it before moving on" is a front push from a self-check. Work already
performed is immutable — a cycle influences only the *remaining* queue.

**2 · The bound is on cycles, not queue size.** Pushing costs a row; dequeuing
and working an item costs a model call. `maxCyclesPerRun` and `maxTokensPerTask`
are the real budget. `maxQueueDepth` exists only so a runaway strategy cannot
fill the database.

**3 · Every tool call is intercepted.** The model emits tool calls and *stops*;
the runtime executes them. So a mutating tool call **is a declaration** — there
is a complete interception point between "the model asked" and "anything
happened", where policy, approval, the durable record, attribution injection,
and the Activity row all live. The model cannot change anything directly, only
ask us to.

**4 · Steering is injected into the running tool loop.** There is no way to push
into an in-flight completion — not in OpenRouter, not in the provider APIs. But
the tool loop is *ours*: it makes a fresh request per round with a longer
message array, so between rounds we append the new exchange messages as a `user`
turn. **Steering latency is one tool round, not one cycle and not one run**, and
it costs nothing extra because the round trip was already being paid for.

**5 · The strategy is pluggable; the substrate is not.** A strategy is **two
pure functions** — `plan()` builds a model request, `interpret()` reads the
result and returns changes. No ports, no I/O. Everything else — task identity,
frozen inputs, the queue, the exchange, cycles, interception, policy, the
gateway, dispatch, recovery, Activity, retention — is the substrate, and does
not change when the loop does.

**6 · Every cycle commits before its continuation is dispatched.** Durable state
is the authority for what still needs doing; the in-memory queue never is. A
restart mid-plan resumes from the durable queue without re-planning.

## How Agents reaches other capabilities

**Through one gateway over the existing job registry — not injected runtimes,
not per-capability adapters.**

```text
tool handler ──► gateway.call("POST /documents/command", body, requestId, actor)
                   └─► registry.createJob(envelope) ──► scheduler.admit(job)
                          └─► the capability's own endpoint, wire decoder,
                              queue placement, error ladder, and receipt
```

Every safety property comes from the path already being correct, and **a new
capability becomes reachable by adding one descriptor** rather than an adapter,
a port, and a composition-root entry.

The catalogue is **declared in one file**, not derived from the registry —
deriving would make every route agent-reachable the moment it registers,
including purges. Declaring keeps "adding agent access" an explicit, reviewable
decision.

One runtime rule makes it safe: **a concurrent job may enqueue a serial job; a
serial job must never await one.** Every cycle runs on the agent pool.

## Ownership boundaries

Agents owns: task identity, objective, origin, lifecycle; the pinned persona,
scope, policy, limits, and strategy; the work queue and the plan; runs, cycles,
and settlement; the durable exchange; the record of every call asked for,
refused, or landed; approval gating; and safe result summaries.

Agents does not own: **triggers** (Automation); persona definitions (Persona);
Context records or set algebra — a caller composes what it wants and hands over
one reference; the canonical effect of any mutation (the target's state and
revision); model routing (Intelligence casts); or hidden model reasoning, which
never leaves the Intelligence port.

Product storage holds the objective, the queue, the plan, safe summaries,
questions, operator messages, mutation records and result references, and
settlement summaries. It does **not** hold raw provider responses,
chain-of-thought, or hidden reasoning tokens.

## Corrections to the older Notion model

`docs/capabilities-old/agents.md` describes a design that was never built.

| Older model | This design | Why |
| --- | --- | --- |
| `POST /agents/tasks/:taskId/answers` and eight more path-param routes | `POST /agents/command` + `POST /agents/query` | The backend has **no path parameters anywhere**; `getEndpointKey` is exact string equality. Command/query with a discriminated body is the preferred house shape. |
| New `4-job-wiring/internal/InternalJobDispatcher.ts` | Existing `SchedulerInternalJobsRuntime<AgentInternalJobIntent>` | That seam already exists, with the dispatch/registrar split and a retryable-admission predicate. |
| `AgentToolRegistry` mapping model proposals | The endpoint gateway plus a declared catalogue | Reaching a capability through its own registered endpoint reuses its validation, queue, errors, and receipts. |
| `agent_task_changesets` with `inverse_operations_json` | Append-mostly queue and cycle log, no inverses | Task control is not undoable content. Undo of *effects* belongs to the target capabilities. |
| `agent_stage_receipts` table | Idempotency on `(runId, cycleSeq)` in the cycle row | The cycle row is its own receipt. |
| Persona pinned as `(library\|local, id, version, digest)` | `(personaId, revision)` plus the full snapshot | Persona has no library/local split, and revision already identifies the version. |
| `mode: "plan" \| "action"` | Absent | Expressed by tool policy, and by which strategy a task runs. |

## Reading order

| File | Covers |
| --- | --- |
| [architecture.md](architecture.md) | The whole capability in one pass, with a worked example |
| [canonical-model.md](canonical-model.md) | Task, queue, plan, run, cycle, exchange, tool calls; invariants |
| [execution.md](execution.md) | Creation and freeze, the cycle, the tool loop, steering, recovery, settlement |
| [strategies.md](strategies.md) | The strategy interface, `simple-loop`, `decompose-verify` |
| [tools.md](tools.md) | Interception, the gateway, policy, approval, attribution, threat model |
| [operations.md](operations.md) | Commands, queries, endpoints, jobs, queue placement, errors, logging |
| [store.md](store.md) | SQLite schema, transaction boundaries, retention |
| [file-architecture.md](file-architecture.md) | Module layout, the substrate/strategy line, composition, tests |
| [implementation-plan.md](implementation-plan.md) | The staged build, with files, tests, and verification |
| [supplementary-changes.md](supplementary-changes.md) | Changes **outside** Agents that this design depends on |
| [review-2026-08-02.md](review-2026-08-02.md) | The review the first revision came out of |

Read [architecture.md](architecture.md) for the whole picture;
[canonical-model](canonical-model.md) and [execution](execution.md) for the
detail; [tools](tools.md) for the safety argument. The review is history rather
than specification.

## Build staging

1. **Task, queue, and exchange — no runs.** Create, list, get, steer. Proves the
   aggregate, the endpoints, the receipt, the persona freeze, and the queue.
2. **`simple-loop` with read-only policy.** Scope pinning, cycles, the tool
   loop, read interception, plan nodes. A task can answer a question about the
   project. **This is the first real agent run, against ~200 lines of strategy.**
3. **Steering injection and questions.** The `onRound` hook, mid-loop injection,
   `waiting` and resume.
4. **Mutation interception.** Policy, commit-before-dispatch, replay recovery,
   Activity — against Derived Outputs as the first mutating target, which is
   already idempotent by caller-supplied key.
5. **Approval gating.** The unwind, the grant, runtime dispatch of an approved
   call.
6. **Document as a mutating target.** The first target that changes something a
   person authored. From here, adding a target is a catalogue descriptor.
7. **`decompose-verify`.** The structured strategy, built after watching
   `simple-loop` run.
8. **Automation origin.** The settlement outbox row Automation consumes.

Full detail in [implementation-plan.md](implementation-plan.md).

**Why `simple-loop` first.** The first real agent run happens against ~200 lines
of strategy rather than ~1,500, and everything learned from watching it informs
the structured one. Stages 1–3 change nothing a person authored, so the risky
part is built after the machine is proven.

## Decision register

Two tags: **Structural** — reversing it changes tables, types, or the execution
shape. **Behavioural** — reversing it changes how the capability acts, but the
shape survives.

**If you read six, read D1, D3, D7, D12, D35, and D40.** Those carry the safety
argument (D1, D3), the crash story (D7), the interaction model (D12), how Agents
reaches everything else (D35), and where the loop can change (D40).

D24 and D26 are retired, not missing — see the end.

### A. Safety and permission model

**D1 · Mutations go through the target's own public endpoint, never a bespoke
adapter.** *Structural.* The gateway builds a `RequestEnvelope` and dispatches
through the existing `JobRegistry`, so validation, queue placement, error
mapping, and receipt-based idempotency are all the target's own.

**D2 · Approval is granted per mutation, bound to an exact request digest.**
*Structural.* Digest binding stops a later cycle re-proposing the same logical
call with different arguments and inheriting the grant. And **a granted call is
dispatched by the runtime, not re-issued by the model** — asking the model to
reproduce it might not produce the same arguments, which would silently escape
the approval.

**D3 · Mutating policy entries default to `approval: "never"`.** *Behavioural.*
An author opts *in* to the gate. The policy is already the blast radius, and it
is mandatory, reviewed at creation, and immutable. Requiring a click per edit on
top of an enumerated resource id list makes the common case tiresome enough that
authors route around it. The cost is named: the safe configuration is the one
you have to remember to write, which makes **"enumerate the resource ids"** the
habit worth building.

**D4 · Policy is frozen at creation; there is no grant command.** *Structural.*
A task's blast radius is knowable from its creation record forever.

**D5 · A refused mutation is returned to the model as a tool result, not an
error.** *Behavioural.* It is recorded, published as `agent.mutation.refused`,
and the model sees the refusal and can choose differently **in the very next
round** — not the next cycle. Failing the cycle would waste the round trip and
train callers toward permissive policies.

**D6 · Prompt injection is not structurally defended.** *Behavioural.* Retrieved
content is untrusted text. The mitigation is structural: the call must be a
bound tool and pass policy, so injection can at worst cause a *permitted*
action. Content is delimited and labelled untrusted — a speed bump, described as
one. With D3 flipped, the policy does nearly all of this work.

**D35 · The agent-reachable endpoint catalogue is declared, not derived.**
*Structural.* Deriving from `registry.listEndpoints()` would make every route
agent-reachable the moment it registers, including purges. A descriptor naming
an unregistered key is a fatal startup error.

**D41 · Mutations are intercepted tool calls, not declared structured output.**
*Structural.* **CHANGED.** An earlier draft had the model declare mutations as
structured output, on the belief that a tool handler could not give the crash
guarantee. It can — the handler is ours and commits before it dispatches.
Interception is strictly better: no per-endpoint output schema to maintain
against every target's wire shape; "here is what I am about to do" survives
because a round's calls are all visible before any executes; and strategies stop
needing an `act` outcome, because asking for a mutation and getting one are the
same act.

### B. Durability and recovery

**D7 · A mutating target must be idempotent by caller-supplied `requestId`;
there is no `lookup(requestDigest)`.** *Structural.* An earlier draft required
the latter, believing Document stored a digest index. It does not — the digest
is only compared against a receipt found by request id, and no digest lookup
exists anywhere in the tree. Since Agents mints the request id
(`agent:<toolCallId>`, committed before dispatch), recovery re-dispatches the
identical command and the target's existing receipt replays. Document, Comments,
and Templates already qualify unchanged.

**D8 · An unknown-outcome mutation is re-dispatched, not escalated.**
*Structural.* The target either replays its receipt or executes. Either way the
outcome becomes known and nothing is applied twice. The trade: re-dispatch
*acts* if the call had not landed — which for every command in the tree is the
desired outcome.

**D9 · At most one mutating call per run is `dispatched` at a time.**
*Behavioural.* Holds because the handler awaits each dispatch before returning
to the model. It is what keeps the crash story finite: never more than one call
whose outcome is unknown.

**D10 · A run transcript is stored separately from the exchange.** *Structural.*
Different audience, different lifetime, no read path. A cycle's input is
assembled mostly from rows, not the transcript, which is what makes an
interrupted cycle safe to re-run rather than resume.

**D11 · Transcripts are pruned when a task settles; failed tasks keep theirs
until the shared retention sweep.** *Behavioural.* Under a pure keep-everything
policy nothing would prune provider-facing message arrays.

**D42 · An interrupted cycle is re-run, not resumed.** *Structural.* Its
in-memory conversation is gone; re-deriving is cheaper and safer than pretending
to continue. Safe because the strategy is pure over durable state — tool calls
that already executed are recorded and appear in `lastOutcomes`. **This is the
one contract a strategy must keep**: `plan()` and `interpret()` must be
idempotent with respect to memory.

### C. Task, queue, and exchange semantics

**D12 · Steering is injected into the running tool loop.** *Structural.* There
is no way to push into an in-flight completion, but the tool loop is ours: a
fresh request per round with a longer message array, so between rounds we append
the new messages as a `user` turn. **This decouples steering responsiveness from
work granularity**, which is the tension the whole design was fighting — cycles
can be as large as a strategy wants and a redirect still lands within one round.

Earlier drafts made steering wait for a whole run, then a whole work unit. Both
were solving the wrong problem.

**D43 · Superseded queue items keep their label, payload, and reason, and are
handed to the strategy.** *Structural.* A person redirecting usually means "also
do this" or "do that part differently", not "forget everything". Handing the old
plan back is what lets a strategy amend rather than restart.

**D13 · Steering cannot widen scope.** *Behavioural.* Follows from D4.

**D14 · Terminal states are absorbing; there is no reopen.** *Structural.*

**D15 · The result is both a message in the exchange and a field on the task.**
*Behavioural.* The exchange is the narrative; the field is the queryable
outcome.

**D16 · `waiting` is a task state; runs have no `waiting` status.**
*Structural.* A blocked task keeps its run `running` with nothing dispatched.

**D17 · When both a required question and an approval are pending, `attention`
reports `"question"`.** *Behavioural.*

**D18 · Cancel lets an already-dispatched mutation finish and be recorded.**
*Behavioural.* Cancel means "stop starting new work", not "undo".

**D19 · Required and optional questions are distinguished.** *Behavioural.*

**D32 · A task carries at most one Context entry.** *Structural.* A list can
only ever union — *"the whole project except X"* is not expressible by
enumeration. Exclusion lives inside a Context via `POST /contexts/difference`.
Agents never performs set algebra. Absent means the whole project.

**D33 · Persona is pinned by `(personaId, revision)`, not by digest.**
*Structural.* Revision already exists and is the granularity that answers "which
version ran". Both digests stay inside the snapshot; nothing indexes them.

**D34 · Corpus drift mid-task is accepted, not fenced or recorded.**
*Behavioural.* The scope pins membership, not content. An agent working on live
project material should see live project material.

**D44 · Plan nodes are generic, not a goal tree.** *Structural.* Any strategy
can populate them; the runtime never interprets `kind` or the tree's shape. They
exist as core schema — rather than living inside opaque strategy memory —
because **"a person can see what the agent intends before it acts"** is what
makes steering directive rather than reactive, and that must survive a strategy
change.

### D. Shape and surface

**D20 · No `mode: "plan" | "action"`.** *Structural.* Expressed by policy, and
by which strategy a task runs.

**D21 · No `task.pause` and no `task.resume`.** *Behavioural.*

**D22 · `(runId, cycleSeq)` uniqueness is the only idempotency mechanism for the
execution path.** *Structural.* The cycle row is its own receipt.

**D23 · There is no task-delete command; tasks are kept indefinitely.**
*Behavioural.* The precedent is Activity — append-only, excluded from
revision-history retention. Agents is still bound into the retention scheduler,
with a `pruneHistory` that sweeps failed-task transcripts and a `purgeExpired`
that deliberately returns zero. Being present with a zero is what makes "kept
forever" a visible decision.

**D36 · Everything the agent does reaches Activity.** *Behavioural.* Task
creation, every committed mutation, every refused mutation, and settlement.
Reads and cycles are not — a project feed carrying a line per retrieval would be
unusable. **The overlap with the target's own publication is kept
deliberately**: Document publishes "the document changed", Agents publishes "an
agent was allowed to change it", and a refused mutation exists only in the
second. A future feed UI may collapse the pair for display; that is a
presentation concern to solve when one exists.

**D40 · The strategy is pluggable; the substrate is not.** *Structural.* A
strategy is two pure functions with no ports. It cannot dispatch, exceed policy,
skip approval, reach outside the frozen scope, or write the audit record — it
has no mechanism to.

The seam exists because there are genuinely two implementations we will write:
`simple-loop`, which ships first, and `decompose-verify`, which ships after
watching it run. **If there were only ever one, this would be speculative
generality and the codebase's "no second orchestration framework" non-goal would
apply.** The registry is keyed on `(name, version)`, so shipping a new version
cannot change a task already running the old one.

**D45 · Strategies choose their own model cast per turn.** *Behavioural.* A
cheap classification turn and an expensive planning turn can use different
models within one task, and `strategy.options` can override the casts so an
operator can point a task at a stronger model without editing code.

### E. Numbers and staging

**D25 · Bounds come from named configuration sets, and the defaults are
liberal.** *Behavioural.* `configuration.yaml` holds `quick` / `standard` /
`thorough`; a caller picks one plus optional per-field overrides, resolved and
frozen at creation. Presets exist because these numbers move together.
`standard` is generous — 200 cycles, 200 mutations, 10M tokens. **The bounds
that matter for safety are `maxMutationsPerTask` and the policy**, not the ones
that merely stop the loop being long. Strategy-specific bounds live in
`strategy.options`.

**D28 · The scope manifest is pinned at first-run start, not in the creation
transaction.** *Structural.* `resolveScope` with an absent entry — the default —
lists every source and issues one lookup per source. The serial queue has
exactly one active slot for the entire backend, and nothing else on it does
unbounded work.

**D29 · The origin vocabulary is `user | automation`, matching Activity.**
*Structural.*

**D46 · Agent work gets its own worker pool.** *Structural.* The existing
default of 4 concurrent workers is sized for **synchronous SQLite**, where extra
workers only add contention. Agent cycles are the opposite — almost entirely
blocked on model responses. One pool cannot be right for both shapes, so the
scheduler grows a third array with its own size. A reservation would give
isolation but still force one number to serve both.

**D27 · Build staging puts authored-content mutation late, and `simple-loop`
first.** *Behavioural.* See "Build staging" above.

### Retired

**D24** placed per-capability target adapters in job wiring; the endpoint
gateway (D35) removed the need for adapters entirely. **D26** deferred Activity
publication; D36 replaced it. **D30, D31, D37, D38, D39** described the
decompose/sequence/act/verify unit model and its traversal, bounds, and prompts;
those are no longer substrate decisions and now live in
[strategies.md](strategies.md) as properties of `decompose-verify`. The numbers
are left vacant so references in
[review-2026-08-02.md](review-2026-08-02.md) still resolve to the right history.
