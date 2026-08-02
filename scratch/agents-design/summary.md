# Agents capability — design summary

## Purpose

Agents is a regular project-scoped capability under `3-capabilities/agents/`.
It owns **durable agentic tasks and the management of them**: the objective, the
frozen inputs a task runs against, the runs that carry out the work, the
exchange through which a person and the agent talk to each other, the record of
every tool the agent asked for, and the settled result.

An agent changes nothing directly. It proposes; owning capabilities decide. The
single sentence that constrains this entire design:

> **A model proposal becomes real only by passing through the owning
> capability's public command port, which validates it, revisions it, and
> records it as its own change.**

Agents is deliberately **not** Automation. Automation owns triggers — schedules,
source changes, data conditions, manual events — and it creates or steers tasks
by calling Agents' command port like any other caller. Agents has no timers, no
watches, and no opinion about why a task was created. The seam is one field on a
task (`origin`) and one outbound settlement intent when an automation-origin
task finishes.

```text
Automation  ──trigger──►  Agents.command(create task)
                              │
                              ▼
                          Agent task ──► run ──► tool proposal
                                                     │
                                                     ▼
                                    owning capability public command
                                                     │
                                     its own state, revision, validation
```

## One task machine, many kinds of work

The requirement that shapes the model is that a single task machine has to carry
research, editing, analysis, and everything later — without a `taskKind` enum
that grows a branch per product feature.

Three pinned inputs make one machine general, and nothing else is needed:

| Pinned input | Supplies | Owned by |
| --- | --- | --- |
| **Objective** | what this task is for, in the caller's words | Agents |
| **Persona snapshot** | how to focus, work, present, and verify | Persona |
| **Tool policy** | which capabilities and commands are reachable | Agents |
| **Scope manifest** | which material is visible | Knowledge/Context |

A research task is a task whose policy grants retrieval and no mutation. A
document-editing task is one whose policy grants `document.command` on one
document id. The machine is identical. Adding a new kind of work means granting
a tool, not extending a union.

This is why there is no `mode: "plan" | "action"` field. A plan-only task is a
task with no mutating tools in its policy, which is the same statement expressed
as data instead of as an enum the runner has to interpret.

## Ownership boundaries

Agents owns:

- task identity, objective, origin correlation, and lifecycle state;
- the pinned Persona snapshot, scope manifest, and tool policy;
- runs, their steps, their consumed exchange prefix, and their settlement;
- the durable exchange: progress, questions, answers, steering, results;
- the record of every proposed tool call and a reference to its result;
- approval gating for tool calls whose policy requires it; and
- safe result summaries.

Agents does not own:

- **triggers of any kind** — that is Automation;
- persona definitions or their authoring — that is Persona;
- the canonical effect of any tool call — that is the target capability's
  state, revision, and ChangeSet;
- Context records, composition, or scope resolution;
- model routing or provider selection — Intelligence casts decide that; or
- hidden model reasoning and provider traces, which never leave the
  Intelligence port.

### What is stored, and what is not

Product storage holds the objective, safe progress summaries, explicit
questions, operator messages, tool requests and result references, and safe
settlement summaries.

It does not hold raw provider responses, chain-of-thought, or hidden reasoning
tokens. This follows the existing rule that diagnostics do not echo prompts or
provider bodies, and it is the reason every durable step carries a
`safeSummary` rather than a transcript.

## The aggregate

```text
AgentTask                       durable, revisioned, project-scoped
  ├─ objective                  immutable after creation
  ├─ origin                     { operator } | { automation, automationId }
  ├─ persona                    frozen PersonaSnapshot (prompt + digests)
  ├─ scope                      frozen KnowledgeScopeManifest
  ├─ policy                     frozen AgentToolPolicy
  ├─ state                      queued → running → waiting → settled
  │
  ├─ exchange[]                 append-only, seq-ordered, the shared timeline
  │    ├─ objective / progress / result        (agent-authored)
  │    ├─ question / answer                    (paired, one canonical answer)
  │    ├─ steering                             (operator-authored, mid-flight)
  │    └─ approvalRequest / approval           (paired, gates one tool call)
  │
  └─ run[]                      one attempt at advancing the task
       ├─ consumedThroughSeq    the exchange prefix this run was given
       ├─ step[]                durable, committed before continuation
       └─ toolCall[]            proposed → dispatched → settled
```

Four things about this shape carry most of the design's weight:

1. **The exchange is the interface between person and agent.** Steering is not
   a special control channel; it is a message. A run consumes a *prefix* of the
   exchange, so anything appended while a run is in flight is simply picked up
   by the next run. That single rule is what makes steering, answers, and
   approvals work without a separate interrupt mechanism.

2. **Everything a task runs against is frozen at creation.** Persona snapshot,
   scope manifest, and tool policy are pinned exactly as Derived Outputs
   already freezes its definition revision and context digest. A persona edited
   tomorrow cannot reach a task started today.

3. **Runs are disposable; the task is durable.** A failed run does not fail the
   task. Retry is a new run over the same pinned inputs plus whatever the
   exchange has accumulated.

4. **Every step commits before its continuation is dispatched.** Durable state
   is the authority for what still needs doing; the in-memory queue never is.
   This is the existing internal-jobs rule, stated by `internalRuntime.ts` in
   its own comment, and Agents adopts it unchanged.

## Corrections to the older Notion model

`docs/capabilities-old/agents.md` describes a design that was never built. Where
this directory departs from it, the departure is deliberate:

| Older model | This design | Why |
| --- | --- | --- |
| `POST /agents/tasks/:taskId/answers` and eight more path-param routes | `POST /agents/command` + `POST /agents/query` | The backend has **no path parameters anywhere**; `getEndpointKey` is exact string equality. Command/query with a discriminated body is the newer house shape (Document, Slide, Activity). |
| New `4-job-wiring/internal/InternalJobDispatcher.ts` | Existing `SchedulerInternalJobsRuntime<AgentInternalJobIntent>` | That seam already exists, with the dispatch/registrar face split and a retryable-admission predicate. Building a second one would be a parallel framework. |
| `AgentToolRegistry` mapping model proposals | Existing `ToolSet` from `0-platform/intelligence` | Derived Outputs already builds a `ToolSet` whose handlers close over a frozen manifest. Agents does the same, with handlers that dispatch to command ports. |
| `agent_task_changesets` with `inverse_operations_json` | Append-only control log, no inverses | The inverse of "pause" is not a meaningful operation. Task control is not undoable content. Undo of *effects* belongs to the target capabilities and, later, to Activity. |
| `agent_stage_receipts` table | Idempotency on `(runId, stepSeq)` in the step row | The attempt-row-plus-CAS-settlement pattern is what Derived Outputs uses today. A separate receipts table is a second mechanism for the same guarantee. |
| Persona pinned as `(library\|local, id, version, digest)` | Pinned as the full `PersonaSnapshot` | Persona has no library/local split or version table. Its snapshot carries the rendered prompt, so a task is replayable without Persona in the loop. |
| `mode: "plan" \| "action"` | Absent | Expressed by tool policy instead. See above. |

## Reading order

| File | Covers |
| --- | --- |
| [canonical-model.md](canonical-model.md) | Task, run, exchange, question, tool call; state machines and their invariants |
| [execution.md](execution.md) | The run loop: freeze, stages, model calls, checkpointing, resumption, settlement |
| [tools.md](tools.md) | The tool contract, policy, approval gating, and dual recording |
| [operations.md](operations.md) | Commands, queries, endpoints, jobs, and queue placement |
| [store.md](store.md) | SQLite schema and persistence rules |
| [file-architecture.md](file-architecture.md) | Module layout and dependency direction |

Read [canonical-model](canonical-model.md) then [execution](execution.md) first;
those two carry the design. [tools](tools.md) is where the safety argument
lives.

## Build staging

The design is complete for mutating agents. The **build** is staged so the
machine is proven before it is given hands:

1. **Task and exchange, no runs.** Create, list, get, append steering. Proves
   the aggregate, the endpoints, and the freeze.
2. **Single-step runs, read-only tools.** Retrieval and reads only. A task can
   answer a question about the project. This is roughly Derived Outputs with a
   conversation, and it is the first genuinely useful milestone.
3. **Multi-step runs with checkpointing.** Steps commit, continuations
   dispatch, a restart resumes. Proves durability.
4. **Questions and steering mid-flight.** Proves the consumed-prefix rule.
5. **Mutating tools behind approval.** One target capability first (Document),
   then the rest by adding policy entries rather than code.
6. **Automation origin.** The settlement intent that Automation will consume.

Stages 1–4 need no mutation path at all, which means the risky part of the
capability is the last part built, not the first.

## Open decisions for review

Every item below is a judgment call made while writing this directory, not a
consequence of an existing house rule. Each states what was chosen, what the
alternative was, and what reversing it costs.

Two tags:

- **Structural** — reversing it changes tables, types, or the execution shape.
  Cheap now, expensive after the build starts.
- **Behavioural** — reversing it changes how the capability acts, but the shape
  survives.

**If you only review six, review D1, D2, D4, D7, D8, and D12.** Those six carry
the safety argument (D1, D2, D4), the crash story (D7, D8), and the interaction
model (D12). Almost everything else is downstream of them.

### A. Safety and permission model

**D1 · Mutations are structured-output proposals, not tool calls.** *Structural.*
Read tools run inside `reasonWithToolsStructured` the way Derived Outputs
already uses it. A mutation instead ends the reason step as a *declared
intention* that the runner validates, records, gates, and dispatches as its own
committed step. The alternative — mutating handlers inside the model's tool loop
— is far less code and loses the crash guarantee entirely: an effect lands in
another capability with no committed record in Agents that it was ever asked
for. See [execution.md](execution.md).

**D2 · Approval is granted per tool call, bound to an exact request digest.**
*Structural.* The alternative is per-task approval ("this task may act freely
once approved"), which is dramatically less annoying to operate and a much
weaker guarantee. Digest binding is what stops a later run re-proposing the same
logical call with different arguments and inheriting the grant. If per-task
approval is wanted, it should be expressed as `approval: "never"` in the policy
at creation — visible in the creation record — rather than accumulated by
clicking. See [tools.md](tools.md).

**D3 · Mutating policy entries default to `approval: "always"`.** *Behavioural.*
An author must opt *out* of approval. The reasoning is that the safe
configuration should not be the one you have to remember to write. The cost is
friction on every task that genuinely does not need it.

**D4 · Policy is frozen at creation; there is no grant command.** *Structural.*
A task that needs a capability it was not given must be superseded, not amended.
The benefit is that a task's blast radius is knowable from its creation record
forever. The cost is real: a long task that discovers it needs one more tool
dies and has to be recreated, losing its exchange.

**D5 · A refused or denied proposal is not a run failure.** *Behavioural.* It is
recorded, appended to the exchange, and fed to the next reason step so the agent
chooses differently. The alternative — failing the run — would make refusal
expensive and train callers toward permissive policies.

**D6 · Prompt injection is not structurally defended.** *Behavioural.* Retrieved
project content is untrusted text and can influence what the model proposes. The
mitigation is that a proposal still has to pass policy and approval, so injection
can at worst cause a *permitted* action. This is stated plainly in
[tools.md](tools.md) rather than papered over, and it is the strongest argument
for keeping default policies narrow. Worth confirming you accept that framing.

### B. Durability and recovery

**D7 · Every mutating target must implement `lookup(requestDigest)`.**
*Structural.* This is a requirement Agents places on other capabilities, so it
is the item most likely to be contentious. Without it, a tool call committed as
`dispatched` whose result was never written is unresolvable. Document already
stores `request_digest` for exactly this; other capabilities would need to add
it before they can be write targets.

**D8 · An unknown-outcome tool call surfaces to a person.** *Structural.* When
recovery cannot determine whether a dispatched call took effect, the task goes
`waiting` with `attention: "approval"` and a human decides. The alternative is
automatic retry, which is how duplicate work happens, or silent failure, which
loses the information. This is the branch that makes D7 necessary.

**D9 · One mutating call per committed step.** *Behavioural.* Batching two
mutations into one step creates a crash window where one landed and the other
did not, with no committed record distinguishing them. Costs a round trip per
mutation.

**D10 · A run transcript is stored separately from the exchange.**
*Structural.* Rebuilding a model conversation across several jobs needs the
assistant and tool turns; that is a different artefact from the person-facing
timeline. It holds no hidden reasoning — that never leaves the Intelligence
port — and it has no read path. The alternative is running an entire multi-step
run inside one job, which trades durability for simplicity.

**D11 · Transcripts are pruned when a task settles, except for failed tasks.**
*Behavioural.* Failed tasks keep theirs so the failure can be diagnosed. A
different retention window is easy; the question is whether keeping them for
successful tasks has diagnostic value worth the storage.

### C. Task and exchange semantics

**D12 · The consumed-prefix rule: a run sees an immutable prefix of the
exchange.** *Structural.* This is the mechanism that makes steering, answers,
and approvals work without an interrupt path — anything appended mid-run is
picked up by the *next* run. The cost is latency: steering appended one
millisecond after a run starts waits for that run to finish. The alternative,
interrupting a run mid-model-call, makes "what did this run see?" unanswerable,
and that question has to stay answerable. See [canonical-model.md](canonical-model.md).

**D13 · Steering cannot widen scope.** *Behavioural.* Follows from D4 and the
four frozen inputs. Steering directs attention within the material a task was
given; it cannot grant new material. Worth confirming this matches how you
expect people to actually use it.

**D14 · Terminal states are absorbing; there is no reopen.** *Structural.* A
follow-up is a new task, and the old exchange stays readable. The alternative —
reopening a completed task — makes "what were this task's inputs" a question
with more than one answer over time.

**D15 · The result is both a message in the exchange and a field on the task.**
*Behavioural.* Deliberate duplication: the exchange is the narrative, the field
is the queryable outcome. Worth confirming rather than assuming.

**D16 · `waiting` is a task state; runs have no `waiting` status.**
*Structural.* Blocking is a property of the task, not of an attempt, and keeping
it off the run avoids a second place where "who are we waiting on" can disagree.
A run that discovers it needs a person settles as `succeeded` having opened the
question.

**D17 · When both a required question and an approval are pending, `attention`
reports `"question"`.** *Behavioural.* Questions are usually cheaper to answer
and often make the approval decision obvious. Arbitrary but has to be decided.

**D18 · Cancel lets an already-dispatched tool call finish and be recorded.**
*Behavioural.* The target has accepted the change by then; a record saying it
was cancelled would be a lie. Cancel means "stop starting new work", not "undo".
Undo of effects belongs to target capabilities and, later, Activity.

**D19 · Required and optional questions are distinguished.** *Behavioural.*
Only required ones block. Optional ones are the agent saying "this would help",
and the next run proceeds without them. Simpler alternative: all questions
block.

### D. Shape and surface

**D20 · No `mode: "plan" | "action"`.** *Structural.* A plan-only task is one
with no mutating tools in its policy — the same statement as data instead of an
enum the runner interprets. This is what lets one task machine cover research,
editing, and analysis without a `taskKind` union that grows per feature.

**D21 · No `task.pause` and no `task.resume`.** *Behavioural.* Answering,
approving, or steering a blocked task enqueues the next run in the same
transaction, so resume is implied. Pause was in the older model; the states that
exist already cover the real cases. Reintroducing pause means a new durable
state, not just a command.

**D22 · `(runId, stepSeq)` uniqueness is the only idempotency mechanism.**
*Structural.* The step row is its own receipt, replacing the older model's
separate `agent_stage_receipts` table. One mechanism instead of two for the same
guarantee.

**D23 · There is no task-delete command; tasks are kept indefinitely.**
*Behavioural.* A task is the only Agents-side evidence of calls that were
proposed, refused, or denied. If tasks must be deletable for other reasons, that
needs designing rather than adding.

**D24 · Target adapters live in job wiring, not in either capability.**
*Structural.* Document does not know it is an agent target; Agents does not know
Document exists. The adapter is the only file that knows both. This is what
keeps the dependency arrow one-directional and is worth an architectural
regression test.

### E. Numbers and staging

**D25 · Bounds defaults are guesses.** *Behavioural.* `maxStepsPerRun: 24`,
`maxToolCallsPerRun: 12`, `maxRunsPerTask: 50`,
`maxTokensPerTask: 2_000_000`. Run-level bounds fail the run and keep the task
alive; task-level bounds settle the task `partial`. The split matters more than
the numbers, but the numbers should be sanity-checked against what a real task
costs.

**D26 · Activity publication is deferred.** *Behavioural.* Matches Persona,
because it needs an outbox row in the same transaction. But agent activity is
arguably the most valuable thing a project feed could show, and the settlement
outbox for Automation already exists in this schema — so the machinery is mostly
there and this may deserve to move earlier.

**D27 · Build staging puts mutation last.** *Behavioural.* Stages 1–4 need no
mutation path at all, so the risky part is built last rather than first. The
tradeoff is that the first genuinely useful milestone (stage 2, read-only
answering) is close to what Derived Outputs already does, so it may feel like
duplicated effort before the payoff arrives.
