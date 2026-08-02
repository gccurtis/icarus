# Agents capability — design summary

## Purpose

Agents is a regular project-scoped capability under `3-capabilities/agents/`.
It owns **durable agentic tasks and the management of them**: the objective, the
frozen inputs a task runs against, the decomposition of that objective into
goals, the work units that carry it out, the exchange through which a person and
the agent talk to each other, the record of every mutation the agent asked for,
and the settled result.

An agent changes nothing directly. It proposes; owning capabilities decide. The
single sentence that constrains this entire design:

> **A model call becomes real only by passing through the owning capability's
> public endpoint, which validates it, revisions it, and records it as its own
> change.**

Agents is deliberately **not** Automation. Automation owns triggers — schedules,
source changes, data conditions, manual events — and it creates or steers tasks
by calling Agents' command port like any other caller. Agents has no timers, no
watches, and no opinion about why a task was created. The seam is one field on a
task (`origin`) and one outbound notification when an automation-origin task
settles.

```text
Automation  ──trigger──►  Agents.command(create task)
                              │
                              ▼
                          Agent task ──► goals ──► work units
                                                       │
                                                       ▼
                                        owning capability's own endpoint
                                                       │
                                        its own state, revision, validation
```

## One task machine, many kinds of work

The requirement that shapes the model is that a single task machine has to carry
research, editing, analysis, and everything later — without a `taskKind` enum
that grows a branch per product feature.

Four pinned inputs make one machine general, and nothing else is needed:

| Pinned input | Supplies | Owned by | Pinned when |
| --- | --- | --- | --- |
| **Objective** | what this task is for, in the caller's words | Agents | creation |
| **Persona snapshot** | how to focus, work, present, and verify | Persona | creation |
| **Tool policy** | which endpoints and resources are reachable | Agents | creation |
| **Scope manifest** | which material is visible | Knowledge/Context | first run start |

All four are frozen **before the first model call** and immutable afterwards.
Scope is pinned by the first run rather than the creation transaction because
resolving a whole-project scope is unbounded work and creation runs on the
backend's single serial slot — see [execution.md](execution.md).

A research task is a task whose policy grants read endpoints and no mutating
ones. A document-editing task is one whose policy grants
`POST /documents/command` on one document id. The machine is identical. Adding a
new kind of work means granting an endpoint, not extending a union.

This is why there is no `mode: "plan" | "action"` field. A plan-only task is a
task with no mutating endpoints in its policy, which is the same statement
expressed as data instead of as an enum the runner has to interpret.

## The four-level hierarchy

```text
Task        durable, revisioned. The whole engagement. Never deleted.
 ├─ objective          immutable after creation
 ├─ origin             { user } | { automation, automationId }
 ├─ persona            frozen PersonaSnapshot, pinned by (personaId, revision)
 ├─ policy             frozen AgentToolPolicy, over endpoint keys
 ├─ limits             frozen AgentLimits (config defaults + overrides)
 ├─ contextEntry       at most one; absent means the whole project
 ├─ scope              frozen KnowledgeScopeManifest, pinned by run 1
 │
 ├─ Goal[]             the decomposition. Durable, with written expectations.
 │
 ├─ exchange[]         append-only, seq-ordered — the shared timeline
 │    ├─ objective / plan / progress / result   (agent-authored)
 │    ├─ question / answer                      (paired, one canonical answer)
 │    ├─ steering                               (person-authored, mid-flight)
 │    ├─ approvalRequest / approval             (paired, gates one mutation)
 │    └─ system                                 (runtime notices)
 │
 └─ Run[]              one continuous attempt. Survives steering.
      └─ WorkUnit[]    decompose | sequence | act | verify | settle
```

Five things about this shape carry most of the design's weight.

**1 · The work unit is the atomic unit of everything.** It is what commits, what
steering is checked between, what recovery resolves, and what the audit trail is
made of. The platform's word *job* is reserved for the scheduling primitive that
executes one; the two nouns are never conflated.

**Reads are not work units.** A `decompose`, `sequence`, or `verify` unit is one
model call with read tools bound, and the model reads as much as it needs inside
that call. Only mutations are planned, sequenced, and committed one per unit,
because only mutations change the world.

**2 · The tree is walked build-down, resolve-up.** The active goal is *derived*
— the deepest, leftmost unfinished node — and one further question decides
everything: a goal with children gets a **verify**; a goal without gets a
**decompose**, or a **sequence → act × n → verify**. "Resolve up" is not a
separate mechanism; it falls out of re-deriving the cursor. **Verification
happens at every level**, so a parent whose children all succeeded can still
fail its own expectation.

**3 · Decompose and sequence answer different questions.** Decompose asks *what
has to be true?* and produces child goals. Sequence asks *what do I do to make
it true?* and produces ordered mutations. Conflating them is what makes agent
loops mushy. A sequence also records `observedState` — what it found when it
looked — so the pair (observed → expectation) is the transition a verify unit
re-reads against.

**3b · The plan is written down, not remembered.** Goals are rows with required
`expectation` fields; queued mutations are `act` rows. A restart does not
re-derive them, a person can see what the agent intends *before* it acts, and
"did it work" has a referent.

**4 · Everything a task runs against is frozen before its first model call.**
Persona snapshot, tool policy, and scope manifest are pinned exactly as Derived
Outputs freezes its definition revision and context digest. A persona edited
tomorrow cannot reach a task started today. Note the scope pins *membership*,
not *content* — a connector re-sync mid-task changes what retrieval returns, and
that is accepted and expected.

**5 · Every work unit commits before its continuation is dispatched.** Durable
state is the authority for what still needs doing; the in-memory queue never is.
This is the existing internal-jobs rule, adopted unchanged.

## How Agents reaches other capabilities

**Through one gateway over the existing job registry — not through injected
runtimes, and not through per-capability adapters.**

```text
work unit ──► AgentEndpointGateway.call("POST /documents/command", body, requestId, actor)
                 └─► registry.createJob(envelope) ──► scheduler.admit(job)
                        └─► the capability's own endpoint, wire decoder,
                            queue placement, error ladder, and receipt
```

Every safety property comes from the path already being correct. The target runs
its own validation, chooses its own queue, maps its own errors, and applies its
own idempotency. There is no translation layer that can drift from what the
capability accepts, and **a new capability becomes reachable by adding one
descriptor** rather than an adapter, a port, and a composition-root entry.

The catalogue of agent-reachable endpoints is **declared in one file**, not
derived from the registry. Deriving it would make every route agent-reachable
the moment it registers, including purges. Declaring it keeps "adding agent
access to a capability" an explicit, reviewable decision — the same gate a
per-target design provides, at a fraction of the code.

One runtime rule makes this safe: **a concurrent job may enqueue a serial job; a
serial job must never await one.** Every gateway-calling work unit is
concurrent. See [tools.md](tools.md).

## Ownership boundaries

Agents owns:

- task identity, objective, origin correlation, and lifecycle state;
- the pinned Persona snapshot, scope manifest, tool policy, and limits;
- the goal decomposition and each goal's written expectation;
- runs, their work units, and their settlement;
- the durable exchange: plans, progress, questions, answers, steering, results;
- the record of every mutation asked for, refused, or landed;
- approval gating for mutations whose policy requires it; and
- safe result summaries.

Agents does not own:

- **triggers of any kind** — that is Automation;
- persona definitions or their authoring — that is Persona;
- Context records, composition, or set algebra — a caller composes what it
  wants and hands over one reference;
- the canonical effect of any mutation — that is the target capability's state,
  revision, and history;
- model routing or provider selection — Intelligence casts decide that; or
- hidden model reasoning and provider traces, which never leave the
  Intelligence port.

### What is stored, and what is not

Product storage holds the objective, the goal tree, safe progress and plan
summaries, explicit questions, operator messages, mutation requests and result
references, and safe settlement summaries.

It does not hold raw provider responses, chain-of-thought, or hidden reasoning
tokens. This follows the existing rule that diagnostics do not echo prompts or
provider bodies, and it is the reason every durable unit carries a `safeSummary`
and a `rationale` rather than a transcript.

## Corrections to the older Notion model

`docs/capabilities-old/agents.md` describes a design that was never built. Where
this directory departs from it, the departure is deliberate.

| Older model | This design | Why |
| --- | --- | --- |
| `POST /agents/tasks/:taskId/answers` and eight more path-param routes | `POST /agents/command` + `POST /agents/query` | The backend has **no path parameters anywhere**; `getEndpointKey` is exact string equality. Command/query with a discriminated body is the preferred house shape (Document, Activity, Comments, Templates, Persona). |
| New `4-job-wiring/internal/InternalJobDispatcher.ts` | Existing `SchedulerInternalJobsRuntime<AgentInternalJobIntent>` | That seam already exists, with the dispatch/registrar face split and a retryable-admission predicate. Building a second one would be a parallel framework. |
| `AgentToolRegistry` mapping model proposals | The endpoint gateway plus a declared catalogue | Reaching a capability through its own registered endpoint reuses its validation, queue, errors, and receipts. A bespoke mapping layer would duplicate all four and drift from them. |
| `agent_task_changesets` with `inverse_operations_json` | Append-only work-unit log, no inverses | The inverse of "plan" is not a meaningful operation. Task control is not undoable content. Undo of *effects* belongs to the target capabilities and, later, to Activity. |
| `agent_stage_receipts` table | Idempotency on `(runId, unitSeq)` in the unit row | The unit row is its own receipt. A separate receipts table is a second mechanism for the same guarantee. |
| Persona pinned as `(library\|local, id, version, digest)` | Pinned as `(personaId, revision)` plus the full snapshot | Persona has no library/local split. Its snapshot carries the rendered prompt, so a task is replayable without Persona in the loop, and its `revision` already identifies the version. |
| `mode: "plan" \| "action"` | Absent | Expressed by tool policy instead. |

## Reading order

| File | Covers |
| --- | --- |
| [canonical-model.md](canonical-model.md) | Task, goal, run, work unit, exchange, question, approval, tool call; state machines and invariants |
| [execution.md](execution.md) | The loop: freeze, decomposition, work units, steering, settlement, recovery |
| [tools.md](tools.md) | The endpoint gateway, policy, approval gating, attribution, and the threat model |
| [operations.md](operations.md) | Commands, queries, endpoints, jobs, queue placement, errors, logging |
| [store.md](store.md) | SQLite schema, transaction boundaries, and retention |
| [file-architecture.md](file-architecture.md) | Module layout, barrel, composition, and tests |
| [supplementary-changes.md](supplementary-changes.md) | Changes **outside** Agents that this design depends on |
| [architecture.md](architecture.md) | A single end-to-end walkthrough of the whole capability |
| [review-2026-08-02.md](review-2026-08-02.md) | The review the first revision came out of |

Read [architecture.md](architecture.md) if you want the whole picture in one
pass. Read [canonical-model](canonical-model.md) then [execution](execution.md)
if you want the detail; those two carry the design. [tools](tools.md) is where
the safety argument lives. [review-2026-08-02.md](review-2026-08-02.md) is
history rather than specification — read it when you want to know *why*
something is the way it is, not what it is.

## Build staging

The design is complete for mutating agents. The **build** is staged so the
machine is proven before it is given hands:

1. **Task, goals, and exchange — no runs.** Create, list, get, append steering.
   Proves the aggregate, the endpoints, the receipt, and the persona freeze.
2. **Read-only work against Derived Outputs as the first gateway target.** Scope
   pinning, the decompose and sequence units, the goal tree, the gateway, the policy check. A task can
   declare and refresh a Derived Output and discuss the answer — the answer is an
   ordinary Derived Output with its own evidence and revision chain.
3. **Multi-unit runs with the boundary check.** Units commit, continuations
   dispatch, a restart resumes from durable goals. Proves durability.
4. **Steering, questions, and approvals mid-flight.** Proves the boundary check
   is the only control path needed.
5. **Document as a mutating target.** The first target that changes something a
   person authored. After this, adding a target is a catalogue descriptor.
6. **Automation origin.** The settlement outbox row Automation consumes.

### Why stage 2 goes through Derived Outputs

An earlier version of this staging had stage 2 reimplement retrieval and
synthesis inside the runner. Read-only answering over a frozen scope, with
`knowledge.retrieve` bound as a tool and evidence validated against what was
actually retrieved, **is** `DerivedOutputService.refresh()` — minus the immutable
revision chain, plus a conversation.

Routing stage 2 through Derived Outputs inverts the risk profile in the right
direction. The genuinely dangerous machinery is the gateway, the policy
evaluation, commit-before-dispatch, and replay-based recovery — and this
exercises all four against a capability that is already idempotent by
caller-supplied key and already owns evidence provenance. What it does *not*
exercise is changing anything a person wrote, which is what stage 5 is for.

Stages 1–4 change nothing a person authored, so the risky part is built last.

## Decision register

Every item below is a judgment call, not a consequence of an existing house
rule. Each states what was chosen, what the alternative was, and what reversing
it costs.

Two tags:

- **Structural** — reversing it changes tables, types, or the execution shape.
- **Behavioural** — reversing it changes how the capability acts, but the shape
  survives.

**If you read six, read D1, D3, D7, D12, D28, and D35.** Those carry the safety
argument (D1, D3), the crash story (D7), the interaction model (D12), the
runtime constraint that shaped the freeze (D28), and how Agents reaches
everything else (D35).

**D24 and D26 are retired, not missing.** D24 placed per-capability target
adapters in job wiring; the endpoint gateway (D35) removed the need for adapters
entirely. D26 deferred Activity publication; D36 replaced it. The numbers are
left vacant so references in
[review-2026-08-02.md](review-2026-08-02.md) still resolve to the right history.

### A. Safety and permission model

**D1 · Mutations go through the target's own public endpoint, never a bespoke
adapter.** *Structural.* The gateway builds a `RequestEnvelope` and dispatches
through the existing `JobRegistry`, so validation, queue placement, error
mapping, and receipt-based idempotency are all the target's own. The
alternatives — injecting capability runtimes, or hand-writing an adapter per
target — either fan Agents' dependencies out across the whole tree or duplicate
each capability's wire decoding in a second place that can drift.

**D2 · Approval is granted per mutation, bound to an exact request digest.**
*Structural.* The alternative is per-task approval ("this task may act freely
once approved"), which is dramatically less annoying and a much weaker
guarantee. Digest binding stops a later unit re-proposing the same logical call
with different arguments and inheriting the grant.

Note how this composes with D3: **freedom to act is declared at creation, not
accumulated by clicking.** `approval: "never"` — the default — is where "this
task may act freely on these resources" lives, stated once in the creation
record. `approval: "always"` is the deliberate opt-in to supervision, and when
it is on it authorises one call with those exact arguments.

**D3 · Mutating policy entries default to `approval: "never"`.** *Behavioural.*
An author opts *in* to the gate. The policy is already the blast radius, and it
is mandatory, reviewed at creation, and immutable afterwards. Requiring a click
per edit on top of an enumerated resource id list makes the common case tiresome
enough that authors route around it, and a gate people route around is worse
than one they choose. The cost is named: the safe configuration is now the one
you have to remember to write, which makes **"enumerate the resource ids"** the
habit worth building.

**D4 · Policy is frozen at creation; there is no grant command.** *Structural.*
A task that needs a capability it was not given must be superseded, not amended.
The benefit is that a task's blast radius is knowable from its creation record
forever. The cost is real: a long task that discovers it needs one more endpoint
has to be recreated.

**D5 · A refused mutation is not a run failure.** *Behavioural.* It is recorded,
appended to the exchange, published to Activity as `agent.mutation.refused`, and
fed to the next sequence unit so the agent chooses differently. Failing the run
would make refusal expensive and train callers toward permissive policies.

**D6 · Prompt injection is not structurally defended.** *Behavioural.* Retrieved
content is untrusted text and can influence what the model invokes. The
mitigation is structural: the call still has to be a bound tool and pass policy,
so injection can at worst cause a *permitted* action. Retrieved material is
delimited and labelled untrusted in the transcript — a speed bump, described as
one. With D3 flipped, the policy is doing nearly all of this work, which makes
narrow policies the strongest available mitigation rather than a good habit.

**D35 · The agent-reachable endpoint catalogue is declared, not derived.**
*Structural.* Deriving it from `registry.listEndpoints()` would make every route
agent-reachable the moment it registers, including purges. One declared file
keeps the opt-in gate at a fraction of the cost of per-target adapters, and a
descriptor naming an unregistered key is a fatal startup error.

### B. Durability and recovery

**D7 · A mutating target must be idempotent by caller-supplied `requestId`;
there is no `lookup(requestDigest)`.** *Structural.* An earlier draft required
the latter, on the belief that Document already stored a digest index. It does
not — the digest is only compared against a receipt found by request id, and no
digest lookup exists anywhere in the tree. Since Agents mints the request id
(`agent:<toolCallId>`, committed before dispatch), recovery re-dispatches the
identical command and the target's existing receipt replays. Document, Comments,
and Templates already qualify unchanged.

**D8 · An unknown-outcome mutation is re-dispatched, not escalated.**
*Structural.* Recovery re-sends the identical command: the target either replays
its receipt (it landed) or executes (it had not). Either way the outcome becomes
known and nothing is applied twice. The trade: re-dispatch *acts* if the call had
not landed. For every command in the tree that is the desired outcome — the agent
asked, policy allowed, a person approved where required.

**D9 · One mutation per work unit, and at most one `dispatched` per run.**
*Behavioural.* Batching two mutations creates a crash window where one landed and
the other did not, with no committed record distinguishing them. Costs a round
trip per mutation.

**D10 · A run transcript is stored separately from the exchange.**
*Structural.* Rebuilding a model conversation across several jobs needs the
assistant and tool turns; that is a different artefact from the person-facing
timeline. It holds no hidden reasoning and has no read path.

**D11 · Transcripts are pruned when a task settles; failed tasks keep theirs
until the shared retention sweep takes them.** *Behavioural.* Failed-task
transcripts hold provider-facing message arrays; under a pure keep-everything
policy nothing would prune them. Agents therefore implements `pruneHistory` and
is bound into `ResourceRetentionScheduler` like every other persisted
capability.

### C. Task, goal, and exchange semantics

**D12 · Steering adjusts the decomposition; it does not interrupt an attempt.**
*Structural.* The in-flight unit finishes its atomic work and commits; the
boundary check marks the queued mutations `superseded` — **keeping their
rationales** — and dispatches a `sequence` unit that receives the goal, what has
already been done, the superseded plan with its reasoning, and the steering
message. It returns an *amended* plan. The run continues.

That last part is the point. The agent had a reason for each pending mutation
and an expectation it was working toward; a person redirecting usually means
"also do this" or "do that part differently", not "forget everything". Handing
it the old plan is what lets it amend rather than restart. A redirect can also
`escalate` — the runner moves the cursor to the parent and decomposes there,
injecting a goal — which is how steering changes structure rather than only
order.

The earlier design made a run consume an immutable prefix of the exchange and
deferred all steering to the next run, so redirect latency was a whole attempt.
That protected the question *"what did this run see?"* — better answered at the
unit level, where it is both cheaper and more useful. Every work unit records
its own `consumedThroughSeq`.

**D37 · The steer check runs on a configurable interval.** *Behavioural.*
`steerCheckInterval` (default 1) governs how many consecutive `act` units may
run before the boundary check consults the exchange. The check itself is free —
an integer comparison on rows already in hand — so the knob exists to let a
**coherent run of mutations finish before being re-planned**, not to save work.
Three rules stop it swallowing a redirect: the check always runs before a
planning unit; always runs before an act unit needing approval; and the counter
resets at the end of every sequence.

**D38 · Verify has a `pending` outcome, because some target commands are
asynchronous.** *Structural.* Document's `prompt.create.request` returns 202
with an `attemptId` — the block does not exist until Document's own
freeze/compute/settle pipeline runs. A verify that treated 202 as *not-met*
would re-sequence and **re-issue the command**, creating a duplicate attempt. So
verify distinguishes "it did not work" from "it has not finished yet", and the
runner re-dispatches the same verify on a backoff. Exhausting the backoff
settles the goal `blocked` with a question rather than assuming failure.

**D29 · The agent narrates as it works.** *Behavioural.* Plan and progress
messages are not decoration — a person steers what they can see, and steering is
useless if the first visible output is the finished result. The rule that keeps
it from becoming noise: write when the agent's intent or the world changed, not
per model round trip.

**D30 · A superseded unit keeps its rationale, and that rationale is fed to the
unit that replaces it; there is no partial work to clean up.** *Structural.*
When steering lands, the queued `act` units are marked `superseded` and their
rationales go into the model input of the replacement `sequence` unit, as well
as into the exchange as a `system` message — the antecedent the steering
message refers to. Superseded rather than abandoned is the point: the agent had
a reason for each pending mutation, and handing those back is what lets it
amend rather than restart. There is no
partial work product because a mutating command at every target is atomic and
revisioned: either it dispatched (recorded, real) or it did not (nothing
happened). This is what makes copy-on-write shadowing unnecessary rather than
merely expensive; shadowing would require every target to implement
duplicate-and-merge to protect against a state the model cannot enter.
Retraction of a landed change is undo, which belongs to the target
(`document.compensate`) and is deliberately not wired into steering.

**D31 · The goal decomposition is a durable tree, walked build-down and
resolve-up.** *Structural.* A restart does not re-derive it, a person can see
intent before action, and the written `expectation` gives a verify unit
something to compare against. The cursor is **derived, never stored** — the
deepest, leftmost unfinished node — so there is nothing to reconcile at
recovery.

Decomposition stops when a bounded sequence of the granted endpoints can reach
the goal, declared by the model. **Five independent bounds stop it spiralling**:
at `maxGoalDepth` the decompose option is not offered by the output schema at
all; `maxConsecutivePlanningUnits` (default 2) forces the next unit to produce
an action or block the goal; plus `maxDecomposeAttemptsPerGoal`,
`maxGoalsPerTask`, and a prompt that lists the exact tools the task holds so the
"can I sequence this?" judgement is grounded rather than abstract. The first and
second are the load-bearing ones: one makes runaway depth unrepresentable, the
other makes runaway breadth expensive inside one unit rather than invisible
across many.

**D39 · Prompts are versioned in code, one per unit kind.** *Behavioural.*
`DECOMPOSE_V1`, `SEQUENCE_V1`, `VERIFY_V1`, `SETTLE_V1` live in
`domain/prompts.ts`, matching Derived Outputs' inline versioned prompts. Every
unit records the `promptVersion` it ran under, so a behavioural change after a
prompt edit is attributable rather than mysterious. The persona fragment is
appended *after* the unit prompt — Persona's third consumer law.

**D13 · Steering cannot widen scope.** *Behavioural.* Follows from D4 and the
four frozen inputs.

**D14 · Terminal states are absorbing; there is no reopen.** *Structural.* A
follow-up is a new task, and the old exchange stays readable.

**D15 · The result is both a message in the exchange and a field on the task.**
*Behavioural.* The exchange is the narrative, the field is the queryable
outcome.

**D16 · `waiting` is a task state; runs have no `waiting` status.**
*Structural.* Blocking is a property of the task. A blocked task keeps its run
`running` with nothing dispatched, and answering resumes that same run.

**D17 · When both a required question and an approval are pending, `attention`
reports `"question"`.** *Behavioural.* Questions are usually cheaper to answer
and often make the approval decision obvious.

**D18 · Cancel lets an already-dispatched mutation finish and be recorded.**
*Behavioural.* The target has accepted the change; a record saying it was
cancelled would be a lie. Cancel means "stop starting new work", not "undo".

**D19 · Required and optional questions are distinguished.** *Behavioural.* Only
required ones block.

**D32 · A task carries at most one Context entry.** *Structural.* A list of
entries can only ever union — *"the whole project except X"* is not expressible
by enumeration. Exclusion lives inside a Context, via
`POST /contexts/difference`. So the caller composes what it wants and hands over
one reference; Agents never performs set algebra and never has to decide what a
list of five entries meant. Absent means the whole project.

**D33 · Persona is pinned by `(personaId, revision)`, not by digest.**
*Structural.* Revision already exists, increments by exactly one per update, and
is the granularity that answers "which version ran". `definitionDigest` excludes
`displayName`/`description` and `promptDigest` varies with section selection —
finer questions than a task needs, and the stored `sections` list already covers
the second. Both digests remain inside the snapshot; nothing indexes them.

**D34 · Corpus drift mid-task is accepted, not fenced or recorded.**
*Behavioural.* The scope manifest pins membership, not content. A connector
re-sync changes what retrieval returns, and an agent working on live project
material should see live project material. Derived Outputs fences on a
generation change because it publishes an immutable answer; a task that fails
because someone re-synced a connector is a failure the user cannot act on.

### D. Shape and surface

**D20 · No `mode: "plan" | "action"`.** *Structural.* A plan-only task is one
with no mutating endpoints in its policy.

**D21 · No `task.pause` and no `task.resume`.** *Behavioural.* Answering,
approving, or steering a blocked task resumes it in the same transaction.

**D22 · `(runId, unitSeq)` uniqueness is the only idempotency mechanism for the
execution path.** *Structural.* The unit row is its own receipt, replacing the
older model's separate `agent_stage_receipts` table.

**D23 · There is no task-delete command; tasks are kept indefinitely.**
*Behavioural.* A task is the only Agents-side evidence of calls that were
proposed, refused, or denied. The precedent is Activity — append-only and
explicitly excluded from revision-history retention. Agents is still bound into
the retention scheduler, with a `pruneHistory` that sweeps failed-task
transcripts and a `purgeExpired` that deliberately returns a constant zero.
Being present with a zero is what makes "kept forever" a visible decision rather
than an absence someone later reads as an oversight.

**D36 · Everything the agent does reaches Activity.** *Behavioural.* Task
creation, every committed mutation, every refused mutation, and settlement are
published through a local outbox in the same transaction that committed them.
Reads, decompose, sequence, and verify units are not — they are in the exchange,
and a project feed carrying a line per retrieval would be unusable.

**The overlap with the target's own publication is kept deliberately.** When an
agent edits a document, Document publishes its own transaction with
`origin: "agent"` *and* Agents publishes
`agent.mutation.committed`. Those are different facts — "the document changed"
and "an agent was allowed to change it" — and a refused mutation exists only in
the second. A future Activity read or list may want to collapse the pair for
display; that is a presentation concern to solve when a feed UI exists, and it
will be obvious then. It is not a reason to drop a record now.

### E. Numbers and staging

**D25 · Bounds come from named configuration sets, and the defaults are
liberal.** *Behavioural.* `configuration.yaml` holds named presets — `quick`,
`standard`, `thorough` — and a caller picks one by name plus optional per-field
overrides. Resolution happens at creation and the resolved set is frozen onto
the task.

Presets exist because these numbers move together: "be thorough" is not one knob
but a deeper tree, more units, more mutations, and more read rounds at once, and
asking a caller to keep seventeen numbers mutually consistent is asking for
incoherent configurations.

`standard` is deliberately generous — `maxGoalDepth: 6`, `maxUnitsPerRun: 500`,
`maxMutationsPerTask: 200`, `maxRunsPerTask: 20`,
`maxTokensPerTask: 10_000_000`. An earlier draft set these low out of caution,
which mostly produces tasks that settle `partial` for reasons the user cannot
act on. **The bounds that matter for safety are `maxMutationsPerTask` and the
policy** — not the ones that merely stop the loop being long.

Run-level bounds fail the run and keep the task alive; task-level bounds settle
the task `partial` with the bound named in `unmet`. The split matters more than
the numbers.

**D28 · The scope manifest is pinned at first-run start, not in the creation
transaction.** *Structural.* `resolveScope` with an absent entry — the default,
meaning the whole project — lists every source and issues one `describeSource`
per source. The serial queue has exactly one active slot for the entire backend,
and nothing else on it does unbounded work. The guarantee that matters is
unchanged — frozen before the first model call — but the wording is no longer
"frozen at creation".

**D27 · Build staging puts authored-content mutation last, and stage 2 goes
through Derived Outputs.** *Behavioural.* See "Why stage 2 goes through Derived
Outputs" above.
