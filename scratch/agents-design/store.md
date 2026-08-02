# Agents — store

SQLite persistence. One database file owned by this capability, following the
house pattern: `CREATE TABLE IF NOT EXISTS`, a table prefix derived from
`SHA-256(projectId).slice(0, 16)`, no `STRICT`, and partial indexes for
liveness. There is no shared `Database` abstraction and no ORM; hand-written SQL
through `better-sqlite3`.

The store is synchronous, matching `DataStore`, `ContextStore`, and
`DerivedOutputStore`. The capability interface above it is `Promise`-returning.

## Tables

### Tasks

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_tasks (
  id                TEXT    PRIMARY KEY,
  revision          INTEGER NOT NULL DEFAULT 1,
  state             TEXT    NOT NULL,          -- queued|running|waiting|completed|partial|failed|cancelled
  attention         TEXT,                      -- question|approval; NULL unless waiting
  objective         TEXT    NOT NULL,
  origin_kind       TEXT    NOT NULL,          -- operator|automation
  origin_id         TEXT,                      -- automation id; NULL for operator
  actor_id          TEXT    NOT NULL,
  persona_json      TEXT    NOT NULL,          -- full frozen PersonaSnapshot
  persona_id        TEXT    NOT NULL,          -- denormalised for filtering
  persona_digest    TEXT    NOT NULL,
  scope_json        TEXT    NOT NULL,          -- full frozen KnowledgeScopeManifest
  scope_digest      TEXT    NOT NULL,
  policy_json       TEXT    NOT NULL,
  limits_json       TEXT    NOT NULL,
  head_seq          INTEGER NOT NULL DEFAULT 0,
  mutation_count    INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  result_json       TEXT,                      -- present iff terminal
  created_at        TEXT    NOT NULL,
  updated_at        TEXT    NOT NULL,
  settled_at        TEXT
);

CREATE INDEX IF NOT EXISTS ag_${prefix}_tasks_state
  ON ag_${prefix}_tasks(state, updated_at DESC);
CREATE INDEX IF NOT EXISTS ag_${prefix}_tasks_attention
  ON ag_${prefix}_tasks(attention, updated_at DESC)
  WHERE attention IS NOT NULL;
CREATE INDEX IF NOT EXISTS ag_${prefix}_tasks_origin
  ON ag_${prefix}_tasks(origin_kind, origin_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS ag_${prefix}_tasks_persona
  ON ag_${prefix}_tasks(persona_id, updated_at DESC);
```

`persona_json` and `scope_json` hold the complete frozen values, not references.
This is the point of the freeze: a task must be readable and replayable when the
persona has been edited and the context deleted. `persona_id` and
`persona_digest` are denormalised alongside so "which tasks used this persona"
is an index scan rather than a JSON walk.

`mutation_count` and `total_tokens` are counters maintained by settlement rather
than derived on read, because both are enforced as budgets on the hot path and
a `COUNT(*)` per step would not be.

### Creation receipts

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_task_receipts (
  client_request_id TEXT    PRIMARY KEY,
  request_digest    TEXT    NOT NULL,
  task_id           TEXT    NOT NULL UNIQUE,
  response_json     TEXT    NOT NULL,
  created_at        TEXT    NOT NULL
);
```

Replay of `task.create` with the same `clientRequestId` returns
`response_json`. A replay carrying a *different* `request_digest` is
`idempotency_mismatch` — the same rule Document applies.

### Exchange

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_messages (
  id           TEXT    PRIMARY KEY,
  task_id      TEXT    NOT NULL,
  run_id       TEXT,                            -- NULL for operator messages between runs
  seq          INTEGER NOT NULL,
  kind         TEXT    NOT NULL,
  author_kind  TEXT    NOT NULL,
  author_id    TEXT,
  content_json TEXT    NOT NULL,
  created_at   TEXT    NOT NULL,
  UNIQUE (task_id, seq)
);

CREATE INDEX IF NOT EXISTS ag_${prefix}_messages_task_seq
  ON ag_${prefix}_messages(task_id, seq);
```

`UNIQUE (task_id, seq)` is the contiguity guard. Sequence allocation is
`head_seq + 1` read and written inside the same transaction as the insert, under
the serial command lane — which is why the exchange never needs its own lock.

Messages are append-only. There is no update or delete path in the store
interface at all, so "edit a message" is not a bug that can be written.

### Questions and approvals

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_questions (
  id                TEXT    PRIMARY KEY,
  task_id           TEXT    NOT NULL,
  message_id        TEXT    NOT NULL UNIQUE,
  state             TEXT    NOT NULL,           -- open|answered|withdrawn
  required          INTEGER NOT NULL,           -- 0|1
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
  state               TEXT    NOT NULL,          -- pending|granted|denied|withdrawn
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

### Runs and steps

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_runs (
  id                   TEXT    PRIMARY KEY,
  task_id              TEXT    NOT NULL,
  attempt              INTEGER NOT NULL,
  status               TEXT    NOT NULL,        -- queued|running|succeeded|failed|cancelled
  consumed_through_seq INTEGER NOT NULL,
  result_json          TEXT,
  failure_code         TEXT,
  usage_prompt         INTEGER NOT NULL DEFAULT 0,
  usage_completion     INTEGER NOT NULL DEFAULT 0,
  usage_total          INTEGER NOT NULL DEFAULT 0,
  usage_reasoning      INTEGER NOT NULL DEFAULT 0,
  cost_usd             REAL,
  created_at           TEXT    NOT NULL,
  started_at           TEXT,
  settled_at           TEXT,
  updated_at           TEXT    NOT NULL,
  UNIQUE (task_id, attempt)
);

CREATE INDEX IF NOT EXISTS ag_${prefix}_runs_task
  ON ag_${prefix}_runs(task_id, attempt DESC);
CREATE INDEX IF NOT EXISTS ag_${prefix}_runs_live
  ON ag_${prefix}_runs(status, updated_at)
  WHERE status IN ('queued', 'running');

CREATE TABLE IF NOT EXISTS ag_${prefix}_steps (
  id            TEXT    PRIMARY KEY,
  run_id        TEXT    NOT NULL,
  step_seq      INTEGER NOT NULL,
  kind          TEXT    NOT NULL,               -- reason|retrieve|tool|settle
  state         TEXT    NOT NULL,               -- started|succeeded|failed|cancelled
  safe_summary  TEXT,
  input_digest  TEXT,
  output_digest TEXT,
  usage_total   INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL,
  settled_at    TEXT,
  UNIQUE (run_id, step_seq)
);

CREATE INDEX IF NOT EXISTS ag_${prefix}_steps_run
  ON ag_${prefix}_steps(run_id, step_seq);
CREATE INDEX IF NOT EXISTS ag_${prefix}_steps_started
  ON ag_${prefix}_steps(state, created_at)
  WHERE state = 'started';
```

`ag_${prefix}_runs_live` and `ag_${prefix}_steps_started` are the recovery
sweep's working set. Both are partial indexes over the states that mean
"unfinished", so the sweep is proportional to what is actually stuck rather than
to history.

**`UNIQUE (run_id, step_seq)` is the idempotency mechanism for the whole
execution path.** A duplicate continuation attempts the claim insert, hits the
constraint, reads the existing row, and returns its recorded outcome.

### Tool calls

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_tool_calls (
  id               TEXT    PRIMARY KEY,
  task_id          TEXT    NOT NULL,
  run_id           TEXT    NOT NULL,
  step_id          TEXT,
  call_seq         INTEGER NOT NULL,
  target_kind      TEXT    NOT NULL,
  target_id        TEXT,
  command_name     TEXT    NOT NULL,
  mutating         INTEGER NOT NULL,            -- 0|1
  request_json     TEXT    NOT NULL,
  request_digest   TEXT    NOT NULL,
  state            TEXT    NOT NULL,            -- proposed|awaitingApproval|rejected|dispatched|succeeded|failed
  result_json      TEXT,
  rejection_reason TEXT,
  safe_summary     TEXT,
  created_at       TEXT    NOT NULL,
  settled_at       TEXT,
  UNIQUE (run_id, call_seq)
);

CREATE INDEX IF NOT EXISTS ag_${prefix}_tool_calls_task
  ON ag_${prefix}_tool_calls(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ag_${prefix}_tool_calls_target
  ON ag_${prefix}_tool_calls(target_kind, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ag_${prefix}_tool_calls_unsettled
  ON ag_${prefix}_tool_calls(state, created_at)
  WHERE state = 'dispatched';
```

`ag_${prefix}_tool_calls_unsettled` is the index that finds the unknown-outcome
case at recovery: dispatched, never settled. It is the single most important
index in this schema, because it is the one standing between "we know what
happened" and "we do not".

`request_json` retains the exact arguments as dispatched, which is what makes
the record an audit trail rather than a summary of one.

### Run transcript

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_transcript (
  run_id       TEXT    NOT NULL,
  msg_seq      INTEGER NOT NULL,
  role         TEXT    NOT NULL,               -- assistant|tool|user|system
  content_json TEXT    NOT NULL,
  created_at   TEXT    NOT NULL,
  PRIMARY KEY (run_id, msg_seq)
);
```

Model-facing state, never exposed by the read API. It exists so a run spanning
several jobs can rebuild its conversation, and it holds no hidden reasoning or
provider trace — those never leave the Intelligence port.

Pruned when the owning task settles, except for tasks that settled `failed`,
whose transcripts are retained so the failure can be diagnosed.

### Settlement outbox

```sql
CREATE TABLE IF NOT EXISTS ag_${prefix}_settlement_outbox (
  id           TEXT    PRIMARY KEY,
  task_id      TEXT    NOT NULL UNIQUE,
  automation_id TEXT   NOT NULL,
  payload_json TEXT    NOT NULL,
  published    INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL,
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS ag_${prefix}_outbox_pending
  ON ag_${prefix}_settlement_outbox(created_at)
  WHERE published = 0;
```

Written inside the settlement transaction for automation-origin tasks and
published after commit, so Automation is notified exactly once even across a
crash. `task_id UNIQUE` makes a duplicate row impossible; the recovery sweep
republishes anything still `published = 0`.

This is the same outbox shape Activity requires of its publishers, and it is
here for the same reason: Automation may have a separate database, so the
notification has to be durable on this side of the boundary.

## Transaction boundaries

Every boundary below is exactly one SQLite transaction. Nothing dispatches from
inside one.

| Boundary | Writes |
| --- | --- |
| **create** | task, objective message, run 1, receipt |
| **control command** | task (CAS revision), message, and one of: question close / approval decision / cancel result; plus run insert when unblocking |
| **step claim** | step row `started` |
| **step settle** | step row terminal, messages, task counters |
| **tool dispatch** | tool call row `dispatched` |
| **tool settle** | tool call row terminal, step settle, progress message, task `mutation_count` |
| **run settle** | run row terminal, task state, attention |
| **task settle** | task terminal + result, result message, withdraw questions, withdraw approvals, run settle, outbox row |

The compare-and-swap rule: every write that changes `state`, `attention`, or
`revision` on a task is guarded by `WHERE id = ? AND revision = ?`. A losing
writer changes zero rows and its caller treats that as `discarded` rather than
retrying blindly — the same compare-and-publish shape Derived Outputs uses for
refresh settlement.

## Retention

- **Tasks, exchange, tool calls: kept indefinitely.** They are the audit
  record. Nothing in this design deletes them.
- **Steps: kept.** They are small and they are how a run is explained.
- **Transcripts: pruned** on task settlement, except for failed tasks.
- **Outbox rows: kept after publication**, so a duplicate settlement intent can
  be recognised rather than re-sent.

There is deliberately no task-delete command. A task is a record of something
that happened, and deleting it would remove the only Agents-side evidence of
calls that were proposed, refused, or denied.
