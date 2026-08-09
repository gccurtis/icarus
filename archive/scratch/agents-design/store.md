# Agents — store

SQLite persistence. One database file owned by this capability, following the
house pattern: `CREATE TABLE IF NOT EXISTS`, a table prefix derived from
`SHA-256(projectId).slice(0, 16)`, and partial indexes for liveness. No shared
`Database` abstraction, no ORM; hand-written SQL through `better-sqlite3`.

The store interface is `Promise`-returning, matching Document, Activity, and
Persona.

```ts
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
db.pragma("synchronous = NORMAL");
```

Eleven tables: `tasks`, `task_receipts`, `messages`, `queue_items`,
`plan_nodes`, `runs`, `cycles`, `tool_calls`, `questions`, `approvals`,
`transcript`, `settlement_outbox`.

## Tasks

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_tasks (
  id                TEXT    PRIMARY KEY,
  revision          INTEGER NOT NULL DEFAULT 1,
  state             TEXT    NOT NULL,   -- queued|running|waiting|completed|partial|failed|cancelled
  attention         TEXT,               -- question|approval; NULL unless waiting
  objective         TEXT    NOT NULL,
  origin_kind       TEXT    NOT NULL,   -- user|automation
  origin_id         TEXT,
  actor_id          TEXT    NOT NULL,
  persona_json      TEXT    NOT NULL,   -- the full frozen PersonaSnapshot
  persona_id        TEXT    NOT NULL,
  persona_revision  INTEGER NOT NULL,
  -- Which loop this task runs. Pinned by name AND version, so shipping a new
  -- strategy version cannot change a task already in flight.
  strategy_name     TEXT    NOT NULL,
  strategy_version  TEXT    NOT NULL,
  strategy_options_json TEXT NOT NULL,
  context_entry_json TEXT,              -- at most one entry; NULL = whole project
  scope_json        TEXT,               -- frozen manifest; NULL until pinned
  scope_pinned_at   TEXT,
  policy_json       TEXT    NOT NULL,
  limits_json       TEXT    NOT NULL,
  head_seq          INTEGER NOT NULL DEFAULT 0,
  mutation_count    INTEGER NOT NULL DEFAULT 0,
  cycle_count       INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  result_json       TEXT,               -- present iff terminal
  created_at        TEXT    NOT NULL,
  updated_at        TEXT    NOT NULL,
  settled_at        TEXT,
  CHECK ((scope_json IS NULL) = (scope_pinned_at IS NULL)),
  CHECK (attention IS NULL OR state = 'waiting'),
  CHECK ((result_json IS NULL) = (settled_at IS NULL))
);

CREATE INDEX IF NOT EXISTS ag_${prefix}_tasks_state
  ON ag_${prefix}_tasks(state, updated_at DESC);
CREATE INDEX IF NOT EXISTS ag_${prefix}_tasks_attention
  ON ag_${prefix}_tasks(attention, updated_at DESC)
  WHERE attention IS NOT NULL;
CREATE INDEX IF NOT EXISTS ag_${prefix}_tasks_origin
  ON ag_${prefix}_tasks(origin_kind, origin_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS ag_${prefix}_tasks_persona
  ON ag_${prefix}_tasks(persona_id, persona_revision, updated_at DESC);
CREATE INDEX IF NOT EXISTS ag_${prefix}_tasks_strategy
  ON ag_${prefix}_tasks(strategy_name, strategy_version, updated_at DESC);
CREATE INDEX IF NOT EXISTS ag_${prefix}_tasks_unpinned
  ON ag_${prefix}_tasks(created_at)
  WHERE scope_json IS NULL;
```

`persona_json` and `scope_json` hold complete frozen values, not references —
a task must be readable and replayable when the persona has been edited and the
context deleted.

**Persona is identified by `(persona_id, persona_revision)`.** Revision already
exists, starts at 1, and increments per accepted update. Persona's two digests
answer finer questions than a task needs; they stay inside the snapshot JSON and
nothing here indexes or compares them.

**The strategy binding is pinned by name *and* version.** The registry is keyed
on the pair, so `decompose-verify@2` cannot reach a task running `@1`.
`ag_${prefix}_tasks_strategy` is what tells an operator whether a version is
still referenced by live tasks and therefore cannot be unregistered.

`context_entry_json` holds **at most one** entry; NULL means the whole project.
A caller wanting an exclusion composes it into a single Context first, because a
list could only ever union.

`mutation_count`, `cycle_count`, and `total_tokens` are counters maintained by
cycle settlement rather than derived on read, because all three are enforced as
budgets on the hot path. `state` and `attention` are the same kind of thing — a
projection over the questions and approvals tables, which are authoritative.
Recovery recomputes them.

## Creation receipts

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_task_receipts (
  request_id     TEXT    PRIMARY KEY,
  request_digest TEXT    NOT NULL,
  task_id        TEXT    NOT NULL UNIQUE,
  response_json  TEXT    NOT NULL,
  created_at     TEXT    NOT NULL
);
```

Replay of `task.create` with the same `requestId` returns `response_json`; a
replay carrying a different digest is `idempotency_mismatch`. Keyed on the
request id alone because there is no task id at retry time, exactly like
`doc_<prefix>_create_receipts`.

## The queue

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_queue_items (
  id                 TEXT    PRIMARY KEY,
  task_id            TEXT    NOT NULL,
  -- Position. Lower runs first. Sparse (allocated in steps of 1000) so a front
  -- push takes a value below the current minimum and a back push above the
  -- current maximum, and no insertion ever renumbers the queue.
  ordinal            INTEGER NOT NULL,
  kind               TEXT    NOT NULL,   -- strategy-defined; the runtime never branches on it
  label              TEXT    NOT NULL,   -- short, person-facing
  payload_json       TEXT    NOT NULL,   -- strategy-defined; opaque here
  state              TEXT    NOT NULL,   -- pending|active|done|superseded
  supersede_reason   TEXT,
  pushed_by_cycle_id TEXT,
  worked_by_cycle_id TEXT,
  plan_node_id       TEXT,
  created_at         TEXT    NOT NULL,
  settled_at         TEXT,
  UNIQUE (task_id, ordinal),
  CHECK (state != 'superseded' OR supersede_reason IS NOT NULL)
);

-- The dequeue: the working set, in order.
CREATE INDEX IF NOT EXISTS ag_${prefix}_queue_pending
  ON ag_${prefix}_queue_items(task_id, ordinal)
  WHERE state = 'pending';

-- Recovery: an item dequeued by a cycle that never finished.
CREATE INDEX IF NOT EXISTS ag_${prefix}_queue_active
  ON ag_${prefix}_queue_items(task_id)
  WHERE state = 'active';
```

**A dequeue is `SELECT … WHERE state = 'pending' ORDER BY ordinal LIMIT 1`,**
then a CAS update to `active`. The partial index makes that an index seek over
what is left rather than a scan of history.

**Sparse ordinals** are what make front pushes free. Allocating in steps of 1000
means a front push is `min(ordinal) - 1000` and a back push is
`max(ordinal) + 1000`; several pushes in a row subdivide the gap. Renumbering
would rewrite the whole queue on every insertion and would break the "work
already performed is immutable" property.

**Items are never edited.** An item is pushed, dequeued once, and settled to
`done` or `superseded`. A strategy that wants the work again pushes a new item —
which keeps the queue a ledger of what was planned, including what was planned
and then dropped.

`supersede_reason` is required for a superseded item because that string is what
the exchange's `system` message and the next cycle's strategy input both carry.
A silently dropped item would make a redirect illegible after the fact.

## Plan nodes

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_plan_nodes (
  id                  TEXT    PRIMARY KEY,
  task_id             TEXT    NOT NULL,
  parent_id           TEXT,
  depth               INTEGER NOT NULL,
  ordinal             INTEGER NOT NULL,
  kind                TEXT    NOT NULL,   -- strategy-defined
  statement           TEXT    NOT NULL,
  expectation         TEXT,               -- what the strategy expects to observe
  observed_state      TEXT,               -- what it last observed
  state               TEXT    NOT NULL,   -- pending|active|done|blocked|abandoned
  detail_json         TEXT,               -- strategy-specific payload
  created_by_cycle_id TEXT    NOT NULL,
  settled_by_cycle_id TEXT,
  created_at          TEXT    NOT NULL,
  settled_at          TEXT,
  UNIQUE (task_id, parent_id, ordinal),
  CHECK (depth >= 0),
  CHECK ((settled_by_cycle_id IS NULL) = (settled_at IS NULL))
);

CREATE INDEX IF NOT EXISTS ag_${prefix}_plan_task
  ON ag_${prefix}_plan_nodes(task_id, depth, ordinal);
CREATE INDEX IF NOT EXISTS ag_${prefix}_plan_open
  ON ag_${prefix}_plan_nodes(task_id, ordinal)
  WHERE state IN ('pending', 'active');
```

**Deliberately generic, not a goal tree.** A `decompose-verify` strategy writes
goals with expectations; `simple-loop` writes one node per attempt; something
later writes whatever it needs. The runtime never interprets `kind`, `detail_json`,
or the shape of the tree.

The property being protected is that **a person can see what the agent intends
before it acts**, which is what makes steering directive rather than reactive.
Keeping that in a structured table rather than inside opaque strategy memory is
the entire reason plan nodes are core schema rather than strategy state.

`expectation` and `observed_state` are nullable because not every strategy has
the concept. Where a strategy does use them, the pair is the transition its work
is supposed to produce, and what a later check re-reads against.

## Runs and cycles

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_runs (
  id               TEXT    PRIMARY KEY,
  task_id          TEXT    NOT NULL,
  attempt          INTEGER NOT NULL,
  status           TEXT    NOT NULL,   -- queued|running|succeeded|failed|cancelled
  -- Strategy-owned state, per run. A new run starts from initialMemory() over
  -- the durable queue and plan, which is what makes runs disposable.
  memory_json      TEXT,
  result_json      TEXT,
  failure_code     TEXT,
  usage_prompt     INTEGER NOT NULL DEFAULT 0,
  usage_completion INTEGER NOT NULL DEFAULT 0,
  usage_total      INTEGER NOT NULL DEFAULT 0,
  usage_reasoning  INTEGER NOT NULL DEFAULT 0,
  cost_usd         REAL,
  created_at       TEXT    NOT NULL,
  started_at       TEXT,
  settled_at       TEXT,
  updated_at       TEXT    NOT NULL,
  UNIQUE (task_id, attempt)
);

CREATE INDEX IF NOT EXISTS ag_${prefix}_runs_task
  ON ag_${prefix}_runs(task_id, attempt DESC);
CREATE INDEX IF NOT EXISTS ag_${prefix}_runs_live
  ON ag_${prefix}_runs(status, updated_at)
  WHERE status IN ('queued', 'running');

CREATE TABLE IF NOT EXISTS ag_${prefix}_cycles (
  id                   TEXT    PRIMARY KEY,
  run_id               TEXT    NOT NULL,
  task_id              TEXT    NOT NULL,
  cycle_seq            INTEGER NOT NULL,
  state                TEXT    NOT NULL,   -- started|succeeded|failed|cancelled
  queue_item_id        TEXT,               -- NULL when the queue was empty
  consumed_through_seq INTEGER NOT NULL,
  -- Strategy-defined label for the audit view. The runtime never branches on it.
  step_kind            TEXT,
  prompt_version       TEXT,
  tool_rounds          INTEGER NOT NULL DEFAULT 0,
  read_count           INTEGER NOT NULL DEFAULT 0,
  mutation_count       INTEGER NOT NULL DEFAULT 0,
  interrupted_by       TEXT,               -- steering|approval|cancelled|budget
  safe_summary         TEXT,
  usage_total          INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT    NOT NULL,
  settled_at           TEXT,
  UNIQUE (run_id, cycle_seq)
);

CREATE INDEX IF NOT EXISTS ag_${prefix}_cycles_run
  ON ag_${prefix}_cycles(run_id, cycle_seq);
CREATE INDEX IF NOT EXISTS ag_${prefix}_cycles_unfinished
  ON ag_${prefix}_cycles(state, created_at)
  WHERE state = 'started';
```

`UNIQUE (run_id, cycle_seq)` makes a duplicate claim a no-op: a retried dispatch
attempts the insert, hits the constraint, reads the existing row, and returns
its recorded outcome. **The cycle row is its own receipt** — one mechanism where
an earlier model had a separate stage-receipts table.

`memory_json` lives on the run, not the task, and is capped by size. It is
explicitly **not** the audit record — cycles, tool calls, plan nodes, the queue,
and the exchange are, and all of those are structured. Losing or resetting
memory degrades to "start a fresh run over durable state", which is what runs
are for.

`interrupted_by` records why a cycle's tool loop unwound early, so
`agents.recover` and the audit view can distinguish "the model finished" from
"we stopped it".

## Tool calls

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_tool_calls (
  id               TEXT    PRIMARY KEY,
  task_id          TEXT    NOT NULL,
  run_id           TEXT    NOT NULL,
  cycle_id         TEXT    NOT NULL,
  round_index      INTEGER NOT NULL,
  mutating         INTEGER NOT NULL,          -- 0|1
  endpoint_key     TEXT    NOT NULL,
  resource_kind    TEXT,
  resource_id      TEXT,
  request_json     TEXT    NOT NULL,
  -- `agent:<id>`. Committed before dispatch for mutations, never rewritten.
  -- The target's own receipt is keyed on it, which is what makes recovery a
  -- replay of a known request rather than a guess about an unknown outcome.
  request_id       TEXT    NOT NULL UNIQUE,
  request_digest   TEXT    NOT NULL,
  state            TEXT    NOT NULL,          -- recorded|rejected|awaitingApproval|dispatched|succeeded|failed
  result_json      TEXT,
  rejection_reason TEXT,
  created_at       TEXT    NOT NULL,
  settled_at       TEXT,
  CHECK (mutating = 1 OR state IN ('recorded', 'rejected'))
);

CREATE INDEX IF NOT EXISTS ag_${prefix}_calls_cycle
  ON ag_${prefix}_tool_calls(cycle_id, round_index);
CREATE INDEX IF NOT EXISTS ag_${prefix}_calls_task
  ON ag_${prefix}_tool_calls(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ag_${prefix}_calls_resource
  ON ag_${prefix}_tool_calls(resource_kind, resource_id, created_at DESC);

-- Recovery: the single most important index in this schema. It finds the one
-- state that stands between "we know what happened" and "we do not".
CREATE INDEX IF NOT EXISTS ag_${prefix}_calls_unsettled
  ON ag_${prefix}_tool_calls(state, created_at)
  WHERE state IN ('dispatched', 'awaitingApproval');
```

**This table holds reads and mutations both.** A cycle's planning turn records
every read it made; an intercepted mutation records the same way with
`mutating = 1`. Recording reads costs one row each and buys the audit answer to
*"what did it look at before it decided that?"* — which, for a capability whose
justification is being knowable after the fact, is worth the rows.

`request_json` retains the exact arguments as dispatched, which makes the record
an audit trail rather than a summary of one. `request_id` retains the identity
the *target* knows the call by, which makes an unsettled call resolvable:
recovery re-sends `request_json` under the same `request_id` and the target's
receipt either replays or executes. Both columns are needed; neither substitutes
for the other.

`resource_kind` / `resource_id` are extracted at policy time via the
descriptor's `resourceIdPath` and stored, so "what has this agent touched" is an
index scan rather than a JSON walk over every body.

There is **no** unique constraint limiting mutations per cycle. A cycle's tool
loop may issue several across several rounds; the constraint that matters is the
runtime invariant that **at most one is `dispatched` at a time**, which holds
because the handler awaits each dispatch before returning to the model.

## Questions and approvals

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_questions (
  id                TEXT    PRIMARY KEY,
  task_id           TEXT    NOT NULL,
  plan_node_id      TEXT,
  message_id        TEXT    NOT NULL UNIQUE,
  state             TEXT    NOT NULL,   -- open|answered|withdrawn
  required          INTEGER NOT NULL,
  answer_message_id TEXT    UNIQUE,
  opened_at         TEXT    NOT NULL,
  closed_at         TEXT
);

CREATE INDEX IF NOT EXISTS ag_${prefix}_questions_open
  ON ag_${prefix}_questions(task_id, opened_at)
  WHERE state = 'open';

CREATE TABLE IF NOT EXISTS ag_${prefix}_approvals (
  id                  TEXT    PRIMARY KEY,
  task_id             TEXT    NOT NULL,
  tool_call_id        TEXT    NOT NULL UNIQUE,
  request_digest      TEXT    NOT NULL,
  request_message_id  TEXT    NOT NULL,
  state               TEXT    NOT NULL,  -- pending|granted|denied|withdrawn
  decision_message_id TEXT,
  decided_by          TEXT,
  requested_at        TEXT    NOT NULL,
  decided_at          TEXT
);

CREATE INDEX IF NOT EXISTS ag_${prefix}_approvals_pending
  ON ag_${prefix}_approvals(task_id, requested_at)
  WHERE state = 'pending';
-- Granted but not yet dispatched: the first thing a cycle does.
CREATE INDEX IF NOT EXISTS ag_${prefix}_approvals_granted
  ON ag_${prefix}_approvals(task_id, decided_at)
  WHERE state = 'granted';
```

`answer_message_id UNIQUE` enforces "one canonical answer" at the schema level:
a second answer cannot be written even by a bug.

`request_digest` is stored on the approval, not just looked up from the call.
The grant is a statement *about a digest*, so it holds the digest it granted; a
call re-proposed with different arguments produces a different digest and finds
no matching grant.

`ag_${prefix}_approvals_granted` is what step 2 of a cycle reads: **the runtime
dispatches a granted call, not the model.** Asking the model to re-issue it
would be wasteful and might not reproduce the same arguments — which would
silently escape the approval it was granted.

## Run transcript

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_transcript (
  run_id       TEXT    NOT NULL,
  msg_seq      INTEGER NOT NULL,
  cycle_id     TEXT,
  role         TEXT    NOT NULL,   -- assistant|tool|user|system
  content_json TEXT    NOT NULL,
  created_at   TEXT    NOT NULL,
  PRIMARY KEY (run_id, msg_seq)
);
```

Model-facing state, never exposed by the read API. It holds no hidden reasoning
or provider trace — those never leave the Intelligence port.

A cycle's model input is assembled mostly from **rows** — the task, the queue,
the plan, the exchange tail, the previous cycle's outcomes, strategy memory. The
transcript supplies continuity within a cycle's own tool loop. That is what
makes an interrupted cycle safe to re-run rather than resume.

Pruned in the owning task's settlement transaction, except for tasks that
settled `failed`, whose transcripts are retained for diagnosis. Those are the
one thing Agents hands to the shared retention sweep.

## Settlement outbox

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_settlement_outbox (
  id            TEXT    PRIMARY KEY,
  task_id       TEXT    NOT NULL,
  tool_call_id  TEXT,                    -- set for per-mutation rows
  destination   TEXT    NOT NULL,        -- activity|automation
  kind          TEXT    NOT NULL,        -- agent.task.created | agent.mutation.committed
                                         -- agent.mutation.refused | agent.task.settled
  source_transaction_id TEXT NOT NULL UNIQUE,
  automation_id TEXT,
  payload_json  TEXT    NOT NULL,
  created_at    TEXT    NOT NULL,
  published_at  TEXT,
  CHECK (destination IN ('activity', 'automation')),
  CHECK ((destination = 'automation') = (automation_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS ag_${prefix}_outbox_pending
  ON ag_${prefix}_settlement_outbox(created_at, destination)
  WHERE published_at IS NULL;
```

One table, two destinations. Rows are written inside the transaction that
committed the thing they describe, and published after commit, so each
destination is notified exactly once even across a crash.
`publishPendingActivity()` at startup and the recovery sweep republish anything
with a null `published_at`. The partial index follows Document's
`transaction_outbox` pattern exactly.

`source_transaction_id` is passed to Activity as its `idempotencyKey`, so an
equal retry addresses the same ledger row while changed content under the same
key raises `ActivityTransactionConflictError`. Rows survive after publication so
a duplicate is recognised rather than re-sent.

## Transaction boundaries

Every boundary below is exactly one SQLite transaction. Nothing dispatches from
inside one.

| Boundary | Writes |
| --- | --- |
| **create** | task (scope NULL), objective message, seed queue item, run 1, receipt, outbox `agent.task.created` |
| **scope pin** | task scope columns (CAS revision); idempotent |
| **control command** | task (CAS revision), message, and one of: question close / approval decision / cancel result |
| **cycle claim** | cycle row `started`, queue item → `active` |
| **read record** | tool call row `recorded` |
| **mutation dispatch** | tool call row `dispatched`, `request_id`, `request_digest` |
| **mutation settle** | tool call terminal + result ref, `progress` message, task `mutation_count`, outbox `agent.mutation.committed` |
| **mutation reject** | tool call `rejected`, `progress` message, outbox `agent.mutation.refused` |
| **approval request** | tool call `awaitingApproval`, approval row `pending`, `approvalRequest` message |
| **cycle settle** | cycle terminal, run `memory_json`, exchange messages, plan writes, queue writes, queue item → `done`, task counters |
| **run settle** | run terminal, task state, attention |
| **task settle** | task terminal + result, result message, supersede pending queue items, close open plan nodes, withdraw questions and approvals, run settle, transcript prune (unless `failed`), outbox rows per destination |

The compare-and-swap rule: every write that changes `state`, `attention`, or
`revision` on a task is guarded by `WHERE id = ? AND revision = ?`. A losing
writer changes zero rows and its caller treats that as `discarded` rather than
retrying blindly — the same compare-and-publish shape Derived Outputs uses.

**Queue writes are part of the cycle settle transaction**, not separate. A cycle
that pushes three items and completes its own either commits all four changes or
none, so the queue can never reflect a cycle that did not finish.

## Retention

Agents is a **ledger**, not a revisioned resource. It deliberately does not
adopt the current/history contract that Document, Persona, Comments, Templates,
Investigation, Derived Outputs, Connector, General Files, Structured Data, and
Context all follow. There is no history table, no `task.delete`, no
`task.purge`.

The precedent is Activity — append-only, explicitly excluded from
revision-history retention and purge, along with transaction outboxes, command
receipts, and claims. A task is the same kind of artefact: a record of something
that happened, and the **only** Agents-side evidence of calls that were
proposed, refused, or denied. Deleting it destroys the audit trail that
justifies letting an agent act at all.

| Data | Policy |
| --- | --- |
| Tasks, exchange, queue items, plan nodes, questions, approvals, tool calls | Kept indefinitely — the audit record |
| Cycles | Kept — small, and how a run is explained |
| Run memory | Kept with the run; small and capped |
| Transcripts, settled task | Pruned in the settlement transaction |
| Transcripts, `failed` task | Kept for diagnosis, then swept — see below |
| Outbox rows | Kept after publication, so a duplicate is recognised |

**Agents is still bound into `ResourceRetentionScheduler`.** Failed-task
transcripts hold provider-facing message arrays and, under a pure
keep-everything policy, would never be pruned by anything. So the capability
implements the standard port:

```ts
pruneHistory(cutoff: string): Promise<number>;   // prunes transcripts for tasks
                                                 // that settled before `cutoff`,
                                                 // including failed ones
purgeExpired(cutoff: string): Promise<number>;   // no-op, returns 0 — tasks are
                                                 // never deleted, so nothing is
                                                 // ever eligible for purge
```

and `startBackend.ts` binds it alongside the rest:

```ts
bindResourceRetentionPort("agents", agents)
```

Two things this buys beyond the transcripts. Agents appears in the retention
roster where an operator looking for "what maintains this database" expects to
find it. And the decision to keep tasks forever becomes visible as a
`purgeExpired` that deliberately returns zero, rather than an absence someone
later reads as an oversight.
