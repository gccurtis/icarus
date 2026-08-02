# Research — store

Project-scoped SQLite, one database file. House pattern:
`CREATE TABLE IF NOT EXISTS`, prefix `SHA-256(projectId).slice(0, 16)`, no
`STRICT`, partial indexes for liveness, hand-written SQL.

Research stores **no execution state**. There are no attempt rows, step rows,
stage receipts, tool call records, or run transcripts here — those live in the
Agents store, reachable through `agent_task_id`. What remains is the
conversation, the frozen framing, the typed result, and the review queue.

Seven tables.

## Threads and messages

```sql
CREATE TABLE IF NOT EXISTS rsh_${prefix}_threads (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  head_seq       INTEGER NOT NULL DEFAULT 0,
  latest_run_id  TEXT,
  created_by     TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  deleted_at     TEXT
);

CREATE INDEX IF NOT EXISTS rsh_${prefix}_threads_recent
  ON rsh_${prefix}_threads(updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS rsh_${prefix}_messages (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL,
  seq        INTEGER NOT NULL,
  role       TEXT NOT NULL,            -- user | assistant
  text       TEXT NOT NULL,
  run_id     TEXT,                     -- set on assistant messages
  created_at TEXT NOT NULL,
  UNIQUE (thread_id, seq)
);

CREATE INDEX IF NOT EXISTS rsh_${prefix}_messages_thread
  ON rsh_${prefix}_messages(thread_id, seq);
```

`UNIQUE (thread_id, seq)` is the contiguity guard. Allocation is
`head_seq + 1` read and written in the same transaction as the insert, under
the serial command lane, so the sequence needs no separate lock.

There is no update or delete path for messages in the store interface at all.
"Edit a message" is not a bug that can be written here.

## Runs

```sql
CREATE TABLE IF NOT EXISTS rsh_${prefix}_runs (
  id                     TEXT PRIMARY KEY,
  thread_id              TEXT NOT NULL,
  user_message_id        TEXT NOT NULL,
  agent_task_id          TEXT,          -- NULL between commit and task creation
  mode                   TEXT NOT NULL, -- discovery | question | hypothesis
  state                  TEXT NOT NULL, -- running|waiting|settled|incomplete|failed|cancelled
  subject_json           TEXT NOT NULL, -- frozen; includes canonical digest
  canonical_kind         TEXT,          -- question | hypothesis | NULL
  canonical_id           TEXT,
  channels_json          TEXT NOT NULL, -- frozen
  knowledge_generation   INTEGER NOT NULL,  -- at freeze
  settled_generation     INTEGER,           -- at settlement; differs = ran against older material
  continuation_of_run_id TEXT,
  retry_of_run_id        TEXT,
  assistant_message_id   TEXT,
  failure_code           TEXT,
  client_request_id      TEXT,
  created_at             TEXT NOT NULL,
  settled_at             TEXT
);

CREATE INDEX IF NOT EXISTS rsh_${prefix}_runs_thread
  ON rsh_${prefix}_runs(thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rsh_${prefix}_runs_live
  ON rsh_${prefix}_runs(state, created_at)
  WHERE state IN ('running', 'waiting');

CREATE UNIQUE INDEX IF NOT EXISTS rsh_${prefix}_runs_idempotency
  ON rsh_${prefix}_runs(client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS rsh_${prefix}_runs_canonical
  ON rsh_${prefix}_runs(canonical_kind, canonical_id, created_at DESC)
  WHERE canonical_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS rsh_${prefix}_runs_orphan
  ON rsh_${prefix}_runs(created_at)
  WHERE agent_task_id IS NULL AND state = 'running';
```

`agent_task_id` is nullable for exactly one window: between the run's commit
and the agent task's creation. `rsh_${prefix}_runs_orphan` is the index that
finds runs stranded in that window after a crash, and it is the reason the task
is created *after* the transaction rather than before — a run with no task is
recoverable, a task with no run is invisible work.

`rsh_${prefix}_runs_canonical` answers "what has been investigated about this
Question", which is the join a Question detail view wants and which
`questions-design.md` deliberately does not store as a reverse link.

## Results and grounding

```sql
CREATE TABLE IF NOT EXISTS rsh_${prefix}_results (
  run_id             TEXT PRIMARY KEY,
  narrative          TEXT NOT NULL,
  payload_json       TEXT NOT NULL,   -- mode-specific, validated at settlement
  limitations_json   TEXT NOT NULL DEFAULT '[]',
  contradictions_json TEXT NOT NULL DEFAULT '[]',
  gaps_json          TEXT NOT NULL DEFAULT '[]',
  method_json        TEXT NOT NULL DEFAULT '[]',
  reliability_json   TEXT NOT NULL,
  unmet_criteria_json TEXT NOT NULL DEFAULT '[]',
  created_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rsh_${prefix}_grounding (
  id           TEXT PRIMARY KEY,
  run_id       TEXT NOT NULL,
  kind         TEXT NOT NULL,   -- knowledge|resource|web|data|computation|analytic
  ref_json     TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS rsh_${prefix}_grounding_run
  ON rsh_${prefix}_grounding(run_id, kind);
```

Grounding gets its own table rather than living inside `payload_json` because
it is queried on its own — "what did this run actually cite", "which runs cite
this source" — and because settlement validates each reference individually
before storing it.

## Web results and computations

```sql
CREATE TABLE IF NOT EXISTS rsh_${prefix}_web_results (
  id              TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL,
  provider        TEXT NOT NULL,
  query           TEXT,
  requested_url   TEXT NOT NULL,
  final_url       TEXT NOT NULL,
  title           TEXT,
  content_digest  TEXT NOT NULL,
  excerpts_json   TEXT NOT NULL DEFAULT '[]',
  body_retained   INTEGER NOT NULL DEFAULT 0,
  body_text       TEXT,
  diagnostics_json TEXT NOT NULL DEFAULT '[]',
  general_file_id TEXT,             -- set by an explicit web.save
  retrieved_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS rsh_${prefix}_web_run
  ON rsh_${prefix}_web_results(run_id, retrieved_at);

CREATE TABLE IF NOT EXISTS rsh_${prefix}_computations (
  id             TEXT PRIMARY KEY,
  run_id         TEXT NOT NULL,
  spec_json      TEXT NOT NULL,   -- exact code / specification
  inputs_json    TEXT NOT NULL,   -- entry ids, revisions, selectors, payload
  runtime_id     TEXT NOT NULL,   -- deterministic environment identity
  limits_json    TEXT NOT NULL,
  output_json    TEXT,
  diagnostics_json TEXT NOT NULL DEFAULT '[]',
  input_digest   TEXT NOT NULL,
  code_digest    TEXT NOT NULL,
  output_digest  TEXT,
  status         TEXT NOT NULL,   -- ok | failed | timeout | limit
  created_at     TEXT NOT NULL,
  settled_at     TEXT
);

CREATE INDEX IF NOT EXISTS rsh_${prefix}_comp_run
  ON rsh_${prefix}_computations(run_id, created_at);
```

`body_retained` and the nullable `body_text` exist so retention policy is a
data question, not a schema migration. Excerpts, digests, and metadata are
always kept — they are what a citation resolves against; full bodies are
optional and bounded. This is open decision R-D5.

A computation row is written **before** the sandbox runs and updated after, so
an interrupted computation is visible with its exact inputs and no output —
same discipline as the Agents tool step.

## Finding candidates

```sql
CREATE TABLE IF NOT EXISTS rsh_${prefix}_candidates (
  id                     TEXT PRIMARY KEY,
  run_id                 TEXT NOT NULL,
  claim                  TEXT NOT NULL,
  grounding_ids_json     TEXT NOT NULL,
  commentary             TEXT,
  suggested_question_ids_json   TEXT NOT NULL DEFAULT '[]',
  suggested_hypothesis_ids_json TEXT NOT NULL DEFAULT '[]',
  suggested_tags_json    TEXT NOT NULL DEFAULT '[]',
  recommendation         TEXT NOT NULL,   -- recommended | needs_review
  review_state           TEXT NOT NULL,
  reviewed_by            TEXT,
  proposal_client_id     TEXT,
  proposed_finding_id    TEXT,
  proposal_pending       INTEGER NOT NULL DEFAULT 0,
  created_at             TEXT NOT NULL,
  reviewed_at            TEXT
);

CREATE INDEX IF NOT EXISTS rsh_${prefix}_candidates_queue
  ON rsh_${prefix}_candidates(review_state, created_at)
  WHERE review_state IN ('unreviewed', 'blocked_grounding');

CREATE INDEX IF NOT EXISTS rsh_${prefix}_candidates_run
  ON rsh_${prefix}_candidates(run_id, created_at);

CREATE INDEX IF NOT EXISTS rsh_${prefix}_candidates_pending
  ON rsh_${prefix}_candidates(created_at)
  WHERE proposal_pending = 1;
```

`rsh_${prefix}_candidates_queue` backs the project-wide review queue.
`rsh_${prefix}_candidates_pending` is the crash-recovery index for the one
cross-store write in the capability: a candidate left `proposal_pending = 1`
had its Finding id minted and may or may not have reached the Findings store.

Recovery re-calls `findings.propose` with the **same pre-generated id**. With
the keyed contract from amendment R3 that is idempotent — the second call either
finds the Finding present or creates it. Without it, this index is only good for
reporting the ambiguity to a person.

## Transactions

| Boundary | Writes |
| --- | --- |
| **thread.create / run.start** | thread (insert or update head), user message, run, idempotency |
| **task linked** | run `agent_task_id` |
| **settlement** | result, grounding rows, candidates, assistant message, run state, thread head |
| **candidate.review** | candidate review state and actor |
| **candidate.propose** | pending flag + minted id, then the recorded finding id |
| **web.save** | web result `general_file_id` |
| **cancel / retry** | run state; retry inserts a new run |

Settlement is one transaction. Grounding validation, mode-criteria checking, and
candidate extraction all happen **before** it opens — they are pure functions
over the validated payload and the run's own records, and holding a write
transaction across them would block every other thread's writer.

## Retention

- **Threads, messages, runs, results, grounding, candidates: kept.** They are
  the investigation record.
- **Web bodies: bounded**, per R-D5. Metadata and excerpts always kept.
- **Computation specs, inputs, and digests: kept.** Outputs bounded by size.
- **Execution detail: not here.** Agents owns its own retention, including
  pruning run transcripts on settlement.

Deleting a thread is a soft delete. Its runs' agent tasks are not deleted —
`agents-design.md` has no task-delete command by design, because a task is the
record of what an agent was permitted to do.
