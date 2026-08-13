# Agents — store

SQLite persistence. One database file owned by this capability, following the
house pattern: `CREATE TABLE IF NOT EXISTS`, a table prefix derived from
`SHA-256(projectId).slice(0, 16)`, and partial indexes for liveness. There is no
shared `Database` abstraction and no ORM; hand-written SQL through
`better-sqlite3`.

The store interface is `Promise`-returning, matching Document, Activity, and
Persona.

Standard pragmas open every schema initialiser:

```ts
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
db.pragma("synchronous = NORMAL");
```

## Tables

Ten tables: `tasks`, `task_receipts`, `messages`, `goals`, `runs`,
`work_units`, `tool_calls`, `questions`, `approvals`, `transcript`,
`settlement_outbox`.

### Tasks

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_tasks (
  id                TEXT    PRIMARY KEY,
  revision          INTEGER NOT NULL DEFAULT 1,
  state             TEXT    NOT NULL,   -- queued|running|waiting|completed|partial|failed|cancelled
  attention         TEXT,               -- question|approval; NULL unless waiting
  objective         TEXT    NOT NULL,
  origin_kind       TEXT    NOT NULL,   -- user|automation
  origin_id         TEXT,               -- automation id; NULL for user
  actor_id          TEXT    NOT NULL,
  persona_json      TEXT    NOT NULL,   -- the full frozen PersonaSnapshot
  persona_id        TEXT    NOT NULL,   -- denormalised for filtering
  persona_revision  INTEGER NOT NULL,   -- denormalised; identifies the version used
  context_entry_json TEXT,              -- at most one entry; NULL = whole project
  scope_json        TEXT,               -- frozen manifest; NULL until pinned
  scope_pinned_at   TEXT,
  policy_json       TEXT    NOT NULL,
  limits_json       TEXT    NOT NULL,
  head_seq          INTEGER NOT NULL DEFAULT 0,
  mutation_count    INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  result_json       TEXT,               -- present iff terminal
  created_at        TEXT    NOT NULL,
  updated_at        TEXT    NOT NULL,
  settled_at        TEXT,
  -- "Pinned but no timestamp" is unrepresentable, the same way Persona makes
  -- "a context with no wrapper" so.
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
CREATE INDEX IF NOT EXISTS ag_${prefix}_tasks_unpinned
  ON ag_${prefix}_tasks(created_at)
  WHERE scope_json IS NULL;
```

`persona_json` and `scope_json` hold complete frozen values, not references.
This is the point of the freeze: a task must be readable and replayable when the
persona has been edited and the context deleted.

**Persona is identified by revision, not digest.** `(persona_id,
persona_revision)` plus the section list inside `persona_json` fully determines
the prompt the task received. Persona's `definitionDigest` and `promptDigest`
remain inside the snapshot JSON for anyone who wants them, but nothing here
indexes or compares them — revision already answers "which version of this
persona ran", it is the granularity the historical model provides, and it is one
number instead of two hashes with subtly different coverage.

`context_entry_json` holds **at most one** entry. NULL means the whole project.
A caller wanting an exclusion composes it into a single Context first; a list
could only ever union. See [canonical-model.md](canonical-model.md).

`ag_${prefix}_tasks_unpinned` is the recovery index for tasks whose first run
never started: created, queued, and still holding no scope manifest.

`mutation_count` and `total_tokens` are counters maintained by unit settlement
rather than derived on read, because both are enforced as budgets on the hot
path. `state` and `attention` are the same kind of thing — a projection over the
questions and approvals tables, which are authoritative. Recovery recomputes
them for every non-terminal task it visits.

### Creation receipts

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_task_receipts (
  request_id     TEXT    PRIMARY KEY,
  request_digest TEXT    NOT NULL,
  task_id        TEXT    NOT NULL UNIQUE,
  response_json  TEXT    NOT NULL,
  created_at     TEXT    NOT NULL
);
```

Replay of `task.create` with the same `requestId` returns `response_json`. A
replay carrying a *different* `request_digest` is `idempotency_mismatch` — the
same rule Document applies. Keyed on the request id alone because there is no
task id at retry time, exactly like `doc_<prefix>_create_receipts`.

### Exchange

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_messages (
  id             TEXT    PRIMARY KEY,
  task_id        TEXT    NOT NULL,
  run_id         TEXT,                 -- NULL for operator messages between units
  unit_id        TEXT,
  seq            INTEGER NOT NULL,
  kind           TEXT    NOT NULL,
  author_kind    TEXT    NOT NULL,     -- user|agent|automation|system
  author_id      TEXT,
  -- For operator-authored messages: the task's headSeq when this was written.
  -- Answers "what had the agent said when the person typed this?", which is
  -- what makes a steering message legible after the fact.
  in_response_to_seq INTEGER,
  content_json   TEXT    NOT NULL,
  created_at     TEXT    NOT NULL,
  UNIQUE (task_id, seq)
);

CREATE INDEX IF NOT EXISTS ag_${prefix}_messages_task_seq
  ON ag_${prefix}_messages(task_id, seq);
```

`UNIQUE (task_id, seq)` is the contiguity guard. Sequence allocation is
`head_seq + 1`, read and written inside the same transaction as the insert,
under the serial command lane — which is why the exchange never needs its own
lock.

Messages are append-only. There is no update or delete path in the store
interface at all, so "edit a message" is not a bug that can be written.

### Goals

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_goals (
  id                TEXT    PRIMARY KEY,
  task_id           TEXT    NOT NULL,
  parent_goal_id    TEXT,               -- NULL for a top-level objective
  depth             INTEGER NOT NULL,
  ordinal           INTEGER NOT NULL,
  statement         TEXT    NOT NULL,
  -- What we expect to observe when this goal is met. Written when the goal is
  -- declared; required. This is what a verify unit compares against.
  expectation       TEXT    NOT NULL,
  -- What the sequence unit observed to be true when it planned. The pair
  -- (observed_state → expectation) is the transition the sequence produces.
  observed_state    TEXT,
  state             TEXT    NOT NULL,   -- pending|active|achieved|blocked|abandoned
  decompose_attempts INTEGER NOT NULL DEFAULT 0,
  sequence_attempts  INTEGER NOT NULL DEFAULT 0,
  verify_attempts    INTEGER NOT NULL DEFAULT 0,
  created_by_unit_id TEXT   NOT NULL,
  settled_by_unit_id TEXT,
  created_at        TEXT    NOT NULL,
  settled_at        TEXT,
  UNIQUE (task_id, parent_goal_id, ordinal),
  CHECK (depth >= 0),
  CHECK ((settled_by_unit_id IS NULL) = (settled_at IS NULL))
);

CREATE INDEX IF NOT EXISTS ag_${prefix}_goals_task
  ON ag_${prefix}_goals(task_id, depth, ordinal);
CREATE INDEX IF NOT EXISTS ag_${prefix}_goals_open
  ON ag_${prefix}_goals(task_id, ordinal)
  WHERE state IN ('pending', 'active');
CREATE INDEX IF NOT EXISTS ag_${prefix}_goals_parent
  ON ag_${prefix}_goals(task_id, parent_goal_id, ordinal);
```

**The decomposition is durable state, not transcript.** Three things break if
the plan lives only in the model's context: a restart re-derives it at full
token cost and may derive something different; a person cannot see what the
agent intends until it has already acted; and `expectation` — the thing a verify
unit compares against — has nowhere to live, so the agent grades its own
homework in prose.

**There is no cursor column.** The active goal is derived on every boundary
check: the first goal in depth-first pre-order that is `pending` or `active` and
has no `pending` or `active` children. `ag_${prefix}_goals_open` and
`ag_${prefix}_goals_parent` are what make that walk cheap. Deriving rather than
storing means there is nothing to drift, nothing to reconcile at recovery, and
no way for the traversal to disagree with the goal states.

The three attempt counters are the anti-spiral bounds — `maxDecomposeAttempts`,
`maxSequenceAttempts`, and `maxVerifyAttempts` per goal. They are columns rather
than derived counts because they gate the hot path.

### Runs

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_runs (
  id               TEXT    PRIMARY KEY,
  task_id          TEXT    NOT NULL,
  attempt          INTEGER NOT NULL,
  status           TEXT    NOT NULL,   -- queued|running|succeeded|failed|cancelled
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
```

A run spans many work units, many goals, and any number of pauses for a person.
It has no `waiting` status — a blocked task keeps its run `running` with nothing
dispatched, and answering resumes that same run.

**Steering does not end a run.** It abandons the in-flight work unit and
supersedes the queued ones; the attempt continues.

### Work units

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_work_units (
  id                   TEXT    PRIMARY KEY,
  run_id               TEXT    NOT NULL,
  task_id              TEXT    NOT NULL,
  unit_seq             INTEGER NOT NULL,
  kind                 TEXT    NOT NULL,  -- decompose|sequence|act|verify|settle
  -- Why this unit exists: audit legibility without a sixth kind.
  trigger              TEXT    NOT NULL,  -- planned|steering|refusal|verification|recovery
  state                TEXT    NOT NULL,  -- queued|started|succeeded|failed|superseded|dispatched|rejected
  goal_id              TEXT,
  consumed_through_seq INTEGER NOT NULL,
  -- Why the agent did this, in its words. Retained even when superseded: it is
  -- fed back into the unit that replaces it, and it is the antecedent a
  -- steering message refers to.
  rationale            TEXT,
  safe_summary         TEXT,
  -- Which versioned prompt produced this unit's model call, so a behavioural
  -- change after a prompt edit is attributable rather than mysterious.
  prompt_version       TEXT,
  -- Non-mutating tool calls made inside this unit's model loop.
  read_count           INTEGER NOT NULL DEFAULT 0,
  usage_total          INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT    NOT NULL,
  settled_at           TEXT,
  UNIQUE (run_id, unit_seq),
  -- Only act units are ever queued, dispatched, or rejected.
  CHECK (kind = 'act' OR state NOT IN ('queued', 'dispatched', 'rejected'))
);

CREATE INDEX IF NOT EXISTS ag_${prefix}_units_run
  ON ag_${prefix}_work_units(run_id, unit_seq);
CREATE INDEX IF NOT EXISTS ag_${prefix}_units_goal
  ON ag_${prefix}_work_units(goal_id, unit_seq);
CREATE INDEX IF NOT EXISTS ag_${prefix}_units_unfinished
  ON ag_${prefix}_work_units(state, created_at)
  WHERE state IN ('queued', 'started', 'dispatched');
```

`UNIQUE (run_id, unit_seq)` makes a duplicate claim a no-op: a retried dispatch
attempts the insert, hits the constraint, reads the existing row, and returns its
recorded outcome.

**`queued` act units are the pending plan.** A sequence unit writes its ordered
mutations as `act` rows in state `queued`, all in its own settle transaction. The
plan is therefore rows rather than memory, which is what lets a person see what
the agent is *about* to do, lets steering rewrite it, and lets a restart resume
mid-sequence without re-planning.

`ag_${prefix}_units_unfinished` is the recovery working set. A `started`
planning unit is failed and re-derived; `queued` act units are simply dispatched
in order; a `dispatched` act unit is the case that needs care, below.

### Tool calls

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_tool_calls (
  id               TEXT    PRIMARY KEY,
  task_id          TEXT    NOT NULL,
  run_id           TEXT    NOT NULL,
  unit_id          TEXT    NOT NULL,
  endpoint_key     TEXT    NOT NULL,          -- "POST /documents/command"
  resource_kind    TEXT,
  resource_id      TEXT,
  mutating         INTEGER NOT NULL,          -- 0|1
  request_json     TEXT    NOT NULL,
  -- `agent:<id>`. Committed before dispatch and never rewritten. The target's
  -- own receipt is keyed on it, which is what makes recovery a replay of a
  -- known request rather than a guess about an unknown outcome.
  request_id       TEXT    NOT NULL UNIQUE,
  request_digest   TEXT    NOT NULL,
  result_json      TEXT,
  rejection_reason TEXT,
  created_at       TEXT    NOT NULL,
  settled_at       TEXT
);

-- One mutating call per unit, enforced at the schema level. Reads are
-- unconstrained: a planning unit makes as many as its bounds allow.
CREATE UNIQUE INDEX IF NOT EXISTS ag_${prefix}_calls_one_mutation
  ON ag_${prefix}_tool_calls(unit_id)
  WHERE mutating = 1;

CREATE INDEX IF NOT EXISTS ag_${prefix}_calls_unit
  ON ag_${prefix}_tool_calls(unit_id, created_at);
CREATE INDEX IF NOT EXISTS ag_${prefix}_calls_task
  ON ag_${prefix}_tool_calls(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ag_${prefix}_calls_resource
  ON ag_${prefix}_tool_calls(resource_kind, resource_id, created_at DESC);
```

**This table holds reads and mutations both.** An `act` unit holds exactly one
mutating call; a `decompose`, `sequence`, or `verify` unit holds any number of
reads made inside its model loop. The partial unique index expresses precisely
that: unbounded reads, one mutation.

That, plus the invariant that at most one act unit per run is `dispatched`, is
what makes the crash story finite: there is never more than one call whose
outcome is unknown.

Recording reads costs one row each and buys the audit answer to *"what did it
look at before it decided that?"* — which, for a capability whose whole
justification is being knowable after the fact, is worth the rows.

`request_json` retains the exact arguments as dispatched, which is what makes
the record an audit trail rather than a summary of one. `request_id` retains the
identity the *target* knows the call by, which is what makes an unsettled call
resolvable: recovery re-sends `request_json` under the same `request_id` and the
target's receipt either replays or executes. Both columns are needed and neither
substitutes for the other.

`resource_kind` / `resource_id` are extracted at policy-evaluation time via the
descriptor's `resourceIdPath` and stored, so "what has this agent touched" is an
index scan rather than a JSON walk over every body.

### Questions and approvals

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_questions (
  id                TEXT    PRIMARY KEY,
  task_id           TEXT    NOT NULL,
  goal_id           TEXT,
  message_id        TEXT    NOT NULL UNIQUE,
  state             TEXT    NOT NULL,   -- open|answered|withdrawn
  required          INTEGER NOT NULL,   -- 0|1
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
```

`answer_message_id UNIQUE` enforces "one canonical answer" at the schema level
rather than in service code: a second answer cannot be written even by a bug.

`request_digest` is stored on the approval, not just looked up from the call.
The grant is a statement about a digest, so it holds the digest it granted; a
call re-proposed with different arguments produces a different digest and finds
no matching grant.

### Run transcript

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_transcript (
  run_id       TEXT    NOT NULL,
  msg_seq      INTEGER NOT NULL,
  role         TEXT    NOT NULL,   -- assistant|tool|user|system
  content_json TEXT    NOT NULL,
  created_at   TEXT    NOT NULL,
  PRIMARY KEY (run_id, msg_seq)
);
```

Model-facing state, never exposed by the read API. It exists so a run spanning
several jobs can rebuild its conversation, and it holds no hidden reasoning or
provider trace — those never leave the Intelligence port.

Pruned in the owning task's settlement transaction, except for tasks that
settled `failed`, whose transcripts are retained so the failure can be
diagnosed. Those are the one thing Agents hands to the shared retention sweep.

### Settlement outbox

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_settlement_outbox (
  id            TEXT    PRIMARY KEY,
  task_id       TEXT    NOT NULL,
  unit_id       TEXT,                    -- set for per-mutation rows
  destination   TEXT    NOT NULL,        -- activity|automation
  kind          TEXT    NOT NULL,        -- agent.task.created | agent.mutation.committed
                                         -- agent.mutation.refused | agent.task.settled
  -- Stable across retries; Activity derives act_<sha256(...)> from it.
  source_transaction_id TEXT NOT NULL UNIQUE,
  automation_id TEXT,                    -- set iff destination = 'automation'
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
with a null `published_at`. The partial index on unpublished rows follows
Document's `transaction_outbox` pattern exactly.

**Everything the agent does reaches Activity.** Four kinds are staged: task
creation, every committed mutation, every refused mutation, and settlement.
Reads, decompose, sequence, and verify units are not — they are in the exchange, which is
where a person follows a live task; a project feed carrying a line per retrieval
would be unusable. The rule: *Activity carries what changed the project or was
refused permission to; the exchange carries how the agent got there.*

Note the deliberate overlap with the target's own publication. When an agent
edits a document, Document publishes its transaction with `origin: "agent"` *and*
Agents publishes `agent.mutation.committed`. Those are different facts — "the
document changed" and "an agent was allowed to change it" — and neither is
derivable from the other. A refused mutation exists only in the second.

`source_transaction_id` is allocated with each staged row and passed to Activity
as its `idempotencyKey`, so an equal retry addresses the same ledger row while
changed content under the same key raises `ActivityTransactionConflictError`.
Outbox rows survive after publication so a duplicate can be recognised rather
than re-sent.

## Transaction boundaries

Every boundary below is exactly one SQLite transaction. Nothing dispatches from
inside one.

| Boundary | Writes |
| --- | --- |
| **create** | task (scope columns NULL), objective message, run 1, receipt, outbox `agent.task.created` |
| **scope pin** | task scope columns (CAS revision); idempotent — a second attempt finds them set and skips |
| **control command** | task (CAS revision), message, and one of: question close / approval decision / cancel result |
| **unit claim** | work unit row `started` |
| **decompose settle** | unit terminal, child goal rows, goal `decompose_attempts`, `plan` + `progress` messages |
| **sequence settle** | unit terminal, goal `observed_state` + `sequence_attempts`, the ordered `act` rows in state `queued`, `plan` + `progress` messages |
| **act dispatch** | unit row `dispatched`, tool call row with `request_id` + `request_digest` |
| **act settle** | tool call terminal, unit terminal, progress message, task `mutation_count`, outbox `agent.mutation.committed` |
| **act reject** | unit `rejected`, message, outbox `agent.mutation.refused` |
| **verify settle** | unit terminal, goal `observed_state` + `verify_attempts`, goal terminal on `met`, message |
| **read record** | tool call rows (`mutating = 0`), written with the owning unit's settle |
| **steer supersede** | queued `act` units → `superseded`, one `system` message naming what was dropped |
| **run settle** | run row terminal, task state, attention |
| **task settle** | task terminal + result, result message, close open goals, withdraw questions, withdraw approvals, run settle, transcript prune (unless `failed`), outbox rows per destination |

The compare-and-swap rule: every write that changes `state`, `attention`, or
`revision` on a task is guarded by `WHERE id = ? AND revision = ?`. A losing
writer changes zero rows and its caller treats that as `discarded` rather than
retrying blindly — the same compare-and-publish shape Derived Outputs uses.

## Retention

Agents is a **ledger**, not a revisioned resource, and it deliberately does not
adopt the current/history contract that Document, Persona, Comments, Templates,
Investigation, Derived Outputs, Connector, General Files, Structured Data, and
Context all follow. There is no history table, no `task.delete`, no
`task.purge`.

The precedent is Activity, which is append-only and explicitly excluded from
revision-history retention and purge, along with transaction outboxes, command
receipts, and claims. A task is the same kind of artefact: a record of something
that happened, and the **only** Agents-side evidence of calls that were
proposed, refused, or denied. Deleting it destroys the audit trail that
justifies letting an agent act at all.

| Data | Policy |
| --- | --- |
| Tasks, exchange, goals, questions, approvals, tool calls | Kept indefinitely — the audit record |
| Work units | Kept — small, and how a run is explained |
| Transcripts, settled task | Pruned in the settlement transaction |
| Transcripts, `failed` task | Kept for diagnosis, then swept — see below |
| Outbox rows | Kept after publication, so a duplicate is recognised not re-sent |

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
find it, rather than being invisible. And the decision to keep tasks forever
becomes visible as a `purgeExpired` that deliberately returns zero, instead of
an absence someone later reads as an oversight.
