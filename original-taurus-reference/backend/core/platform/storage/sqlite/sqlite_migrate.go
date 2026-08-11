// Schema definition and migration.
//
// Part of the single SQLite Store: this file holds the migrate persistence
// methods. Every file in this package shares one *Store and one connection, so
// the split is organizational — it mirrors the capability boundaries in
// core/capability so each domain's storage is legible on its own.
package sqlite

import (
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

func (s *Store) migrate() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id            TEXT PRIMARY KEY,
			email         TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			created_at    TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS sessions (
			id         TEXT PRIMARY KEY,
			user_id    TEXT NOT NULL REFERENCES users(id),
			project_id TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL,
			expires_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS projects (
			id         TEXT PRIMARY KEY,
			name       TEXT NOT NULL,
			purpose    TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS memberships (
			user_id    TEXT NOT NULL REFERENCES users(id),
			project_id TEXT NOT NULL REFERENCES projects(id),
			role       TEXT NOT NULL,
			PRIMARY KEY (user_id, project_id)
		)`,
		`CREATE TABLE IF NOT EXISTS project_links (
			project_id TEXT NOT NULL REFERENCES projects(id),
			role       TEXT NOT NULL,
			token      TEXT NOT NULL,
			PRIMARY KEY (project_id, role)
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_project_links_token ON project_links(token)`,
		`CREATE TABLE IF NOT EXISTS documents (
			id           TEXT PRIMARY KEY,
			project_id   TEXT NOT NULL REFERENCES projects(id),
			name         TEXT NOT NULL,
			base         TEXT NOT NULL,
			creator_id   TEXT NOT NULL DEFAULT '',
			creator_name TEXT NOT NULL DEFAULT '',
			base_seq     INTEGER NOT NULL DEFAULT 0,
			revision     INTEGER NOT NULL DEFAULT 0,
			created_at   TEXT NOT NULL,
			updated_at   TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id)`,
		`CREATE TABLE IF NOT EXISTS change_sets (
			id              TEXT PRIMARY KEY,
			document_id     TEXT NOT NULL REFERENCES documents(id),
			author_id       TEXT NOT NULL REFERENCES users(id),
			author_name     TEXT NOT NULL DEFAULT '',
			submission_id   TEXT NOT NULL DEFAULT '',
			submission_hash TEXT NOT NULL DEFAULT '',
			authored_revision INTEGER NOT NULL DEFAULT 0,
			prior_revision  INTEGER NOT NULL DEFAULT 0,
			seq             INTEGER NOT NULL,
			created_at      TEXT NOT NULL,
			ops             TEXT NOT NULL,
			undo_of         TEXT NOT NULL DEFAULT '',
			redo_of         TEXT NOT NULL DEFAULT '',
			summary         TEXT NOT NULL DEFAULT '{}',
			inverse_ops     TEXT NOT NULL DEFAULT '[]'
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_change_sets_doc_revision ON change_sets(document_id, seq)`,
		// idx_change_sets_doc_seq covered exactly these columns without the
		// uniqueness constraint, so the index above serves every read it did while
		// also enforcing one change set per (document, seq). Dropping it here — the
		// schema is declarative and replayed on every Open — sheds it from
		// databases created before it was removed.
		`DROP INDEX IF EXISTS idx_change_sets_doc_seq`,
		`CREATE TABLE IF NOT EXISTS document_submissions (
			document_id     TEXT NOT NULL REFERENCES documents(id),
			author_id       TEXT NOT NULL,
			submission_id   TEXT NOT NULL,
			submission_hash TEXT NOT NULL,
			receipt         TEXT NOT NULL,
			PRIMARY KEY (document_id, author_id, submission_id)
		)`,
		`CREATE TABLE IF NOT EXISTS document_history (
			change_set_id   TEXT PRIMARY KEY,
			document_id     TEXT NOT NULL REFERENCES documents(id),
			author_id       TEXT NOT NULL,
			author_name     TEXT NOT NULL,
			submission_id   TEXT NOT NULL DEFAULT '',
			authored_revision INTEGER NOT NULL DEFAULT 0,
			prior_revision  INTEGER NOT NULL,
			seq             INTEGER NOT NULL,
			created_at      TEXT NOT NULL,
			undo_of         TEXT NOT NULL DEFAULT '',
			redo_of         TEXT NOT NULL DEFAULT '',
			summary         TEXT NOT NULL,
			UNIQUE (document_id, seq)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_document_history_doc_seq ON document_history(document_id, seq DESC)`,
		`CREATE TABLE IF NOT EXISTS activity_events (
			id          TEXT PRIMARY KEY,
			project_id  TEXT NOT NULL REFERENCES projects(id),
			actor_id    TEXT NOT NULL,
			actor_name  TEXT NOT NULL,
			action      TEXT NOT NULL,
			target_id   TEXT NOT NULL,
			target_kind TEXT NOT NULL,
			target_name TEXT NOT NULL,
			occurred_at TEXT NOT NULL,
			source_kind TEXT NOT NULL,
			source_id   TEXT NOT NULL,
			UNIQUE (source_kind, source_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_activity_project_time ON activity_events(project_id, occurred_at DESC, id DESC)`,
		`CREATE TABLE IF NOT EXISTS jobs (
			id           TEXT PRIMARY KEY,
			type         TEXT NOT NULL,
			payload      TEXT NOT NULL,
			status       TEXT NOT NULL,
			attempts     INTEGER NOT NULL DEFAULT 0,
			max_attempts INTEGER NOT NULL,
			last_error   TEXT NOT NULL DEFAULT '',
			run_at       TEXT NOT NULL,
			created_at   TEXT NOT NULL,
			updated_at   TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_jobs_status_run_at ON jobs(status, run_at)`,
		`CREATE TABLE IF NOT EXISTS knowledge_sources (
			local_ref_id TEXT PRIMARY KEY,
			project_id   TEXT NOT NULL,
			source_type  TEXT NOT NULL,
			source_id    TEXT NOT NULL,
			label        TEXT NOT NULL DEFAULT '',
			-- Always written empty. It held a whole second copy of every source;
			-- content now comes from the origin and retrievable spans from the
			-- windows. The column survives because this file never drops one.
			text         TEXT NOT NULL,
			size_bytes   INTEGER NOT NULL DEFAULT 0,
			line_count   INTEGER NOT NULL DEFAULT 0,
			content_hash TEXT NOT NULL DEFAULT '',
			blocks       TEXT NOT NULL DEFAULT '[]',
			identity     TEXT NOT NULL DEFAULT '{}',
			added_at     TEXT NOT NULL,
			synced_at    TEXT NOT NULL,
			revision     INTEGER NOT NULL DEFAULT 0,
			UNIQUE (project_id, source_type, source_id)
		)`,
		`CREATE TABLE IF NOT EXISTS knowledge_windows (
			id           TEXT PRIMARY KEY,
			local_ref_id TEXT NOT NULL,
			ordinal      INTEGER NOT NULL,
			win_start    INTEGER NOT NULL,
			win_end      INTEGER NOT NULL,
			embedding    TEXT NOT NULL,
			text         TEXT NOT NULL DEFAULT '',
			blocks       TEXT NOT NULL DEFAULT '[]'
		)`,
		`CREATE INDEX IF NOT EXISTS idx_knowledge_windows_ref ON knowledge_windows(local_ref_id)`,
		`CREATE TABLE IF NOT EXISTS knowledge_nodes (
			id           TEXT PRIMARY KEY,
			project_id   TEXT NOT NULL,
			local_ref_id TEXT NOT NULL,
			level        INTEGER NOT NULL,
			member_count INTEGER NOT NULL,
			cohesion     REAL NOT NULL,
			centroid     TEXT NOT NULL,
			created_at   TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_project ON knowledge_nodes(project_id)`,
		`CREATE TABLE IF NOT EXISTS knowledge_memberships (
			parent_id TEXT NOT NULL,
			member_id TEXT NOT NULL,
			ordinal   INTEGER NOT NULL,
			PRIMARY KEY (parent_id, ordinal)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_knowledge_memberships_member ON knowledge_memberships(member_id)`,
		// The corpus tier's freshness, per project. dirty_seq is bumped by every
		// write that invalidates the tier; built_seq records what a rebuild last
		// covered. They are equal when the tier is current.
		//
		// A sequence pair rather than a boolean because the rebuild deliberately
		// computes outside a transaction: a write landing mid-computation bumps
		// dirty_seq past the value the rebuild is writing, so the result is stored
		// but still reads as stale. A boolean would be cleared by that same write's
		// rebuild and the intervening change would be lost.
		`CREATE TABLE IF NOT EXISTS knowledge_corpus_state (
			project_id TEXT PRIMARY KEY,
			dirty_seq  INTEGER NOT NULL DEFAULT 0,
			built_seq  INTEGER NOT NULL DEFAULT 0
		)`,
		// The corpus ascent's persisted k-NN index, one row per level: the
		// pinned threshold and the candidate machinery (projection basis, IVF
		// centroids as float32 matrices — see vector.go). Derived state: a
		// rebuild can always recreate it, so there is no backfill and absence
		// simply means the next rebuild builds in full.
		`CREATE TABLE IF NOT EXISTS knowledge_corpus_index (
			project_id TEXT NOT NULL,
			level      INTEGER NOT NULL,
			threshold  REAL NOT NULL,
			k          INTEGER NOT NULL,
			basis      BLOB,
			centroids  BLOB,
			PRIMARY KEY (project_id, level)
		)`,
		// One row per artifact per level: its IVF cell and its graph edges
		// (packed neighbour ids + exact float32 similarities). The cell index
		// is what lets a retrieval probe read one cell instead of a project.
		`CREATE TABLE IF NOT EXISTS knowledge_corpus_edges (
			project_id  TEXT NOT NULL,
			level       INTEGER NOT NULL,
			artifact_id TEXT NOT NULL,
			cell        INTEGER NOT NULL,
			edges       BLOB,
			PRIMARY KEY (project_id, level, artifact_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_knowledge_corpus_edges_cell ON knowledge_corpus_edges(project_id, level, cell)`,
		`CREATE TABLE IF NOT EXISTS formula_names (
			project_id TEXT NOT NULL,
			name       TEXT NOT NULL,
			type       TEXT NOT NULL,
			value      TEXT NOT NULL,
			schema     TEXT NOT NULL,
			rows       TEXT NOT NULL,
			source     TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			PRIMARY KEY (project_id, name)
		)`,
		`CREATE TABLE IF NOT EXISTS project_sessions (
			project_id              TEXT NOT NULL REFERENCES projects(id),
			user_id                 TEXT NOT NULL REFERENCES users(id),
			session_id              TEXT NOT NULL,
			user_name               TEXT NOT NULL,
			user_email              TEXT NOT NULL DEFAULT '',
			current_document_id     TEXT,
			caret_atom_id           TEXT,
			caret_offset            INTEGER,
			selection_start_atom_id TEXT,
			selection_start_offset  INTEGER,
			selection_end_atom_id   TEXT,
			selection_end_offset    INTEGER,
			started_at              TEXT NOT NULL,
			last_activity_at        TEXT NOT NULL,
			PRIMARY KEY (project_id, user_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_project_sessions_last_activity ON project_sessions(project_id, last_activity_at)`,
		`CREATE TABLE IF NOT EXISTS document_anchors (
			id           TEXT PRIMARY KEY,
			document_id  TEXT NOT NULL REFERENCES documents(id),
			row_id       TEXT NOT NULL,
			block_id     TEXT NOT NULL,
			atom_id      TEXT,
			start_offset INTEGER NOT NULL DEFAULT 0,
			end_offset   INTEGER NOT NULL DEFAULT 0,
			state        TEXT NOT NULL DEFAULT 'valid',
			created_at   TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_document_anchors_doc ON document_anchors(document_id)`,
		`CREATE TABLE IF NOT EXISTS personas (
			project_id      TEXT NOT NULL REFERENCES projects(id),
			id              TEXT NOT NULL,
			name            TEXT NOT NULL,
			description     TEXT NOT NULL,
			current_version INTEGER NOT NULL,
			created_by      TEXT NOT NULL,
			created_at      TEXT NOT NULL,
			updated_at      TEXT NOT NULL,
			PRIMARY KEY (project_id, id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_personas_project_name ON personas(project_id, name, id)`,
		`CREATE TABLE IF NOT EXISTS persona_versions (
			project_id TEXT NOT NULL,
			persona_id TEXT NOT NULL,
			version    INTEGER NOT NULL,
			definition TEXT NOT NULL,
			created_by TEXT NOT NULL,
			created_at TEXT NOT NULL,
			PRIMARY KEY (project_id, persona_id, version),
			FOREIGN KEY (project_id, persona_id) REFERENCES personas(project_id, id)
		)`,
		`CREATE TABLE IF NOT EXISTS persona_defaults (
			project_id TEXT NOT NULL,
			user_id    TEXT NOT NULL REFERENCES users(id),
			persona_id TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			PRIMARY KEY (project_id, user_id),
			FOREIGN KEY (project_id, persona_id) REFERENCES personas(project_id, id)
		)`,
		`CREATE TABLE IF NOT EXISTS agent_tasks (
			id             TEXT PRIMARY KEY,
			project_id     TEXT NOT NULL REFERENCES projects(id),
			requester_id   TEXT NOT NULL DEFAULT '',
			requester_name TEXT NOT NULL DEFAULT '',
			persona_id     TEXT NOT NULL DEFAULT '',
			state          TEXT NOT NULL,
			content        TEXT NOT NULL,
			heartbeat_at   TEXT NOT NULL DEFAULT '',
			created_at     TEXT NOT NULL,
			updated_at     TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_agent_tasks_project ON agent_tasks(project_id, created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_agent_tasks_persona_created ON agent_tasks(project_id, persona_id, created_at)`,
		`CREATE TABLE IF NOT EXISTS agent_chats (
			id           TEXT PRIMARY KEY,
			project_id   TEXT NOT NULL REFERENCES projects(id),
			requester_id TEXT NOT NULL,
			title        TEXT NOT NULL DEFAULT '',
			mode         TEXT NOT NULL,
			resource_id  TEXT NOT NULL DEFAULT '',
			persona_id   TEXT NOT NULL DEFAULT '',
			created_at   TEXT NOT NULL,
			updated_at   TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_agent_chats_project_updated ON agent_chats(project_id, updated_at)`,
		`CREATE INDEX IF NOT EXISTS idx_agent_chats_resource ON agent_chats(project_id, resource_id)`,
		`CREATE TABLE IF NOT EXISTS agent_chat_turns (
			id         TEXT PRIMARY KEY,
			chat_id    TEXT NOT NULL REFERENCES agent_chats(id),
			project_id TEXT NOT NULL REFERENCES projects(id),
			role       TEXT NOT NULL,
			body       TEXT NOT NULL,
			task_id    TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_agent_chat_turns_chat ON agent_chat_turns(chat_id)`,
		`CREATE TABLE IF NOT EXISTS agent_chat_attachments (
			id                  TEXT PRIMARY KEY,
			project_id          TEXT NOT NULL REFERENCES projects(id),
			chat_id             TEXT NOT NULL REFERENCES agent_chats(id),
			kind                TEXT NOT NULL,
			file_id             TEXT NOT NULL,
			name                TEXT NOT NULL,
			relative_path       TEXT NOT NULL DEFAULT '',
			directory_upload_id TEXT NOT NULL DEFAULT '',
			created_at          TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_agent_chat_attachments_chat ON agent_chat_attachments(chat_id, created_at)`,
		`CREATE TABLE IF NOT EXISTS resource_references (
			project_id TEXT NOT NULL REFERENCES projects(id),
			from_kind  TEXT NOT NULL,
			from_id    TEXT NOT NULL,
			to_kind    TEXT NOT NULL,
			to_id      TEXT NOT NULL,
			kind       TEXT NOT NULL,
			anchor     TEXT NOT NULL DEFAULT '',
			updated_at TEXT NOT NULL,
			PRIMARY KEY (project_id, from_kind, from_id, to_kind, to_id, anchor)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_resource_references_from ON resource_references(project_id, from_kind, from_id)`,
		`CREATE INDEX IF NOT EXISTS idx_resource_references_to ON resource_references(project_id, to_kind, to_id)`,
		`CREATE TABLE IF NOT EXISTS document_comments (
			id          TEXT PRIMARY KEY,
			project_id  TEXT NOT NULL REFERENCES projects(id),
			document_id TEXT NOT NULL,
			anchor_id   TEXT NOT NULL,
			author_id   TEXT NOT NULL,
			author_name TEXT NOT NULL DEFAULT '',
			body        TEXT NOT NULL,
			resolved    INTEGER NOT NULL DEFAULT 0,
			created_at  TEXT NOT NULL,
			updated_at  TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_document_comments_doc ON document_comments(project_id, document_id)`,
		`CREATE TABLE IF NOT EXISTS comment_replies (
			id         TEXT PRIMARY KEY,
			comment_id TEXT NOT NULL REFERENCES document_comments(id),
			project_id TEXT NOT NULL REFERENCES projects(id),
			author_id  TEXT NOT NULL,
			author_name TEXT NOT NULL DEFAULT '',
			body       TEXT NOT NULL,
			created_at TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_comment_replies_comment ON comment_replies(comment_id)`,
		`CREATE TABLE IF NOT EXISTS files (
			id            TEXT PRIMARY KEY,
			project_id    TEXT NOT NULL REFERENCES projects(id),
			name          TEXT NOT NULL,
			content_type  TEXT NOT NULL,
			size          INTEGER NOT NULL,
			uploader_id   TEXT NOT NULL,
			uploader_name TEXT NOT NULL DEFAULT '',
			content       BLOB NOT NULL,
			created_at    TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id, created_at)`,
		`CREATE TABLE IF NOT EXISTS resource_attributes (
			project_id  TEXT NOT NULL REFERENCES projects(id),
			kind        TEXT NOT NULL,
			resource_id TEXT NOT NULL,
			pinned      INTEGER NOT NULL DEFAULT 0,
			access      TEXT NOT NULL DEFAULT '',
			PRIMARY KEY (project_id, kind, resource_id)
		)`,
		`CREATE TABLE IF NOT EXISTS organizations (
			id         TEXT PRIMARY KEY,
			name       TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS org_memberships (
			org_id  TEXT NOT NULL REFERENCES organizations(id),
			user_id TEXT NOT NULL,
			role    TEXT NOT NULL,
			PRIMARY KEY (org_id, user_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON org_memberships(user_id)`,
		`CREATE TABLE IF NOT EXISTS workspaces (
			user_id    TEXT NOT NULL,
			project_id TEXT NOT NULL,
			state      TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			PRIMARY KEY (user_id, project_id)
		)`,
		`CREATE TABLE IF NOT EXISTS connectors (
			project_id      TEXT NOT NULL,
			id              TEXT NOT NULL,
			name            TEXT NOT NULL,
			subkind         TEXT NOT NULL,
			path            TEXT NOT NULL DEFAULT '',
			creator_id      TEXT NOT NULL DEFAULT '',
			fingerprint     TEXT NOT NULL DEFAULT '',
			sync_seq        INTEGER NOT NULL DEFAULT 0,
			synced_at       TEXT NOT NULL DEFAULT '',
			failed_attempts INTEGER NOT NULL DEFAULT 0,
			last_error      TEXT NOT NULL DEFAULT '',
			retry_after     TEXT NOT NULL DEFAULT '',
			created_at      TEXT NOT NULL,
			updated_at      TEXT NOT NULL,
			PRIMARY KEY (project_id, id)
		)`,
		`CREATE TABLE IF NOT EXISTS contexts (
			project_id    TEXT NOT NULL,
			id            TEXT NOT NULL,
			name          TEXT NOT NULL,
			creator_id    TEXT NOT NULL DEFAULT '',
			includes_json TEXT NOT NULL DEFAULT '[]',
			excludes_json TEXT NOT NULL DEFAULT '[]',
			created_at    TEXT NOT NULL,
			updated_at    TEXT NOT NULL,
			PRIMARY KEY (project_id, id)
		)`,
	}
	// The lattice is rebuildable projection state: an old-shape knowledge_nodes
	// table (pre-KLR, with root/child_ids columns) is dropped rather than
	// migrated — sources and windows are kept, and the lattice rebuilds on the
	// next add.
	var oldShape int
	_ = s.db.QueryRow(
		`SELECT COUNT(*) FROM pragma_table_info('knowledge_nodes') WHERE name = 'root'`,
	).Scan(&oldShape)
	if oldShape > 0 {
		if _, err := s.db.Exec(`DROP TABLE knowledge_nodes`); err != nil {
			return err
		}
	}
	for _, stmt := range stmts {
		if _, err := s.db.Exec(stmt); err != nil {
			return err
		}
	}

	// One-time document-model reset. The block-kind overhaul (text + sub-kinds,
	// code) removed the old block kinds (paragraph, heading_N, quote, callout,
	// list_item) and there is no reader for documents stored under them. Rather
	// than migrate, this deliberate dev-stage wipe clears all document data once,
	// gated by PRAGMA user_version so it runs exactly once per database. New
	// documents are created under the new model.
	const documentModelSchemaVersion = 1
	var userVersion int
	if err := s.db.QueryRow(`PRAGMA user_version`).Scan(&userVersion); err != nil {
		return err
	}
	if userVersion < documentModelSchemaVersion {
		for _, table := range []string{
			"documents", "change_sets", "document_submissions", "document_history",
			"document_anchors", "document_comments", "comment_replies",
		} {
			if _, err := s.db.Exec(`DELETE FROM ` + table); err != nil {
				return err
			}
		}
		if _, err := s.db.Exec(`PRAGMA user_version = 1`); err != nil {
			return err
		}
	}

	// Bring tables created before a column existed up to date. SQLite has no
	// "ADD COLUMN IF NOT EXISTS", so a duplicate-column error just means the
	// column is already present.
	for _, alter := range []string{
		`ALTER TABLE sessions ADD COLUMN project_id TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE documents ADD COLUMN base_seq INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE documents ADD COLUMN revision INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE change_sets ADD COLUMN author_name TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE change_sets ADD COLUMN submission_id TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE change_sets ADD COLUMN submission_hash TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE change_sets ADD COLUMN authored_revision INTEGER NOT NULL DEFAULT -1`,
		`ALTER TABLE change_sets ADD COLUMN prior_revision INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE change_sets ADD COLUMN undo_of TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE change_sets ADD COLUMN redo_of TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE change_sets ADD COLUMN summary TEXT NOT NULL DEFAULT '{}'`,
		`ALTER TABLE change_sets ADD COLUMN inverse_ops TEXT NOT NULL DEFAULT '[]'`,
		`ALTER TABLE document_history ADD COLUMN authored_revision INTEGER NOT NULL DEFAULT -1`,
		`ALTER TABLE knowledge_sources ADD COLUMN blocks TEXT NOT NULL DEFAULT '[]'`,
		`ALTER TABLE knowledge_sources ADD COLUMN identity TEXT NOT NULL DEFAULT '{}'`,
		`ALTER TABLE knowledge_sources ADD COLUMN revision INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE knowledge_sources ADD COLUMN label TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE projects ADD COLUMN icon TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE projects ADD COLUMN purpose TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE projects ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE projects ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'`,
		`ALTER TABLE documents ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'active'`,
		`ALTER TABLE documents ADD COLUMN trashed_at TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE documents ADD COLUMN creator_id TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE documents ADD COLUMN creator_name TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE project_sessions ADD COLUMN user_email TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE agent_tasks ADD COLUMN requester_name TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE agent_tasks ADD COLUMN heartbeat_at TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE agent_tasks ADD COLUMN target_document_id TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN color TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE resource_attributes ADD COLUMN access TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE agent_chats ADD COLUMN persona_id TEXT NOT NULL DEFAULT ''`,
		// A failing sync's memory. Connector sync is reconciliation — the decision
		// to sync comes from comparing fingerprints, not from a queue — so without
		// these columns a failure is forgotten before the next tick, and the whole
		// connector is re-read and re-embedded on every tick for as long as it lasts.
		`ALTER TABLE connectors ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE connectors ADD COLUMN last_error TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE connectors ADD COLUMN retry_after TEXT NOT NULL DEFAULT ''`,
		// Vectors move from JSON text to fixed-width little-endian float32.
		// Measured (BenchmarkVectorDecode*, 1536 dims): 252µs to parse one vector
		// out of JSON versus 4.3µs to read it out of a BLOB — 58x, and 5x smaller
		// stored. The frontier is decoded on every corpus rebuild AND every
		// retrieval query, so at a 200k frontier that is ~50 seconds of pure number
		// parsing per query. The old columns stay for the backfill below.
		`ALTER TABLE knowledge_windows ADD COLUMN embedding_v2 BLOB`,
		`ALTER TABLE knowledge_nodes ADD COLUMN centroid_v2 BLOB`,
		// A window becomes self-contained: its own text and the block refs that text
		// covers, so a citation needs nothing but the artifact being cited. Backfilled
		// from the source snapshot below, which is why the default is empty rather than
		// NOT NULL without one.
		`ALTER TABLE knowledge_windows ADD COLUMN text TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE knowledge_windows ADD COLUMN blocks TEXT NOT NULL DEFAULT '[]'`,
		// And a source stops being one: what is left of its text is the two numbers a
		// listing reports and the hash a re-sync compares. Backfilled from the stored
		// copy below, before that copy is blanked.
		`ALTER TABLE knowledge_sources ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE knowledge_sources ADD COLUMN line_count INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE knowledge_sources ADD COLUMN content_hash TEXT NOT NULL DEFAULT ''`,
	} {
		if _, err := s.db.Exec(alter); err != nil && !strings.Contains(err.Error(), "duplicate column name") {
			return err
		}
	}
	if _, err := s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_agent_tasks_document
		ON agent_tasks(project_id, target_document_id, created_at)`); err != nil {
		return err
	}
	if _, err := s.db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_change_sets_doc_undo
		ON change_sets(document_id, undo_of) WHERE undo_of <> ''`); err != nil {
		return err
	}
	if _, err := s.db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_change_sets_doc_submission
		ON change_sets(document_id, author_id, submission_id) WHERE submission_id <> ''`); err != nil {
		return err
	}
	if _, err := s.db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_change_sets_doc_redo
		ON change_sets(document_id, redo_of) WHERE redo_of <> ''`); err != nil {
		return err
	}
	// Existing rows predate explicit prior-revision metadata. Sequence is
	// contiguous per Document, so the accepted prior head is always Seq-1.
	if _, err := s.db.Exec(`UPDATE change_sets
		SET prior_revision = seq - 1
		WHERE seq > 1 AND prior_revision = 0`); err != nil {
		return err
	}
	if _, err := s.db.Exec(`UPDATE change_sets
		SET authored_revision = prior_revision
		WHERE authored_revision < 0`); err != nil {
		return err
	}
	if _, err := s.db.Exec(`UPDATE document_history
		SET authored_revision = prior_revision
		WHERE authored_revision < 0`); err != nil {
		return err
	}
	if _, err := s.db.Exec(`UPDATE change_sets
		SET author_name = COALESCE(
			(SELECT actor_name FROM activity_events
			 WHERE source_kind = 'document.change_set' AND source_id = change_sets.id),
			author_id
		)
		WHERE author_name = ''`); err != nil {
		return err
	}
	report, err := s.scrubDocumentStyles()
	if err != nil {
		return err
	}
	s.documentStyleScrub = report
	if err := s.backfillDocumentHistory(); err != nil {
		return err
	}
	if err := s.backfillVectorBlobs(); err != nil {
		return err
	}
	if err := s.backfillWindowText(); err != nil {
		return err
	}
	// Strictly after backfillWindowText: it reads the source text these two are
	// about to summarise and then erase.
	if err := s.backfillSourceMetadata(); err != nil {
		return err
	}
	if err := s.blankSourceText(); err != nil {
		return err
	}
	// Ω-005 is the only lattice migration that rebuilds tables: it introduces
	// generation_id into every artifact key after all legacy payload backfills
	// have completed, then pins a homogeneous legacy Project as generation 1 or
	// quarantines a mixed/invalid Project as reembed_required.
	if err := s.migrateKnowledgeGenerations(); err != nil {
		return err
	}

	// Backfill updated_at for projects created before the column existed.
	if _, err := s.db.Exec(
		`UPDATE projects SET updated_at = created_at WHERE updated_at = ''`,
	); err != nil {
		return err
	}
	// Existing documents predate the explicit head revision. Recover it from the
	// folded watermark and the newest retained change set; either may be the
	// larger value after re-base and history pruning.
	if _, err := s.db.Exec(`UPDATE documents
		SET revision = MAX(
			base_seq,
			COALESCE((SELECT MAX(seq) FROM change_sets WHERE document_id = documents.id), 0)
		)`); err != nil {
		return err
	}
	return s.repairVisibleTimestamps()
}

// backfillWindowText gives every window its own text and covered block refs, for
// rows written when a window was only a range into the source's stored copy.
//
// It is a pure local computation: the source snapshot and the window's range are both
// present, so each window's text is a slice of the former and its blocks are the
// components that range touches. No provider call, no re-windowing, nothing that can
// cost money or change what is stored beyond filling in the two new columns.
//
// Resumable rather than transactional, following backfillVectorBlobs: rows are read
// and the cursor closed before any write, then each row is updated on its own. A run
// that dies partway leaves the windows it finished filled in and the rest empty, and
// the next startup finishes the job — the WHERE clause is the progress marker.
//
// A window whose range no longer fits its source is skipped rather than truncated. It
// can only mean the two disagree, and inventing text for a citation from a range that
// does not fit is worse than leaving the row for the next re-sync to rebuild.
func (s *Store) backfillWindowText() error {
	type pending struct {
		id     string
		text   string
		blocks []knowledge.BlockRef
	}
	rows, err := s.db.Query(
		`SELECT w.id, w.win_start, w.win_end, s.text, s.blocks
		 FROM knowledge_windows w JOIN knowledge_sources s ON w.local_ref_id = s.local_ref_id
		 WHERE w.text = '' AND s.text != ''`)
	if err != nil {
		return err
	}
	var batch []pending
	for rows.Next() {
		var id, srcText, blocksJSON string
		var start, end int
		if err := rows.Scan(&id, &start, &end, &srcText, &blocksJSON); err != nil {
			rows.Close()
			return err
		}
		if start < 0 || end > len(srcText) || start > end {
			continue
		}
		var spans []knowledge.BlockSpan
		_ = json.Unmarshal([]byte(blocksJSON), &spans)
		batch = append(batch, pending{
			id:     id,
			text:   srcText[start:end],
			blocks: knowledge.CoveredBlocks(spans, start, end),
		})
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for _, p := range batch {
		blocks, err := json.Marshal(p.blocks)
		if err != nil {
			return err
		}
		if _, err := s.db.Exec(
			`UPDATE knowledge_windows SET text = ?, blocks = ? WHERE id = ?`,
			p.text, string(blocks), p.id,
		); err != nil {
			return err
		}
	}
	return nil
}

// backfillSourceMetadata derives each source's size, line count and content hash
// from the copy of its text that is about to stop being kept.
//
// The three columns are what remains of that copy: two numbers a listing reports
// and one identity a re-sync compares against. Deriving them here rather than
// letting them fill in on the next sync is what makes the transition free — an
// empty content_hash never matches, so every source in every project would
// otherwise re-window and re-cluster on its first sync after upgrading.
//
// It uses knowledge.ContentHash and knowledge.CountLines rather than SQL, and that
// is the point of those two being exported: a hash computed one way here and
// another way at ingest would silently defeat the very skip it exists to enable.
//
// Resumable in the same shape as backfillWindowText — rows read and the cursor
// closed before any write, one update per row, the WHERE clause as the progress
// marker. Unlike that function it keeps no text in the batch: the whole point is
// to hold three small values per source instead of every source's bytes at once.
func (s *Store) backfillSourceMetadata() error {
	type pending struct {
		ref   string
		size  int
		lines int
		hash  string
	}
	rows, err := s.db.Query(`SELECT local_ref_id, text FROM knowledge_sources WHERE content_hash = ''`)
	if err != nil {
		return err
	}
	var batch []pending
	for rows.Next() {
		var ref, text string
		if err := rows.Scan(&ref, &text); err != nil {
			rows.Close()
			return err
		}
		batch = append(batch, pending{
			ref:   ref,
			size:  len(text),
			lines: knowledge.CountLines(text),
			hash:  knowledge.ContentHash(text),
		})
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for _, p := range batch {
		if _, err := s.db.Exec(
			`UPDATE knowledge_sources SET size_bytes = ?, line_count = ?, content_hash = ? WHERE local_ref_id = ?`,
			p.size, p.lines, p.hash, p.ref,
		); err != nil {
			return err
		}
	}
	return nil
}

// blankSourceText erases the second copy of every source, once its windows can
// stand in for it.
//
// This is the only migration in this file that destroys data. What it removes is
// recoverable from the source's origin and nowhere else, so where an origin has
// since been deleted the erased copy was the last one — the accepted premise of
// the change, since a copy that can silently disagree with the real file is worse
// than an honest failure to read it.
//
// The gate is what makes it safe to run at any point: a source is blanked only
// when every one of its windows already carries its own text. A half-finished
// backfillWindowText therefore cannot erase text whose replacement does not yet
// exist, and the next startup blanks whatever became eligible in between.
//
// A source with no windows at all passes the gate vacuously, which is correct:
// windowSpans drops all-whitespace windows, so a source that produced none has
// nothing but whitespace to lose.
//
// The column itself stays. This file never renames or drops one in place, and
// storage is reclaimed all the same — an optional VACUUM away, rather than a
// load-bearing step that has to succeed.
func (s *Store) blankSourceText() error {
	rows, err := s.db.Query(
		`SELECT local_ref_id FROM knowledge_sources s
		 WHERE s.text != ''
		   AND NOT EXISTS (SELECT 1 FROM knowledge_windows w
		                   WHERE w.local_ref_id = s.local_ref_id AND w.text = '')`)
	if err != nil {
		return err
	}
	var refs []string
	for rows.Next() {
		var ref string
		if err := rows.Scan(&ref); err != nil {
			rows.Close()
			return err
		}
		refs = append(refs, ref)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for _, ref := range refs {
		if _, err := s.db.Exec(`UPDATE knowledge_sources SET text = '' WHERE local_ref_id = ?`, ref); err != nil {
			return err
		}
	}
	return nil
}

// backfillVectorBlobs converts JSON-stored vectors to the float32 BLOB format,
// for rows written before the columns existed.
//
// Embeddings are the one part of the lattice that cannot simply be rebuilt —
// they cost real provider tokens — so unlike the node table, which is dropped
// and recomputed when its shape changes, these are migrated in place.
//
// It is resumable rather than transactional: each row is converted on its own,
// and a run that dies partway leaves the rows it finished converted and the rest
// legible through their JSON. decodeStoredVector prefers the BLOB and falls back
// to the JSON, so a half-migrated database reads correctly either way and the
// next startup finishes the job.
func (s *Store) backfillVectorBlobs() error {
	for _, t := range []struct{ table, id, blob, legacy string }{
		{"knowledge_windows", "id", "embedding_v2", "embedding"},
		{"knowledge_nodes", "id", "centroid_v2", "centroid"},
	} {
		rows, err := s.db.Query(
			`SELECT ` + t.id + `, ` + t.legacy + ` FROM ` + t.table +
				` WHERE ` + t.blob + ` IS NULL AND ` + t.legacy + ` != ''`)
		if err != nil {
			return err
		}
		type pending struct {
			id  string
			vec []float64
		}
		var batch []pending
		for rows.Next() {
			var id, legacy string
			if err := rows.Scan(&id, &legacy); err != nil {
				rows.Close()
				return err
			}
			var v []float64
			if err := json.Unmarshal([]byte(legacy), &v); err != nil {
				// A row whose JSON will not parse is already unusable; converting it
				// is not this migration's job and failing startup over it would make
				// one corrupt vector fatal to the whole server.
				continue
			}
			batch = append(batch, pending{id: id, vec: v})
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return err
		}
		for _, p := range batch {
			if _, err := s.db.Exec(
				`UPDATE `+t.table+` SET `+t.blob+` = ? WHERE `+t.id+` = ?`,
				encodeVector(p.vec), p.id,
			); err != nil {
				return err
			}
		}
	}
	return nil
}

// backfillDocumentHistory derives bounded summaries for revisions written
// before History existed, then copies their immutable metadata into the
// independently prunable summary table.
func (s *Store) backfillDocumentHistory() error {
	rows, err := s.db.Query(`SELECT
		id, document_id, author_id, author_name, submission_id, authored_revision,
		prior_revision, seq, created_at, ops, undo_of, redo_of
		FROM change_sets c
		WHERE c.summary = '{}'
		   OR NOT EXISTS (
			SELECT 1 FROM document_history h WHERE h.change_set_id = c.id
		   )
		ORDER BY document_id, seq`)
	if err != nil {
		return err
	}
	type legacyRevision struct {
		id, documentID, authorID, authorName, submissionID string
		createdAt, ops, undoOf, redoOf                     string
		authoredRevision, priorRevision, seq               int64
	}
	var revisions []legacyRevision
	for rows.Next() {
		var revision legacyRevision
		if err := rows.Scan(
			&revision.id, &revision.documentID, &revision.authorID, &revision.authorName,
			&revision.submissionID, &revision.authoredRevision,
			&revision.priorRevision, &revision.seq,
			&revision.createdAt, &revision.ops, &revision.undoOf, &revision.redoOf,
		); err != nil {
			rows.Close()
			return err
		}
		revisions = append(revisions, revision)
	}
	if err := rows.Close(); err != nil {
		return err
	}
	if err := rows.Err(); err != nil {
		return err
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, revision := range revisions {
		var ops []document.ChangeOp
		if err := json.Unmarshal([]byte(revision.ops), &ops); err != nil {
			return err
		}
		summary, err := json.Marshal(document.SummarizeChangeOps(ops))
		if err != nil {
			return err
		}
		if _, err := tx.Exec(`UPDATE change_sets SET summary = ? WHERE id = ?`, string(summary), revision.id); err != nil {
			return err
		}
		if _, err := tx.Exec(`INSERT OR IGNORE INTO document_history(
			change_set_id, document_id, author_id, author_name, submission_id,
			authored_revision, prior_revision, seq, created_at, undo_of, redo_of, summary
		) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			revision.id, revision.documentID, revision.authorID, revision.authorName,
			revision.submissionID, revision.authoredRevision,
			revision.priorRevision, revision.seq,
			revision.createdAt, revision.undoOf, revision.redoOf, string(summary),
		); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) repairVisibleTimestamps() error {
	type timestampRepair struct {
		id string
		at time.Time
	}
	documentTimes := make(map[string]time.Time)
	rows, err := s.db.Query(`SELECT d.id, d.updated_at, c.created_at
		FROM documents d LEFT JOIN change_sets c ON c.document_id = d.id`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var id, updated string
		var changeTime sql.NullString
		if err := rows.Scan(&id, &updated, &changeTime); err != nil {
			rows.Close()
			return err
		}
		current := documentTimes[id]
		stored, _ := time.Parse(timeLayout, updated)
		if stored.After(current) {
			current = stored
		}
		if changeTime.Valid {
			candidate, _ := time.Parse(timeLayout, changeTime.String)
			if candidate.After(current) {
				current = candidate
			}
		}
		documentTimes[id] = current
	}
	if err := rows.Close(); err != nil {
		return err
	}
	for id, at := range documentTimes {
		if _, err := s.db.Exec(`UPDATE documents SET updated_at = ? WHERE id = ?`, sortableTime(at), id); err != nil {
			return err
		}
	}

	var projects []timestampRepair
	rows, err = s.db.Query(`SELECT p.id, p.updated_at, MAX(d.updated_at)
		FROM projects p LEFT JOIN documents d ON d.project_id = p.id GROUP BY p.id`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var id, updated string
		var newest sql.NullString
		if err := rows.Scan(&id, &updated, &newest); err != nil {
			rows.Close()
			return err
		}
		current, _ := time.Parse(timeLayout, updated)
		if newest.Valid {
			candidate, _ := time.Parse(timeLayout, newest.String)
			if candidate.After(current) {
				projects = append(projects, timestampRepair{id: id, at: candidate})
			}
		}
	}
	if err := rows.Close(); err != nil {
		return err
	}
	for _, repair := range projects {
		if _, err := s.db.Exec(`UPDATE projects SET updated_at = ? WHERE id = ?`, repair.at.Format(timeLayout), repair.id); err != nil {
			return err
		}
	}
	return nil
}
