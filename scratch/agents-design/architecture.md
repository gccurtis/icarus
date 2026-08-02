# Agents — architecture walkthrough

A single end-to-end read of the whole capability: the object model, the data
behind it, what it depends on, the endpoints, the procedures underneath them,
a fully worked example, the guarantees, and what you can expect to do with it.

**Nothing of Agents exists in code yet.** Everything here is design. The other
files in this directory are the detail; this one is the shape.

---

## 1 · What Agents is

One sentence constrains the whole design:

> **A model call becomes real only by passing through the owning capability's
> public endpoint, which validates it, revisions it, and records it as its own
> change.**

Agents owns durable agentic *tasks*: the objective, the frozen inputs a task
runs against, the decomposition of that objective into goals, the work units
that carry it out, the conversation between a person and the agent, the record
of every mutation the agent asked for, and the settled result.

It changes nothing directly. It proposes; owning capabilities decide.

It is also deliberately **not Automation**. Automation owns triggers. It creates
tasks by calling Agents' command port like any other caller. Agents has no
timers and no opinion about why a task was created.

---

## 2 · The runtime object model

Four levels, one aggregate root.

```text
Task        durable, revisioned. The whole engagement. Never deleted.
 ├─ objective          immutable after creation
 ├─ origin             { user } | { automation, automationId }
 ├─ persona            frozen PersonaSnapshot, pinned by (personaId, revision)
 ├─ policy             frozen AgentToolPolicy, over endpoint keys
 ├─ limits             frozen AgentLimits, resolved from a named preset
 ├─ contextEntry       at most one; absent means the whole project
 ├─ scope              frozen KnowledgeScopeManifest, pinned by run 1
 │
 ├─ Goal[]             the decomposition TREE. Objectives at the top,
 │                     actionable goals at the leaves. Each carries a written
 │                     expectation.
 │
 ├─ exchange[]         append-only, seq-ordered — the only channel to a person
 │
 └─ Run[]              one continuous attempt. Survives steering.
      └─ WorkUnit[]    decompose | sequence | act | verify | settle
           └─ ToolCall  many reads per planning unit; exactly one mutation per act
```

### The five ideas that carry the weight

**1 · The work unit is the atomic unit of everything.**

```ts
type AgentWorkUnitKind =
  | "decompose"  // one model call: break a goal into child goals
  | "sequence"   // one model call: observe, then order the mutations for a goal
  | "act"        // one mutating command against one capability
  | "verify"     // one model call: re-observe, compare against the expectation
  | "settle";    // the run's own settlement
```

**Reads are not work units.** A decompose, sequence, or verify unit is one model
call with read tools bound, and the model reads as much as it needs inside that
call's tool loop — bounded by configuration, otherwise its own judgement. Only
mutations are planned, sequenced, and committed one per unit, because only
mutations change the world.

The platform's word *job* is reserved for the scheduling primitive that executes
one work unit. A work unit is a durable domain record; a job is a mechanism.

**2 · The goal tree is walked build-down, resolve-up.**

Everything the runner does follows from two derived facts:

```text
activeGoal = the first goal in depth-first pre-order that is `pending` or
             `active` and has no `pending` or `active` children

does the active goal have children?
  ├─ YES → every child is settled. VERIFY the parent.
  └─ NO  → it is a leaf. DECOMPOSE it, or SEQUENCE → ACT × n → VERIFY it.
```

The cursor is **derived, never stored** — no column to drift, nothing to
reconcile at recovery, no way for the traversal to disagree with goal states.
"Resolve up" is not a separate mechanism: when a leaf becomes `achieved`,
re-deriving finds the next sibling, and when there are none the parent is now
the deepest unfinished node and gets its own verify.

**Verification happens at every level.** A parent whose children all succeeded
can still fail its own expectation — three sub-goals achieved and the thing they
were supposed to add up to did not happen. That is the failure a person would
catch and a flat action list cannot express.

**3 · Decompose and sequence answer different questions.**

| | Decompose | Sequence |
| --- | --- | --- |
| Question | *what has to be true?* | *what do I do to make it true?* |
| Produces | child **goals**, each with an expectation | ordered **mutations** |
| Chosen when | no bounded sequence of the granted tools reaches the goal | one does |
| Recorded as | goal rows | `act` units in state `queued` |

A sequence unit writes two things about the world: `observedState` (what it
found when it looked) and the mutations it believes take that state to the
goal's `expectation`. That pair is exactly what the verify unit re-reads
against.

**4 · Steering adjusts the decomposition; it does not discard it.**

The in-flight unit finishes and commits. The boundary check marks the remaining
queued mutations `superseded` — **keeping their rationales** — and dispatches a
sequence unit that receives the goal, what has already been done, the superseded
plan with its reasoning, and the steering message. It returns an *amended* plan.

**5 · Every work unit commits before its continuation is dispatched.**

Durable state is the authority for what still needs doing; the in-memory queue
never is. A restart mid-sequence resumes the remaining mutations without
re-planning them, because the queue is rows.

### The state machines

**Task:**

```text
                    ┌────────────────────────────────┐
                    ▼                                │
  create ──► queued ──► running ──► waiting ─────────┘
                          │            │      (answer / approval / steering
                          │            │       resumes the same run)
                          ▼            ▼
                   completed | partial | failed | cancelled     (terminal)
```

| Object | States |
| --- | --- |
| Goal | `pending → active → achieved \| blocked \| abandoned` |
| Run | `queued → running → succeeded \| failed \| cancelled` |
| Work unit | `queued → started → succeeded \| failed \| superseded`; act adds `dispatched`, `rejected` |
| Question | `open → answered \| withdrawn` |
| Approval | `pending → granted \| denied \| withdrawn` |

Terminal task states are **absorbing**. `waiting` is a task-level state, never a
run-level one — a blocked task keeps its run `running` with nothing dispatched.

---

## 3 · The data model

One SQLite file, `data/agents.db`, eleven tables, all prefixed
`ag_<sha256(projectId)[0..16]>_`. Hand-written SQL through `better-sqlite3`.

| Table | Holds | The interesting constraint |
| --- | --- | --- |
| `tasks` | the aggregate root | scope columns paired `CHECK`; attention only when waiting |
| `task_receipts` | create replay, keyed on `request_id` | `task_id UNIQUE` |
| `messages` | the exchange | `UNIQUE (task_id, seq)` |
| `goals` | the decomposition tree | `UNIQUE (task_id, parent_goal_id, ordinal)` |
| `runs` | run lifecycle + usage | `UNIQUE (task_id, attempt)` |
| `work_units` | every unit, including queued and superseded | **`UNIQUE (run_id, unit_seq)`** |
| `tool_calls` | reads and mutations | one mutating call per unit (partial unique) |
| `questions` | question lifecycle | `answer_message_id UNIQUE` |
| `approvals` | approval lifecycle | `tool_call_id UNIQUE`, holds its own digest |
| `transcript` | model-facing messages | `PRIMARY KEY (run_id, msg_seq)` |
| `settlement_outbox` | Activity + Automation | `source_transaction_id UNIQUE` |

### Seven things worth understanding

**Frozen values are stored whole.** `persona_json` and `scope_json` hold
complete snapshots, not references — a task must be readable and replayable when
the persona has been edited and the context deleted.

**Persona is identified by `(persona_id, persona_revision)`.** Revision already
exists, starts at 1, increments per accepted update. Persona's two digests
answer finer questions than a task needs; they stay inside the snapshot JSON and
nothing indexes them.

**`context_entry_json` holds at most one entry; NULL means the whole project.**
A list can only ever union — *"the whole project except X"* is not expressible
by enumeration. Exclusion lives inside a Context via `POST /contexts/difference`.

**Goals carry `expectation` and `observedState`.** The first is written when the
goal is declared; the second when its sequence is planned. Together they are the
transition the sequence is supposed to produce, and what verify re-reads
against.

**`UNIQUE (run_id, unit_seq)` makes a duplicate claim a no-op.** The unit row is
its own receipt — Document uses a separate `stage_receipts` table for the same
guarantee.

**Queued mutations are rows, not memory.** That is what lets a person see what
the agent is *about* to do, what lets steering rewrite it, and what lets a
restart resume mid-sequence without re-planning.

**Partial indexes are the recovery working set.** `runs_live`, `tasks_unpinned`,
`goals_open`, `units_unfinished`, `outbox_pending` — and the one that matters
most:

```sql
CREATE INDEX ag_${prefix}_units_unfinished
  ON ag_${prefix}_work_units(state, created_at)
  WHERE state IN ('queued', 'started', 'dispatched');
```

### Retention

Agents is a **ledger**, not a revisioned resource. No history table, no
`task.delete`, no `task.purge`. The precedent is Activity — append-only,
excluded from revision-history retention. A task is the only Agents-side
evidence of calls that were proposed, refused, or denied.

**It is still bound into `ResourceRetentionScheduler`**, with a `pruneHistory`
that sweeps failed-task transcripts and a `purgeExpired` that deliberately
returns a constant zero. Being present with a zero makes "kept forever" a
visible decision rather than an absence someone later reads as an oversight.

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
`agentTaskService.create`. Every later use reads the frozen snapshot off the
task. Grepping for `#persona` outside that one file should return nothing.

Persona hands back a snapshot: the rendered prompt bytes, the revision, which
sections were folded in, and optionally **one `ContextEntry` pointing at
Persona's own private Context wrapper**.

Persona states six consumer laws and explicitly **cannot enforce any of them**:

| Law | How Agents keeps it |
| --- | --- |
| Resolve once per task | One call site, enforced by a grep test |
| Persist before the first model call | Snapshot written in the creation transaction |
| The fragment never precedes the contract | `[system: UNIT_PROMPT, system: snapshot.prompt, …]` |
| Union only — never narrows scope | The absent-entry guard, below |
| Never substitute silently | Unknown/deleted persona is a 400, never a fallback |
| Never log section text | Logs carry ids, revision, and section *count* only |

That last is a prohibition, not a feature. Persona's `background` section is
"standing facts the task should assume without being told" — user-authored prose
that can hold anything.

**The absent-entry guard:**

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

`resolveScope(entries)` is called **once**, by the first run.
`knowledge_retrieve` and `knowledge_read` are bound as tools for every planning
unit.

The manifest pins **membership, not content**. Retrieval is always against
current material; there is no revision-qualified search. A connector re-sync
mid-task changes what comes back — **accepted and expected**.

### Intelligence

`reasonWithToolsStructured` runs each planning unit's model call with read tools
bound and a decision schema. **It needs a platform change** — today the loop
throws bare at the round limit, with no decision, no partial, and no usage.
Item 1 in [supplementary-changes.md](supplementary-changes.md).

### Context — indirectly only

Agents imports the `ContextEntry` **type** and nothing else. Composition and set
algebra are the caller's job.

### Activity

**Everything the agent does reaches Activity**, through the local-outbox
discipline Document, Comments, and Templates use: `agent.task.created`,
`agent.mutation.committed`, `agent.mutation.refused`, `agent.task.settled`.

The overlap with the target's own publication is deliberate and kept. Document
publishes "the document changed"; Agents publishes "an agent was allowed to
change it". A refused mutation exists only in the second. Collapsing the pair
for display is a feed-UI concern to solve later.

### Every other capability — through one gateway

**Agents holds no capability runtimes and writes no per-capability adapters.**

```ts
export interface AgentEndpointGateway {
  catalogue(): readonly AgentEndpointDescriptor[];
  call(input: AgentEndpointCall): Promise<AgentEndpointOutcome>;
}
```

`call()` builds a `RequestEnvelope`, hands it to `registry.createJob(envelope)`,
admits the job, and awaits its `JobResponse`. That is the transport path minus
Fastify — so validation, queue placement, error mapping, and receipt idempotency
are all the target's own, and **a new capability becomes reachable by adding one
descriptor**.

The catalogue is **declared in one file**, not derived from the registry.
Deriving it would make every route agent-reachable the moment it registers,
including purges.

**One runtime rule makes loopback safe: a concurrent job may enqueue a serial
job; a serial job must never await one.** Every gateway-calling work unit is
concurrent.

---

## 5 · Endpoints

```text
POST /agents/command    serial      inline    all mutations
POST /agents/query      concurrent  inline    all reads
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
  | { type: "task.get" | "task.list" | "task.exchange" | "task.goals"
           | "task.runs" | "run.units" | "task.attention" | "task.toolCalls"; … };
```

`task.exchange` with `afterSeq` is the polling primitive a UI follows a live
task with. `task.attention` is the inbox. **`task.goals` returns the
decomposition tree** — what makes a task legible *before* it acts.

Internal intents, all concurrent except the last three:

```text
agents.run.start
agents.work.decompose   agents.work.sequence   agents.work.act   agents.work.verify
agents.run.settle       agents.task.settle     agents.task.recover     [serial]
```

---

## 6 · A task, start to finish

The clearest way to understand the loop is to watch one run. Objective:

> *"Add a summary block at the top of the Q3 review that pulls from the customer
> interviews."*

Policy: `POST /documents/query` (read, whole kind), `POST /documents/command`
scoped to `resourceIds: ["doc-q3"]`, `approval: "never"`. Context entry: absent
— the whole project.

### Unit 0 — creation (serial job, not a work unit)

```text
POST /agents/command { task.create, requestId: "req-1", input: {…} }
  ├─ resolve persona → snapshot (revision 4, five sections, no context)
  ├─ resolve limits  → preset "standard"
  ├─ validate policy → both endpoint keys exist in the catalogue
  └─ TRANSACTION: task (queued, scope NULL), message seq 1 "objective",
                  run attempt 1, receipt, outbox agent.task.created
  → 201 { taskId: "tsk-7" }
  → dispatch agents.run.start
```

**Surfaced to the user:** the task appears, state `queued`, with its objective as
exchange message 1.

### Unit 1 — run start + DECOMPOSE the objective

`agents.run.start` pins the scope (whole project, ~340 sources) and dispatches
the first unit. The active goal derivation finds no goals at all, so the root
objective itself is the leaf.

The decompose unit's model call binds `knowledge_retrieve`, `knowledge_read`,
and `POST /documents/query`. It reads — 4 calls, recorded as `tool_calls` rows
on this unit — and returns:

```json
{ "kind": "decompose",
  "rationale": "Two distinct things must be true: the block has to exist in the
                right place, and its prompt has to be grounded in the interviews.",
  "progress": "Found the Q3 review (doc-q3, revision 12). Planning two steps.",
  "children": [
    { "statement": "A prompt block exists at the top of doc-q3",
      "expectation": "doc-q3 has a prompt block as the first block of row 1" },
    { "statement": "That block's output summarises the customer interviews",
      "expectation": "the block's derived output has a published revision whose
                      evidence cites interview sources" } ] }
```

**Committed:** the unit, 2 goal rows (depth 0, ordinals 1 and 2), a `plan`
message and a `progress` message.

**Surfaced to the user:** *"Found the Q3 review (doc-q3, revision 12). Planning
two steps."* plus the two goals with their expectations, visible in
`task.goals`.

### Unit 2 — SEQUENCE goal 1

Cursor derives to goal 1 (deepest-leftmost pending, no children). It is a leaf
and has not been sequenced → sequence unit.

Reads: `POST /documents/query { document.load, documentId: "doc-q3" }`. Returns:

```json
{ "kind": "sequence",
  "observedState": "doc-q3 rev 12; row 1 holds one text block blk-a; no prompt blocks",
  "rationale": "One command creates the block. Prompt creation is asynchronous
                in Document, so this returns an attempt rather than a block.",
  "progress": "Creating a prompt block above the opening paragraph.",
  "actions": [
    { "endpointKey": "POST /documents/command",
      "request": { "requestId": "<injected>", "origin": "<injected>",
                   "command": { "type": "prompt.create.request",
                                "documentId": "doc-q3", "expectedRevision": 12,
                                "blockId": "blk-summary", "styleId": "sty-normal",
                                "placement": { "kind": "in-row", "rowId": "row-1",
                                               "beforeBlockId": "blk-a" },
                                "prompt": "Summarise the key themes…",
                                "contextEntries": [ … ],
                                "stabilisationText": "" } },
      "rationale": "Creates the block and its derived output in one command." } ] }
```

**Committed:** the unit, `observedState` on goal 1, one `act` unit in state
`queued`, a `plan` message and a `progress` message.

**Surfaced to the user:** *"Creating a prompt block above the opening
paragraph."* and, in `run.units`, the pending action with its rationale — **before
it runs**. This is the window in which steering is cheapest.

### Unit 3 — ACT

```text
├─ policy: endpoint permitted, doc-q3 in resourceIds, approval "never" → dispatch
├─ TRANSACTION: tool_call row, unit "dispatched",
│               request_id "agent:tc-9", request_digest "sha256:…"
├─ gateway.call → POST /documents/command
│     the gateway injects requestId, origin "agent",
│     actorId "agent:tsk-7:tc-9"
│     Document runs its own wire decoder, its own serial queue, its own receipt
│     ← 202 { type: "prompt.create-requested", attemptId: "att-3" }
└─ TRANSACTION: unit "succeeded", result { ok: true, statusCode: 202 },
                progress message, mutation_count + 1,
                outbox agent.mutation.committed
```

**Surfaced to the user:** *"Requested a prompt block (attempt att-3)."* and, in
Activity, `agent.mutation.committed` — alongside Document's own transaction with
`origin: "agent"`.

### Unit 4 — VERIFY goal 1, and why `pending` exists

Reads: `document.load` and `document.attempt`. **The block is not there yet** —
Document accepted the request and its own freeze/compute/settle pipeline is
still running.

```json
{ "kind": "pending",
  "observedState": "attempt att-3 is in state 'computing'",
  "waitingOn": "the prompt output to settle into doc-q3" }
```

This is the outcome a simpler design would get wrong. Treating 202 as *not-met*
would re-sequence and **re-issue the command**, creating a duplicate attempt.
Instead the runner re-dispatches this same verify unit after a backoff
(`verifyBackoffMs`, default `[1s, 2s, 5s, 15s, 30s]`).

**Surfaced to the user:** *"Waiting for the prompt output to settle."*

Third attempt, ~8s later:

```json
{ "kind": "met",
  "observedState": "doc-q3 rev 13; row 1 = [blk-summary (prompt), blk-a]",
  "evidence": "blk-summary is the first block of row 1 and holds output out-5 at
               applied revision 1" }
```

**Committed:** goal 1 → `achieved`, `settledByUnitId` set.

### Units 5–6 — goal 2

Cursor derives to goal 2. Sequence reads the derived output's evidence via
`POST /documents/query` and finds it already grounded in interview sources — so
it returns `satisfied` with zero actions rather than inventing work. Verify
confirms. Goal 2 → `achieved`.

**A sequence with no mutations is a normal outcome**, not a degenerate one.
Sometimes the world is already how the goal wants it.

### Unit 7 — SETTLE

Both top-level goals are `achieved`; the cursor derivation finds no unfinished
node. The runner dispatches a settle unit, whose input is the **goal tree with
outcomes**, not the transcript.

```text
TRANSACTION: task → completed, result message, run settled,
             transcripts pruned, outbox agent.task.settled
```

**Total:** 7 work units, 1 mutation, 3 exchange plans, 5 progress messages, 4
Activity rows.

---

## 7 · What steering does to that run

Suppose that while unit 3 (the ACT) is in flight, the user sends:

> *"Actually put it at the end, not the top — and mention the pricing feedback
> specifically."*

**Step 1 — the command lands.** `POST /agents/command { task.steer, … }` runs on
the serial queue: CAS on the task revision, append the message at
`head_seq + 1` with `in_response_to_seq` = the prior head. Returns 200
immediately. No run is dispatched — one is already running.

**Step 2 — the in-flight unit finishes.** Unit 3 has already dispatched to
Document, so it completes and records the 202. Had the steering arrived a moment
earlier, the act unit's pre-dispatch steer check would have superseded it and
nothing would have happened at all.

**Step 3 — the boundary check.** `task.head_seq > unit3.consumed_through_seq`,
and the steer-check counter is due:

- remaining `queued` act units → `superseded`, rationales kept
- one `system` message: *"Superseded 0 pending actions after new direction."*
- dispatch a **sequence unit for goal 1**, `trigger: "steering"`

**Step 4 — the re-sequence.** That unit's model input carries the goal and its
expectation, what has already been done (the block was created at the top), the
superseded plan with rationales, the steering message, and fresh reads. It
returns:

```json
{ "kind": "sequence",
  "observedState": "doc-q3 rev 13; blk-summary is first in row 1, output out-5",
  "rationale": "The block already exists at the top. Two mutations move it to the
                end and re-point its prompt at pricing feedback — cheaper and less
                disruptive than deleting and recreating.",
  "progress": "Moving the block to the end and refocusing it on pricing feedback.",
  "actions": [
    { "endpointKey": "POST /documents/command",
      "request": { "command": { "type": "document.submit", "documentId": "doc-q3",
                                "expectedRevision": 13,
                                "operations": [ { "type": "block.move", … } ] } },
      "rationale": "Relocate blk-summary to the last row." },
    { "endpointKey": "POST /documents/command",
      "request": { "command": { "type": "prompt.update-definition", … } },
      "rationale": "Narrow the prompt to pricing feedback." } ] }
```

**Committed:** the unit, updated `observedState` on goal 1, two `act` units
`queued`, a `plan` message.

**Surfaced to the user:** *"Moving the block to the end and refocusing it on
pricing feedback."* plus the amended two-action plan. They can see their steering
was received **and what it changed**.

### The three things this illustrates

**The agent plans forward from the current state, not from the plan it had.**
The block already exists at the top — that is not a problem to unwind, it is the
starting point of the new sequence. This is why steering needs no undo path.

**Nothing was left half-finished.** A mutation either dispatched (recorded, real,
part of current state) or did not (superseded, nothing happened). There is no
third case, which is what makes copy-on-write shadowing unnecessary rather than
merely expensive.

**Steering can also change the structure.** If the redirect had been *"forget the
summary, I want a comparison table instead"*, the sequence unit would return
`escalate` — the runner marks goal 1 `abandoned`, moves the cursor to the root,
and issues a **decompose** there with the reason in context. That is how a
redirect injects a new goal rather than merely re-ordering mutations.

### Other control events use the same path

| Event | What happens next |
| --- | --- |
| `task.answer` closes the last required question | task → running; sequence unit, trigger `steering` |
| `task.approve` grant | dispatch the waiting act unit |
| `task.approve` deny | that unit `rejected`; supersede the rest; sequence unit, trigger `refusal` |
| `task.cancel` | settle the run `cancelled` at the next boundary |

A denial re-sequences rather than continuing blindly — a refused mutation
usually invalidates the premise of the ones queued behind it.

### The steer check interval

`steerCheckInterval` (default 1) governs how many consecutive `act` units may run
before the boundary check consults the exchange. The check itself is free — an
integer comparison on rows already in hand. The knob exists so a **coherent run
of mutations can finish before being re-planned**: with an interval of 3, a
five-action sequence interrupts after action 3 rather than action 1.

Three rules stop it swallowing a redirect: the check always runs before a
planning unit regardless of interval; always runs before an act unit that needs
approval; and the counter resets at the end of every sequence.

---

## 8 · What surfaces to the user, by unit kind

| Unit | Exchange | Activity |
| --- | --- | --- |
| creation | `objective` | `agent.task.created` |
| `decompose` | `plan` (the child goals + expectations) + `progress` | — |
| `sequence` | `plan` (the ordered actions + rationales) + `progress` | — |
| `act` succeeded | `progress` (what changed) | `agent.mutation.committed` |
| `act` rejected | `progress` (what was refused and why) | `agent.mutation.refused` |
| `act` needs approval | `approvalRequest` (rationale + safe argument rendering) | — |
| `verify` met | nothing, or `progress` on a goal completing | — |
| `verify` pending | `progress` (`waitingOn`) | — |
| `verify` not-met | `progress` (the gap) | — |
| any unit | `question` when it needs a person | — |
| steering boundary | `system` (what was superseded) | — |
| `settle` | `result` | `agent.task.settled` |

The rule that keeps this useful rather than noisy: **a message is written when
the agent's intent or the world changed**, not per model round trip. A retrieval
that confirmed what the agent already believed is a `tool_calls` row, not an
exchange message.

The design consequence is worth naming: **a person steers what they can see.**
Plan and progress messages are not decoration — they are the mechanism that
makes steering possible at all, and the reason a `sequence` unit publishes its
plan *before* the actions run rather than after.

---

## 9 · The safety model

```text
model call            untrusted   a tool the provider chose to invoke
      ▼
Agents policy check   trusted     is this endpoint even reachable for this task?
      ▼
approval gate         human       does a person allow these exact arguments?  (opt-in)
      ▼
capability endpoint   trusted     is this request valid for that resource?
      ▼
capability state      canonical   its own revision, history, and validation
```

**Tools are generated from policy.** At run start, Agents builds the model's
`ToolSet` from the descriptors the policy permits and nothing else, so the model
cannot name a tool it was not granted. Rejection remains as defence in depth.

Evaluation is deny-by-default and total:

```text
1. catalogue must hold the key            else → rejected "unknown_endpoint"
2. some entry must match the key           else → rejected "not_permitted"
3. resourceIds present? extract via resourceIdPath and check
                                           else → rejected "resource_not_permitted"
4. non-mutating?                            → dispatch
5. mutation count < maxMutations           else → rejected "mutation_budget"
6. approval "always"?                       → awaitingApproval, else dispatch
```

**A rejection is not a run failure.** It is recorded, published as
`agent.mutation.refused`, and fed to a re-sequencing unit.

**Approval defaults to `"never"` and the gate is still strict.** The policy is
already the blast radius — mandatory, reviewed at creation, immutable, able to
name explicit resource ids. Requiring a click per edit on top of that makes the
common case tiresome enough that authors route around it. But when the gate *is*
on, it authorises one call with those exact arguments, bound to its digest. The
cost is named: the safe configuration is now the one you have to remember to
write, which makes *"enumerate the resource ids"* the habit worth building.

**Attribution reaches the target through fields that already exist**, injected by
the gateway and stripped from anything the model supplied:

```ts
{ requestId: `agent:${toolCallId}`,
  origin: "agent",
  actorId: `agent:${taskId}:${toolCallId}`,
  command: /* the model's arguments, unmodified */ }
```

A model that could claim `origin: "user"` could launder its own changes; one
that could choose its own `requestId` could collide with another task's receipt.

---

## 10 · Recovery

Runs in exactly two places, **neither a timer**: at startup, awaited before
`app.listen`; and opportunistically whenever a run settles.

| Found | Action |
| --- | --- |
| run `queued`, no units | re-dispatch `run.start` |
| task `queued`, no scope pinned | re-dispatch `run.start`; it pins |
| unit `started`, planning kind | fail it, re-derive the cursor, dispatch afresh |
| unit `dispatched`, kind act | **re-dispatch the call** |
| act units `queued`, run not running | dispatch the next one |
| task `waiting` | leave alone |
| task terminal, run non-terminal | settle the run `cancelled` |
| outbox row unpublished | republish |

An interrupted planning unit is **re-derived, not resumed**. **The goal tree and
the queued act units carry forward** — which is exactly why they are rows rather
than transcript. A restart mid-sequence resumes the remaining mutations without
re-planning them.

**The unknown-outcome case:**

```text
unit `dispatched`, no result
  └─ re-dispatch the identical command with the same request_id
       ├─ the target replays its receipt   → it landed; write the result ref
       └─ the target executes              → it had not landed; it lands now
```

Either way the outcome becomes known, and the call is never applied twice. **The
requirement on a target is only: be idempotent by caller-supplied request id.**
Document, Comments, and Templates already are.

---

## 11 · What this actually gives you

### What you'll be able to do

**Create a task** with an objective, a persona, one context reference (or none),
a limits preset, and a policy naming exactly which endpoints and resources it
can reach.

**See what it intends before it acts.** `task.goals` returns the tree with each
goal's statement, written expectation, observed state, and status. `run.units`
shows the queued mutations with their rationales *before* they run.

**Watch it work.** Poll `task.exchange` with `afterSeq` and see plans, progress,
questions, approval requests, and the result arrive in order.

**Steer it mid-flight** and have the redirect land within one work unit, with
the superseded plan handed to the re-planner rather than thrown away — so the
amended plan builds on what it was doing instead of starting over.

**Answer its questions.** Required questions block; optional ones don't.

**Approve or deny individual mutations**, when the policy asked for a gate.

**Cancel it.** Stops new work at the next boundary.

**Work a queue.** `task.attention` returns every task waiting on a person.

**Audit it completely.** Every read and every mutation is a `tool_calls` row.
Every unit records what it saw, why it acted, and which prompt version produced
it. **This is the only place a refused mutation exists.**

**See it in the project feed.** Task creation, every committed mutation, every
refusal, and settlement all reach Activity.

### What the design promises

- **A task's blast radius is knowable from its creation record, forever.**
- **Every effect is attributable from three directions** — the Agents row, the
  target's own accepted change, and Activity.
- **A crash never hides an effect**, and never loses a plan — goals and queued
  mutations are rows.
- **No effect is applied twice**, given a target idempotent by request id.
- **A persona edited tomorrow can't reach a task started today.**
- **Steering never leaves half-finished work**, because there is no half-state a
  mutation can be in.
- **Verification happens at every level of the tree**, not just at the leaves.
- **Adding a new agent-reachable capability is one descriptor.**

### What it explicitly does not promise

- **A permitted command used badly.** Policy constrains reach, not judgment.
- **Prompt injection defence.** Retrieved material is untrusted text. The
  mitigation is structural — the call still has to be a bound tool and pass
  policy. With approval off by default, **the policy is doing nearly all of this
  work**.
- **Cost exhaustion by a hostile objective.** Bounds cap it; they don't make it
  free.
- **Mid-model-call cancellation.** No `AbortSignal` exists in the runtime, so
  steer latency is one work unit.
- **Task deletion.** By design — the audit trail is the point.
- **Undo of effects.** That belongs to the target capabilities.
- **A stable corpus mid-task.** Retrieval is always current.

---

## 12 · The machinery, on one page

| Moving part | What it is | Where |
| --- | --- | --- |
| Two endpoints | command (serial) / query (concurrent) | `4-job-wiring/agents/registerAgentEndpoints.ts` |
| Eight internal intents | run.start, work.{decompose,sequence,act,verify}, run.settle, task.settle, task.recover | `createAgentJobs.ts`, total switch |
| Eleven SQLite tables | one project-prefixed file | `persistence/sqliteSchema.ts` |
| Traversal | derived cursor: deepest-leftmost unfinished goal | `domain/state.ts` |
| Unit idempotency | `UNIQUE (run_id, unit_seq)` | schema |
| Dispatch idempotency | `request_id = "agent:<toolCallId>"`, committed before dispatch | `application/agentActUnit.ts` |
| Approval binding | `requestDigest` over the canonical request | `domain/canonical.ts` |
| Policy evaluation | pure, deny-by-default, total | `domain/policy.ts` |
| Prompts | versioned per unit kind, recorded on each unit | `domain/prompts.ts` |
| Reaching capabilities | one gateway over the job registry; declared catalogue | `ports/endpointGateway.ts` |
| Tool exposure | policy-permitted descriptors → `ToolBinding[]` | `tools/endpointTools.ts` |
| Redirection | the boundary check after every unit | `application/agentRunner.ts` |
| Outbound notification | one outbox, `destination` in `{activity, automation}` | schema + `ports/activityPublisher.ts` |
| Recovery | startup (pre-`listen`) + opportunistic on run settle | `application/agentRecovery.ts` |
| Retention | `pruneHistory` sweeps failed transcripts; `purgeExpired` returns 0 | bound in `startBackend.ts` |
| Limits | named presets in `configuration.yaml`, resolved and frozen per task | `0-utils/config` |

**Prerequisites outside Agents** — full list in
[supplementary-changes.md](supplementary-changes.md). The blocking ones:

1. `reasonWithToolsStructured` needs a non-throwing bounded mode.
2. `buildInternalEnvelope` beside `RequestEnvelope`, plus the re-entrancy rule
   written down and tested.
3. An `agents:` config section with named limit presets.
4. `#agents` aliases and the wiring-test assertion.

Notably **not** on that list: any change to Document, Derived Outputs, Comments,
Templates, Activity, or Persona.

**The build order:**

1. Task, goals, and exchange — no runs.
2. Read-only work against Derived Outputs as the first gateway target.
3. Multi-unit runs with the traversal and the boundary check.
4. Steering, questions, and approvals mid-flight.
5. Document as a mutating target.
6. Automation origin.
