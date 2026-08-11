# sqlite_migrate.go

The whole schema, and the only thing that creates it. `migrate` runs once from
`Open` and brings any database — brand new, or one written by an older build —
up to the current shape.

There is no migration framework here and no version table. The schema is
declared as an ordered slice of `CREATE TABLE IF NOT EXISTS` /
`CREATE INDEX IF NOT EXISTS` statements, followed by a list of `ALTER TABLE ...
ADD COLUMN` statements whose "duplicate column name" errors are swallowed. Every
statement is therefore idempotent, and changes are almost always *additive*: new
tables, new indexes, new columns with defaults. That is what lets the same code
run unconditionally on every open — a fresh database gets everything, an existing
one gets only what it is missing, and neither needs to know which version it was.
The model holds because no table or column is ever renamed or dropped in place.
Retiring an *index* is the one routine subtraction, and it takes the same form as
everything else here: a `DROP INDEX IF EXISTS` line left in the slice, replayed
harmlessly forever. The two larger exceptions below are deliberate, guarded
resets rather than migrations. The
file also carries some *data* repair: backfills that give old rows values for
columns that did not exist when they were written.

## Code breakdown

### The statement slice: tables and indexes by capability

`migrate` opens with one slice holding the entire schema, in dependency order
(referenced tables before their referrers). Rather than list all of it, the
groups are:

- **Access** — `users`, `sessions`, `projects`, `memberships`, `project_links`
  (plus a unique index on the invite token).
- **Documents** — `documents`, `change_sets`, `document_submissions`,
  `document_history`, `document_anchors`.
- **Activity** — `activity_events`, whose `UNIQUE (source_kind, source_id)`
  constraint makes event recording idempotent, indexed on
  `(project_id, occurred_at DESC, id DESC)` to match the feed's sort.
- **Jobs** — `jobs`, indexed on `(status, run_at)` for the claim query.
- **Knowledge** — `knowledge_sources`, `knowledge_windows`, `knowledge_nodes`,
  `knowledge_memberships`, `knowledge_corpus_state`, and the persisted corpus
  k-NN index: `knowledge_corpus_index` (one row per level — pinned threshold,
  k, basis and centroid matrices as float32 BLOBs) and
  `knowledge_corpus_edges` (one row per artifact per level — its IVF cell and
  packed edges), with a `(project_id, level, cell)` index for cell-scoped
  reads. Both are derived state, so there is no backfill: absence simply means
  the next rebuild builds in full.
- **Collaboration and agents** — `project_sessions`, `personas`,
  `persona_versions`, `persona_defaults`, `agent_tasks`, `agent_chats`,
  `agent_chat_turns`, `agent_chat_attachments`.
- **Catalog and content** — `resource_references`, `document_comments`,
  `comment_replies`, `files`, `resource_attributes`, `formula_names`,
  `connectors`, `contexts`.
- **Organizations and workspaces** — `organizations`, `org_memberships`,
  `workspaces`.

Roughly 35 tables in all, each with the indexes its capability's queries need.

Two entries are worth calling out. `idx_documents_project` on
`documents(project_id)` is what keeps per-project document listing from scanning
the whole table. And the change-set sequence is protected by a unique index:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_change_sets_doc_revision ON change_sets(document_id, seq)
```

That constraint is the enforcement behind the append compare-and-swap: a writer
computes the next `seq` and inserts at it, and if a concurrent writer already
took that slot the insert fails on the unique index rather than silently
producing two change sets at the same revision. (The `_txlock=immediate` setting
in `sqlite.go` is what normally prevents the race; this index is what makes it
impossible rather than merely unlikely.)

It is immediately followed by `DROP INDEX IF EXISTS idx_change_sets_doc_seq`.
That index covered exactly the same two columns in the same order, non-uniquely
and non-partially, so the unique index above already serves every read it did —
it was pure write and storage overhead. Because the slice is declarative and
replayed on every `Open`, a drop statement is how this file *removes* something:
new databases never create it, and existing ones shed it the next time they are
opened. It is the one non-additive statement in the slice, and it is safe
precisely because the surviving index is a strict superset.

### The knowledge-lattice drop: rebuildable state is not migrated

Before executing the slice, `migrate` probes `pragma_table_info('knowledge_nodes')`
for a `root` column — the marker of the pre-KLR shape — and drops the table
outright if it finds one. The lattice is a *projection*: sources and their
embedded windows are the durable data and the node hierarchy is derived from
them, so letting the next add rebuild it is cheaper and safer than a structural
migration. The `CREATE TABLE IF NOT EXISTS` in the slice then recreates it in the
current shape. A plain loop then executes the slice, returning on first error.

The same reasoning is why `knowledge_corpus_state` needs no migration of its own:
a project with no row reads as `(0, 0)` — trivially current — and the first write
inserts one. An existing database simply has no corpus tier until its next write
marks it dirty and a rebuild runs, which is the state the schema already treats
as valid.

### `backfillVectorBlobs`: the one lattice state that is migrated, not dropped

`embedding_v2` and `centroid_v2` are added by the ALTER block, and this backfill
converts rows written before they existed.

It is the exception to the rule one section above. Node centroids and the whole
node hierarchy are *derived*, so a shape change drops them and lets the next add
recompute. Embeddings are not derived — they cost real provider tokens — so they
are converted in place instead.

The backfill is **resumable rather than transactional**: each row is converted on
its own, so a run that dies partway leaves the rows it finished converted and the
rest legible through their JSON. `decodeStoredVector` prefers the BLOB and falls
back to the JSON, so a half-migrated database reads correctly either way and the
next startup finishes the job. Running it on every startup is therefore safe and
idempotent — it selects only rows whose BLOB is still NULL.

A row whose legacy JSON will not parse is skipped rather than fatal. It is
already unusable, and failing startup over it would let one corrupt vector take
down the whole server.

### `knowledge_corpus_state`: a sequence pair, not a boolean

Holds `(dirty_seq, built_seq)` per project. Every write that invalidates the
corpus tier bumps `dirty_seq`; a completed rebuild records what it covered in
`built_seq`. Equal means current.

It is a pair rather than a flag because the rebuild deliberately clusters
*outside* a transaction — that is the whole point of moving it off the write
path. A write landing mid-computation bumps `dirty_seq` past the value the
rebuild is about to claim, so the result is stored and the project still reads as
stale. A boolean would be cleared by that write's own rebuild, and the
intervening change would be silently lost.

### The one-time document wipe, gated by PRAGMA user_version

The block-kind overhaul (text with sub-kinds, plus code) removed the old block
kinds — paragraph, heading_N, quote, callout, list_item — and no reader exists
for documents stored under them. Rather than migrate unreadable content, this is
a deliberate dev-stage reset: every document table is emptied once and
`PRAGMA user_version` is bumped to 1, so the wipe cannot repeat on a later open.
This is the only place a version number appears, and it exists specifically
because the operation is *not* idempotent — the additive statements need no such
guard.

### ADD COLUMN, with duplicate errors treated as success

SQLite has no `ADD COLUMN IF NOT EXISTS`, so the long `ALTER TABLE` list runs
unconditionally and any error containing `"duplicate column name"` is ignored:

```go
if _, err := s.db.Exec(alter); err != nil && !strings.Contains(err.Error(), "duplicate column name") {
	return err
}
```

That single check is what makes the additive model work for columns. Every entry
supplies `NOT NULL DEFAULT`, so existing rows get a usable value the moment the
column appears. The list reads as the schema's history in miniature — session
project selection, document revisions and lifecycle, change-set authorship and
undo/redo links, knowledge source blocks, user name/color/avatar, agent task
heartbeats and targets, the float32 vector columns, and the connector retry state.

### `connectors.failed_attempts` / `last_error` / `retry_after`

A failing sync's memory, added both to the create statement and to the ALTER list.
Connector sync is reconciliation — the decision to sync comes from comparing the
source's fingerprint to the stored one, not from a queue — so without these columns
a failure is forgotten before the next detector tick, and the whole connector is
re-read and every window re-embedded on every tick for as long as it lasts.

The defaults (`0`, `''`, `''`) are what make the addition safe on a live database:
every existing connector arrives with a clean retry budget, which is the truth —
nothing had been counting.

### Post-ALTER indexes

Four indexes are created after the column additions rather than in the slice,
because they reference columns that only exist once those `ALTER`s have run:
`idx_agent_tasks_document`, and three *partial* unique indexes on `change_sets`
covering `undo_of`, `redo_of`, and `(author_id, submission_id)`, each filtered to
non-empty values. The partial form matters — it enforces "at most one undo per
change set" and "one accepted change set per client submission id" (idempotent
retries) without the empty string colliding with itself across every other row.

### Column backfills

A short run of `UPDATE` statements gives old rows values the new columns need.
`prior_revision` is recovered as `seq - 1` (sequence is contiguous per document,
so the prior head is always the previous seq); `authored_revision` defaults to
`prior_revision` wherever it was left at the sentinel `-1`; a missing
`author_name` is recovered by joining to the `activity_events` row recorded for
that change set, falling back to the author's id; project `updated_at` falls back
to `created_at`; and each document's head `revision` is recomputed as the max of
its folded `base_seq` watermark and its newest retained change set — either can
be larger after a re-base or after history pruning.

### backfillDocumentHistory

`document_history` is the independently prunable metadata table behind the
revision list, and it postdates `change_sets`. This function finds every change
set that has an empty `summary` or no history row, decodes its ops, derives a
bounded summary via `document.SummarizeChangeOps`, writes it back onto the change
set, and inserts the history row. Two details: the rows are read fully and the
cursor closed *before* the write transaction opens, and the insert uses
`INSERT OR IGNORE` so a partially completed earlier run is safe to repeat. All
writes go in one transaction with a deferred rollback.

### repairVisibleTimestamps

The last step fixes the timestamps the UI sorts and displays on. For documents,
it takes the later of the stored `updated_at` and the newest change set's
`created_at` and rewrites it using `sortableTime`, so document ordering compares
fixed-width text. For projects, it takes the max `updated_at` across the
project's documents and pushes the project forward if that is later — so a
project's "last activity" reflects work inside it rather than the project row's
own last write.

### `knowledge_sources.label`

Added to the create statement and as an `ALTER TABLE ... ADD COLUMN` for existing
databases, defaulting to the empty string. The default is what makes the
migration safe on a live database: a source admitted before this column existed
simply has no label, which reads as "no human name recorded" rather than as
corruption, and it acquires one the next time its origin re-syncs.

### `backfillWindowText` — filling in windows written before they carried text

Gives every window its own text and covered block refs, for rows written when a
window was only a range into the source's stored copy.

It is a **pure local computation**: the source snapshot and the range are both already
on disk, so the text is a slice of the former and the blocks are what that range
touches. Nothing here re-windows or re-embeds, which matters more than it might look —
embeddings are the one part of the lattice that costs real money, so a migration that
recomputed them would bill the user to recover data already present.

Resumable rather than transactional, following `backfillVectorBlobs`: rows are read
and the cursor closed before any write, then each row is updated on its own. The
`WHERE w.text = '' AND s.text != ''` clause *is* the progress marker, so a run that
dies partway leaves finished rows finished and the next startup picks up the rest.
Tested for idempotence directly.

A window whose range does not fit its source is **skipped, not truncated**. The two
disagreeing can only mean the row is stale, and inventing citable text from a range
that does not fit would read as a real quotation — the worst available outcome. Left
empty, it stays visibly unfilled for the next re-sync to rebuild.

It calls `knowledge.CoveredBlocks` rather than reimplementing the overlap rule, so the
migration and the runtime cannot disagree about which components a range touches.
