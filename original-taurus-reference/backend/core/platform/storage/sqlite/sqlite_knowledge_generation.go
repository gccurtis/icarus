package sqlite

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

const legacyArtifactGeneration = "legacy"

// sqliteArtifactView is the durable equivalent of the in-memory generation
// view. Every artifact query is parameterized by this id; no caller can
// accidentally read a window or node from another generation merely because
// its content-derived id is the same.
type sqliteArtifactView struct {
	root         *Store
	generationID string
}

// migrateKnowledgeGenerations is deliberately run after the old vector,
// window-text and source-metadata backfills. Those backfills understand the
// pre-generation schema; this one then rebuilds all seven artifact tables in
// one transaction and never needs to run again.
func (s *Store) migrateKnowledgeGenerations() error {
	if err := createKnowledgeLifecycleTables(s.db); err != nil {
		return err
	}
	var hasGeneration int
	if err := s.db.QueryRow(
		`SELECT COUNT(*) FROM pragma_table_info('knowledge_sources') WHERE name='generation_id'`,
	).Scan(&hasGeneration); err != nil {
		return err
	}
	if hasGeneration > 0 {
		return nil
	}

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`CREATE TEMP TABLE knowledge_legacy_generation_map (
		project_id TEXT PRIMARY KEY,
		generation_id TEXT NOT NULL
	)`); err != nil {
		return err
	}
	rows, err := tx.Query(`SELECT project_id, identity, MIN(added_at)
		FROM knowledge_sources GROUP BY project_id, identity ORDER BY project_id, identity`)
	if err != nil {
		return err
	}
	type legacyIdentity struct {
		raw       string
		createdAt string
	}
	byProject := map[string][]legacyIdentity{}
	for rows.Next() {
		var projectID, identity, createdAt string
		if err := rows.Scan(&projectID, &identity, &createdAt); err != nil {
			rows.Close()
			return err
		}
		byProject[projectID] = append(byProject[projectID], legacyIdentity{raw: identity, createdAt: createdAt})
	}
	if err := rows.Close(); err != nil {
		return err
	}
	if err := rows.Err(); err != nil {
		return err
	}

	now := time.Now().UTC()
	for projectID, identities := range byProject {
		generationID := legacyGenerationID(projectID)
		if _, err := tx.Exec(`INSERT INTO knowledge_legacy_generation_map(project_id,generation_id) VALUES(?,?)`,
			projectID, generationID); err != nil {
			return err
		}
		createdAt := now
		if parsed, err := time.Parse(timeLayout, identities[0].createdAt); err == nil {
			createdAt = parsed
		}
		generation := knowledge.LatticeGeneration{
			ID: generationID, ProjectID: projectID, Kind: knowledge.LatticeText,
			State: knowledge.GenerationReembedRequired, CreatedAt: createdAt,
		}
		activeID := ""
		if len(identities) == 1 {
			var vectorIdentity knowledge.VectorIdentity
			if json.Unmarshal([]byte(identities[0].raw), &vectorIdentity) == nil {
				space := knowledge.SpaceForIdentity(vectorIdentity)
				vectorsValid, err := legacyVectorsMatchSpaceTx(tx, projectID, space.Dimensions)
				if err != nil {
					return err
				}
				if space.Validate() == nil && vectorsValid {
					generation.SpaceIdentity = space.Identity()
					generation.State = knowledge.GenerationActive
					generation.PromotedAt = timePointerSQL(createdAt)
					activeID = generationID
					if err := insertSpaceTx(tx, space); err != nil {
						return err
					}
				}
			}
		}
		if err := insertGenerationTx(tx, generation); err != nil {
			return err
		}
		if _, err := tx.Exec(`INSERT INTO knowledge_lattice_state(
				project_id,kind,active_generation_id,previous_generation_id,revision,source_cursor,updated_at
			) VALUES(?,?,?,?,1,0,?)
			ON CONFLICT(project_id,kind) DO NOTHING`,
			projectID, string(knowledge.LatticeText), activeID, "", createdAt.Format(timeLayout)); err != nil {
			return err
		}
	}

	for _, table := range []string{
		"knowledge_memberships", "knowledge_corpus_edges", "knowledge_corpus_index",
		"knowledge_corpus_state", "knowledge_windows", "knowledge_nodes", "knowledge_sources",
	} {
		if _, err := tx.Exec(`ALTER TABLE ` + table + ` RENAME TO ` + table + `_omega005_legacy`); err != nil {
			return err
		}
	}
	if err := createGenerationArtifactTables(tx); err != nil {
		return err
	}
	copyStatements := []string{
		`INSERT INTO knowledge_sources
		 SELECT m.generation_id,s.* FROM knowledge_sources_omega005_legacy s
		 JOIN knowledge_legacy_generation_map m ON m.project_id=s.project_id`,
		`INSERT INTO knowledge_windows
		 SELECT s.generation_id,w.* FROM knowledge_windows_omega005_legacy w
		 JOIN knowledge_sources s ON s.local_ref_id=w.local_ref_id`,
		`INSERT INTO knowledge_nodes
		 SELECT m.generation_id,n.* FROM knowledge_nodes_omega005_legacy n
		 JOIN knowledge_legacy_generation_map m ON m.project_id=n.project_id`,
		`INSERT INTO knowledge_memberships
		 SELECT n.generation_id,m.* FROM knowledge_memberships_omega005_legacy m
		 JOIN knowledge_nodes n ON n.id=m.parent_id`,
		`INSERT INTO knowledge_corpus_state
		 SELECT m.generation_id,c.* FROM knowledge_corpus_state_omega005_legacy c
		 JOIN knowledge_legacy_generation_map m ON m.project_id=c.project_id`,
		`INSERT INTO knowledge_corpus_index
		 SELECT m.generation_id,c.* FROM knowledge_corpus_index_omega005_legacy c
		 JOIN knowledge_legacy_generation_map m ON m.project_id=c.project_id`,
		`INSERT INTO knowledge_corpus_edges
		 SELECT m.generation_id,c.* FROM knowledge_corpus_edges_omega005_legacy c
		 JOIN knowledge_legacy_generation_map m ON m.project_id=c.project_id`,
	}
	for _, stmt := range copyStatements {
		if _, err := tx.Exec(stmt); err != nil {
			return err
		}
	}
	for projectID := range byProject {
		if err := s.refreshGenerationCountsTx(tx, legacyGenerationID(projectID), 0); err != nil {
			return err
		}
	}
	for _, table := range []string{
		"knowledge_memberships", "knowledge_corpus_edges", "knowledge_corpus_index",
		"knowledge_corpus_state", "knowledge_windows", "knowledge_nodes", "knowledge_sources",
	} {
		if _, err := tx.Exec(`DROP TABLE ` + table + `_omega005_legacy`); err != nil {
			return err
		}
	}
	if err := createGenerationArtifactIndexes(tx); err != nil {
		return err
	}
	return tx.Commit()
}

// A single source identity is not enough to certify an old project when any
// persisted artifact is missing its canonical float32 encoding or has the
// wrong width. The earlier vector backfill leaves an invalid legacy JSON value
// as NULL, so this check quarantines corrupt and dimension-mismatched projects
// instead of silently declaring them active.
func legacyVectorsMatchSpaceTx(tx *sql.Tx, projectID string, dimensions int) (bool, error) {
	if dimensions <= 0 {
		return false, nil
	}
	wantBytes := dimensions * 4
	var invalid int
	if err := tx.QueryRow(
		`SELECT COUNT(*) FROM knowledge_windows w
		 JOIN knowledge_sources s ON s.local_ref_id=w.local_ref_id
		 WHERE s.project_id=? AND
		       (w.embedding_v2 IS NULL OR length(w.embedding_v2)<>?)`,
		projectID, wantBytes,
	).Scan(&invalid); err != nil {
		return false, err
	}
	if invalid != 0 {
		return false, nil
	}
	if err := tx.QueryRow(
		`SELECT COUNT(*) FROM knowledge_nodes
		 WHERE project_id=? AND
		       (centroid_v2 IS NULL OR length(centroid_v2)<>?)`,
		projectID, wantBytes,
	).Scan(&invalid); err != nil {
		return false, err
	}
	return invalid == 0, nil
}

func createKnowledgeLifecycleTables(db interface {
	Exec(string, ...any) (sql.Result, error)
}) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS knowledge_embedding_spaces (
			identity TEXT PRIMARY KEY,
			definition TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS knowledge_generations (
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL,
			kind TEXT NOT NULL,
			space_identity TEXT NOT NULL,
			state TEXT NOT NULL,
			record TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_knowledge_generations_project
			ON knowledge_generations(project_id,kind,state)`,
		`CREATE TABLE IF NOT EXISTS knowledge_lattice_state (
			project_id TEXT NOT NULL,
			kind TEXT NOT NULL,
			active_generation_id TEXT NOT NULL DEFAULT '',
			previous_generation_id TEXT NOT NULL DEFAULT '',
			revision INTEGER NOT NULL DEFAULT 0,
			source_cursor INTEGER NOT NULL DEFAULT 0,
			updated_at TEXT NOT NULL,
			PRIMARY KEY(project_id,kind)
		)`,
		`CREATE TABLE IF NOT EXISTS knowledge_source_changes (
			project_id TEXT NOT NULL,
			kind TEXT NOT NULL,
			cursor INTEGER NOT NULL,
			generation_id TEXT NOT NULL DEFAULT 'legacy',
			operation TEXT NOT NULL,
			source_type TEXT NOT NULL,
			source_id TEXT NOT NULL,
			revision INTEGER NOT NULL,
			content_hash TEXT NOT NULL,
			occurred_at TEXT NOT NULL,
			PRIMARY KEY(project_id,kind,cursor)
		)`,
		`CREATE TABLE IF NOT EXISTS knowledge_reembed_previews (
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL,
			kind TEXT NOT NULL,
			record TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS knowledge_reembed_runs (
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL,
			kind TEXT NOT NULL,
			preview_id TEXT NOT NULL,
			target_generation_id TEXT NOT NULL,
			idempotency_key TEXT NOT NULL,
			status TEXT NOT NULL,
			record TEXT NOT NULL,
			UNIQUE(project_id,kind,idempotency_key)
		)`,
		`CREATE TABLE IF NOT EXISTS knowledge_reembed_checkpoints (
			run_id TEXT NOT NULL,
			source_type TEXT NOT NULL,
			source_id TEXT NOT NULL,
			record TEXT NOT NULL,
			PRIMARY KEY(run_id,source_type,source_id)
		)`,
		`CREATE TABLE IF NOT EXISTS knowledge_generation_events (
			sequence INTEGER PRIMARY KEY AUTOINCREMENT,
			id TEXT NOT NULL UNIQUE,
			project_id TEXT NOT NULL,
			kind TEXT NOT NULL,
			generation_id TEXT NOT NULL DEFAULT 'legacy',
			event_type TEXT NOT NULL,
			actor_id TEXT NOT NULL,
			state_revision INTEGER NOT NULL,
			occurred_at TEXT NOT NULL
		)`,
	}
	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

func createGenerationArtifactTables(db interface {
	Exec(string, ...any) (sql.Result, error)
}) error {
	stmts := []string{
		`CREATE TABLE knowledge_sources (
			generation_id TEXT NOT NULL DEFAULT 'legacy',
			local_ref_id TEXT NOT NULL,
			project_id TEXT NOT NULL,
			source_type TEXT NOT NULL,
			source_id TEXT NOT NULL,
			label TEXT NOT NULL DEFAULT '',
			text TEXT NOT NULL,
			size_bytes INTEGER NOT NULL DEFAULT 0,
			line_count INTEGER NOT NULL DEFAULT 0,
			content_hash TEXT NOT NULL DEFAULT '',
			blocks TEXT NOT NULL DEFAULT '[]',
			identity TEXT NOT NULL DEFAULT '{}',
			added_at TEXT NOT NULL,
			synced_at TEXT NOT NULL,
			revision INTEGER NOT NULL DEFAULT 0,
			PRIMARY KEY(generation_id,local_ref_id),
			UNIQUE(generation_id,project_id,source_type,source_id)
		)`,
		`CREATE TABLE knowledge_windows (
			generation_id TEXT NOT NULL DEFAULT 'legacy',
			id TEXT NOT NULL,
			local_ref_id TEXT NOT NULL,
			ordinal INTEGER NOT NULL,
			win_start INTEGER NOT NULL,
			win_end INTEGER NOT NULL,
			embedding TEXT NOT NULL,
			text TEXT NOT NULL DEFAULT '',
			blocks TEXT NOT NULL DEFAULT '[]',
			embedding_v2 BLOB,
			PRIMARY KEY(generation_id,id)
		)`,
		`CREATE TABLE knowledge_nodes (
			generation_id TEXT NOT NULL DEFAULT 'legacy',
			id TEXT NOT NULL,
			project_id TEXT NOT NULL,
			local_ref_id TEXT NOT NULL,
			level INTEGER NOT NULL,
			member_count INTEGER NOT NULL,
			cohesion REAL NOT NULL,
			centroid TEXT NOT NULL,
			created_at TEXT NOT NULL,
			centroid_v2 BLOB,
			PRIMARY KEY(generation_id,id)
		)`,
		`CREATE TABLE knowledge_memberships (
			generation_id TEXT NOT NULL DEFAULT 'legacy',
			parent_id TEXT NOT NULL,
			member_id TEXT NOT NULL,
			ordinal INTEGER NOT NULL,
			PRIMARY KEY(generation_id,parent_id,ordinal)
		)`,
		`CREATE TABLE knowledge_corpus_state (
			generation_id TEXT NOT NULL DEFAULT 'legacy',
			project_id TEXT NOT NULL,
			dirty_seq INTEGER NOT NULL DEFAULT 0,
			built_seq INTEGER NOT NULL DEFAULT 0,
			PRIMARY KEY(generation_id,project_id)
		)`,
		`CREATE TABLE knowledge_corpus_index (
			generation_id TEXT NOT NULL,
			project_id TEXT NOT NULL,
			level INTEGER NOT NULL,
			threshold REAL NOT NULL,
			k INTEGER NOT NULL,
			basis BLOB,
			centroids BLOB,
			PRIMARY KEY(generation_id,project_id,level)
		)`,
		`CREATE TABLE knowledge_corpus_edges (
			generation_id TEXT NOT NULL DEFAULT 'legacy',
			project_id TEXT NOT NULL,
			level INTEGER NOT NULL,
			artifact_id TEXT NOT NULL,
			cell INTEGER NOT NULL,
			edges BLOB,
			PRIMARY KEY(generation_id,project_id,level,artifact_id)
		)`,
	}
	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

func createGenerationArtifactIndexes(db interface {
	Exec(string, ...any) (sql.Result, error)
}) error {
	for _, stmt := range []string{
		`CREATE INDEX IF NOT EXISTS idx_knowledge_windows_ref
			ON knowledge_windows(generation_id,local_ref_id)`,
		`CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_project
			ON knowledge_nodes(generation_id,project_id)`,
		`CREATE INDEX IF NOT EXISTS idx_knowledge_memberships_member
			ON knowledge_memberships(generation_id,member_id)`,
		`CREATE INDEX IF NOT EXISTS idx_knowledge_corpus_edges_cell
			ON knowledge_corpus_edges(generation_id,project_id,level,cell)`,
	} {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

func legacyGenerationID(projectID string) string {
	sum := sha256.Sum256([]byte("knowledge-generation-1\x00" + projectID))
	return hex.EncodeToString(sum[:16])
}

func timePointerSQL(t time.Time) *time.Time { return &t }

func insertSpaceTx(tx *sql.Tx, space knowledge.EmbeddingSpace) error {
	raw, err := json.Marshal(space)
	if err != nil {
		return err
	}
	_, err = tx.Exec(`INSERT INTO knowledge_embedding_spaces(identity,definition) VALUES(?,?)
		ON CONFLICT(identity) DO NOTHING`, space.Identity(), string(raw))
	return err
}

func insertGenerationTx(tx *sql.Tx, generation knowledge.LatticeGeneration) error {
	raw, err := json.Marshal(generation)
	if err != nil {
		return err
	}
	_, err = tx.Exec(`INSERT INTO knowledge_generations(id,project_id,kind,space_identity,state,record)
		VALUES(?,?,?,?,?,?)
		ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,kind=excluded.kind,
			space_identity=excluded.space_identity,state=excluded.state,record=excluded.record`,
		generation.ID, generation.ProjectID, string(generation.Kind), generation.SpaceIdentity,
		string(generation.State), string(raw))
	return err
}

func tokenFromState(state knowledge.ProjectLatticeState) knowledge.ReadToken {
	return knowledge.ReadToken{
		ProjectID: state.ProjectID, Kind: state.Kind, GenerationID: state.ActiveGenerationID,
		StateRevision: state.Revision, SourceCursor: state.SourceCursor,
	}
}

func (s *Store) ForGeneration(generationID string) knowledge.ArtifactStore {
	return &sqliteArtifactView{root: s, generationID: generationID}
}

func (s *Store) Active(projectID string, kind knowledge.LatticeKind) (knowledge.ReadToken, knowledge.LatticeGeneration, knowledge.EmbeddingSpace, error) {
	state, err := s.latticeState(nil, projectID, kind)
	if errors.Is(err, sql.ErrNoRows) {
		return knowledge.ReadToken{}, knowledge.LatticeGeneration{}, knowledge.EmbeddingSpace{}, knowledge.ErrGenerationNotInitialized
	}
	if err != nil || state.ActiveGenerationID == "" {
		return knowledge.ReadToken{}, knowledge.LatticeGeneration{}, knowledge.EmbeddingSpace{}, knowledge.ErrEmbeddingSpaceUnavailable
	}
	generation, err := s.generation(nil, state.ActiveGenerationID)
	if err != nil || generation.State != knowledge.GenerationActive {
		return knowledge.ReadToken{}, knowledge.LatticeGeneration{}, knowledge.EmbeddingSpace{}, knowledge.ErrEmbeddingSpaceUnavailable
	}
	space, err := s.space(nil, generation.SpaceIdentity)
	if err != nil {
		return knowledge.ReadToken{}, knowledge.LatticeGeneration{}, knowledge.EmbeddingSpace{}, knowledge.ErrEmbeddingSpaceUnavailable
	}
	return tokenFromState(state), generation, space, nil
}

func (s *Store) ReembedBase(projectID string, kind knowledge.LatticeKind) (knowledge.ReadToken, knowledge.LatticeGeneration, knowledge.EmbeddingSpace, error) {
	state, err := s.latticeState(nil, projectID, kind)
	if err != nil {
		return knowledge.ReadToken{}, knowledge.LatticeGeneration{}, knowledge.EmbeddingSpace{}, knowledge.ErrEmbeddingSpaceUnavailable
	}
	if state.ActiveGenerationID != "" {
		return s.Active(projectID, kind)
	}
	generation, err := s.reembedRequiredGeneration(nil, projectID, kind)
	if err != nil {
		return knowledge.ReadToken{}, knowledge.LatticeGeneration{}, knowledge.EmbeddingSpace{}, knowledge.ErrEmbeddingSpaceUnavailable
	}
	token := tokenFromState(state)
	token.GenerationID = generation.ID
	return token, generation, knowledge.EmbeddingSpace{}, nil
}

func (s *Store) EnsureActive(projectID string, kind knowledge.LatticeKind, generation knowledge.LatticeGeneration, space knowledge.EmbeddingSpace) (knowledge.ReadToken, knowledge.LatticeGeneration, error) {
	if projectID == "" || kind == "" || generation.ID == "" || space.Validate() != nil {
		return knowledge.ReadToken{}, knowledge.LatticeGeneration{}, knowledge.ErrGenerationConflict
	}
	tx, err := s.db.Begin()
	if err != nil {
		return knowledge.ReadToken{}, knowledge.LatticeGeneration{}, err
	}
	defer tx.Rollback()
	state, stateErr := s.latticeState(tx, projectID, kind)
	if stateErr == nil {
		if state.ActiveGenerationID == "" {
			return knowledge.ReadToken{}, knowledge.LatticeGeneration{}, knowledge.ErrEmbeddingSpaceChangeRequired
		}
		active, err := s.generation(tx, state.ActiveGenerationID)
		if err != nil {
			return knowledge.ReadToken{}, knowledge.LatticeGeneration{}, err
		}
		if active.SpaceIdentity != space.Identity() {
			return knowledge.ReadToken{}, knowledge.LatticeGeneration{}, knowledge.ErrEmbeddingSpaceChangeRequired
		}
		return tokenFromState(state), active, nil
	}
	if stateErr != nil && !errors.Is(stateErr, sql.ErrNoRows) {
		return knowledge.ReadToken{}, knowledge.LatticeGeneration{}, stateErr
	}
	if generation.CreatedAt.IsZero() {
		generation.CreatedAt = time.Now().UTC()
	}
	generation.ProjectID, generation.Kind = projectID, kind
	generation.SpaceIdentity, generation.State = space.Identity(), knowledge.GenerationActive
	generation.PromotedAt = timePointerSQL(generation.CreatedAt)
	if err := insertSpaceTx(tx, space); err != nil {
		return knowledge.ReadToken{}, knowledge.LatticeGeneration{}, err
	}
	if err := insertGenerationTx(tx, generation); err != nil {
		return knowledge.ReadToken{}, knowledge.LatticeGeneration{}, err
	}
	state = knowledge.ProjectLatticeState{
		ProjectID: projectID, Kind: kind, ActiveGenerationID: generation.ID,
		Revision: 1, UpdatedAt: generation.CreatedAt,
	}
	if _, err := tx.Exec(`INSERT INTO knowledge_lattice_state(
			project_id,kind,active_generation_id,previous_generation_id,revision,source_cursor,updated_at
		) VALUES(?,?,?,?,?,?,?)
		ON CONFLICT(project_id,kind) DO UPDATE SET active_generation_id=excluded.active_generation_id,
			revision=excluded.revision,updated_at=excluded.updated_at`,
		projectID, string(kind), generation.ID, "", state.Revision, 0, state.UpdatedAt.Format(timeLayout)); err != nil {
		return knowledge.ReadToken{}, knowledge.LatticeGeneration{}, err
	}
	if err := tx.Commit(); err != nil {
		return knowledge.ReadToken{}, knowledge.LatticeGeneration{}, err
	}
	return tokenFromState(state), generation, nil
}

func (s *Store) Current(token knowledge.ReadToken) (bool, error) {
	state, err := s.latticeState(nil, token.ProjectID, token.Kind)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return token.Equal(tokenFromState(state)), nil
}

func (s *Store) AdmitAndReplaceActive(token knowledge.ReadToken, maxArtifacts int, writes []knowledge.SourceWrite, at time.Time) (knowledge.ArtifactCounts, knowledge.ReadToken, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return knowledge.ArtifactCounts{}, knowledge.ReadToken{}, err
	}
	defer tx.Rollback()
	state, err := s.requireActiveTx(tx, token)
	if err != nil {
		return knowledge.ArtifactCounts{}, knowledge.ReadToken{}, err
	}
	if len(writes) == 0 {
		return knowledge.ArtifactCounts{}, tokenFromState(state), nil
	}
	active, err := s.generation(tx, state.ActiveGenerationID)
	if err != nil {
		return knowledge.ArtifactCounts{}, knowledge.ReadToken{}, err
	}
	space, err := s.space(tx, active.SpaceIdentity)
	if err != nil {
		return knowledge.ArtifactCounts{}, knowledge.ReadToken{}, knowledge.ErrEmbeddingSpaceUnavailable
	}
	operations := make([]string, len(writes))
	for i, write := range writes {
		if write.Source.ProjectID != token.ProjectID {
			return knowledge.ArtifactCounts{}, knowledge.ReadToken{}, knowledge.ErrGenerationConflict
		}
		if !sourceWriteMatchesSpace(write, space) {
			return knowledge.ArtifactCounts{}, knowledge.ReadToken{}, knowledge.ErrEmbeddingSpaceChangeRequired
		}
		var exists int
		if err := tx.QueryRow(`SELECT COUNT(*) FROM knowledge_sources
			WHERE generation_id=? AND project_id=? AND source_type=? AND source_id=?`,
			state.ActiveGenerationID, token.ProjectID, write.Source.SourceType, write.Source.SourceID).Scan(&exists); err != nil {
			return knowledge.ArtifactCounts{}, knowledge.ReadToken{}, err
		}
		if exists > 0 {
			operations[i] = knowledge.SourceUpdated
		} else {
			operations[i] = knowledge.SourceAdded
		}
	}
	counts, err := admittedSourceCountsTx(tx, state.ActiveGenerationID, token.ProjectID, maxArtifacts, writes)
	if err != nil {
		return counts, knowledge.ReadToken{}, err
	}
	if err := replaceSourcesTx(tx, state.ActiveGenerationID, writes); err != nil {
		return counts, knowledge.ReadToken{}, err
	}
	for i, write := range writes {
		state.SourceCursor++
		if _, err := tx.Exec(`INSERT INTO knowledge_source_changes(
				project_id,kind,cursor,generation_id,operation,source_type,source_id,revision,content_hash,occurred_at
			) VALUES(?,?,?,?,?,?,?,?,?,?)`,
			token.ProjectID, string(token.Kind), state.SourceCursor, state.ActiveGenerationID,
			operations[i], write.Source.SourceType, write.Source.SourceID, write.Source.Revision,
			write.Source.ContentHash, at.Format(timeLayout)); err != nil {
			return counts, knowledge.ReadToken{}, err
		}
	}
	state.UpdatedAt = at
	if err := updateLatticeStateTx(tx, state); err != nil {
		return counts, knowledge.ReadToken{}, err
	}
	if err := s.refreshGenerationCountsTx(tx, state.ActiveGenerationID, state.SourceCursor); err != nil {
		return counts, knowledge.ReadToken{}, err
	}
	if err := tx.Commit(); err != nil {
		return counts, knowledge.ReadToken{}, err
	}
	return counts, tokenFromState(state), nil
}

func (s *Store) DeleteActive(token knowledge.ReadToken, sourceType, sourceID string, at time.Time) (bool, knowledge.ReadToken, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return false, knowledge.ReadToken{}, err
	}
	defer tx.Rollback()
	state, err := s.requireActiveTx(tx, token)
	if err != nil {
		return false, knowledge.ReadToken{}, err
	}
	var ref, hash string
	var revision int64
	err = tx.QueryRow(`SELECT local_ref_id,revision,content_hash FROM knowledge_sources
		WHERE generation_id=? AND project_id=? AND source_type=? AND source_id=?`,
		state.ActiveGenerationID, token.ProjectID, sourceType, sourceID).Scan(&ref, &revision, &hash)
	if errors.Is(err, sql.ErrNoRows) {
		return false, tokenFromState(state), nil
	}
	if err != nil {
		return false, knowledge.ReadToken{}, err
	}
	if err := deleteSourceLatticeTx(tx, state.ActiveGenerationID, ref); err != nil {
		return false, knowledge.ReadToken{}, err
	}
	if err := invalidateCorpusTx(tx, state.ActiveGenerationID, token.ProjectID); err != nil {
		return false, knowledge.ReadToken{}, err
	}
	state.SourceCursor++
	state.UpdatedAt = at
	if _, err := tx.Exec(`INSERT INTO knowledge_source_changes(
			project_id,kind,cursor,generation_id,operation,source_type,source_id,revision,content_hash,occurred_at
		) VALUES(?,?,?,?,?,?,?,?,?,?)`,
		token.ProjectID, string(token.Kind), state.SourceCursor, state.ActiveGenerationID,
		knowledge.SourceRemoved, sourceType, sourceID, revision, hash, at.Format(timeLayout)); err != nil {
		return false, knowledge.ReadToken{}, err
	}
	if err := updateLatticeStateTx(tx, state); err != nil {
		return false, knowledge.ReadToken{}, err
	}
	if err := s.refreshGenerationCountsTx(tx, state.ActiveGenerationID, state.SourceCursor); err != nil {
		return false, knowledge.ReadToken{}, err
	}
	if err := tx.Commit(); err != nil {
		return false, knowledge.ReadToken{}, err
	}
	return true, tokenFromState(state), nil
}

func (s *Store) ChangedSince(projectID string, kind knowledge.LatticeKind, since time.Time) (bool, error) {
	rows, err := s.db.Query(`SELECT occurred_at FROM knowledge_source_changes
		WHERE project_id=? AND kind=?
		UNION ALL
		SELECT updated_at FROM knowledge_lattice_state WHERE project_id=? AND kind=?`,
		projectID, string(kind), projectID, string(kind))
	if err != nil {
		return false, err
	}
	defer rows.Close()
	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			return false, err
		}
		if changedAt, err := time.Parse(timeLayout, raw); err != nil {
			return false, err
		} else if changedAt.After(since) {
			return true, nil
		}
	}
	return false, rows.Err()
}

func (s *Store) SourceChangesAfter(projectID string, kind knowledge.LatticeKind, cursor int64, limit int) ([]knowledge.SourceChange, error) {
	if limit <= 0 {
		limit = 1000
	}
	rows, err := s.db.Query(`SELECT project_id,kind,cursor,operation,source_type,source_id,
			revision,content_hash,occurred_at
		FROM knowledge_source_changes
		WHERE project_id=? AND kind=? AND cursor>? ORDER BY cursor LIMIT ?`,
		projectID, string(kind), cursor, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []knowledge.SourceChange
	for rows.Next() {
		var change knowledge.SourceChange
		var kindRaw, occurred string
		if err := rows.Scan(&change.ProjectID, &kindRaw, &change.Cursor, &change.Operation,
			&change.SourceType, &change.SourceID, &change.Revision, &change.ContentHash, &occurred); err != nil {
			return nil, err
		}
		change.Kind = knowledge.LatticeKind(kindRaw)
		change.OccurredAt, err = time.Parse(timeLayout, occurred)
		if err != nil {
			return nil, err
		}
		out = append(out, change)
	}
	return out, rows.Err()
}

func (s *Store) requireActiveTx(tx *sql.Tx, token knowledge.ReadToken) (knowledge.ProjectLatticeState, error) {
	state, err := s.latticeState(tx, token.ProjectID, token.Kind)
	if err != nil || state.ActiveGenerationID != token.GenerationID || state.Revision != token.StateRevision {
		return knowledge.ProjectLatticeState{}, knowledge.ErrGenerationConflict
	}
	generation, err := s.generation(tx, state.ActiveGenerationID)
	if err != nil || generation.ProjectID != token.ProjectID || generation.Kind != token.Kind ||
		generation.State != knowledge.GenerationActive {
		return knowledge.ProjectLatticeState{}, knowledge.ErrGenerationConflict
	}
	return state, nil
}

func sourceWriteMatchesSpace(write knowledge.SourceWrite, space knowledge.EmbeddingSpace) bool {
	if write.Source.Identity != space.VectorIdentity() {
		return false
	}
	for _, window := range write.Windows {
		if len(window.Embedding) != space.Dimensions {
			return false
		}
	}
	for _, node := range write.Nodes {
		if len(node.Centroid) != space.Dimensions {
			return false
		}
	}
	return true
}

func updateLatticeStateTx(tx *sql.Tx, state knowledge.ProjectLatticeState) error {
	result, err := tx.Exec(`UPDATE knowledge_lattice_state
		SET active_generation_id=?,previous_generation_id=?,revision=?,source_cursor=?,updated_at=?
		WHERE project_id=? AND kind=?`,
		state.ActiveGenerationID, state.PreviousGenerationID, state.Revision, state.SourceCursor,
		state.UpdatedAt.Format(timeLayout), state.ProjectID, string(state.Kind))
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err != nil || n != 1 {
		return knowledge.ErrGenerationConflict
	}
	return nil
}

func admittedSourceCountsTx(tx *sql.Tx, generationID, projectID string, maxArtifacts int, writes []knowledge.SourceWrite) (knowledge.ArtifactCounts, error) {
	counts, err := sourceArtifactCountsTx(tx, generationID, projectID)
	if err != nil {
		return knowledge.ArtifactCounts{}, err
	}
	var out knowledge.ArtifactCounts
	for _, count := range counts {
		out.Current += count
	}
	replacing := map[string]bool{}
	for _, write := range writes {
		if !replacing[write.Source.LocalRefID] {
			out.Replaced += counts[write.Source.LocalRefID]
			replacing[write.Source.LocalRefID] = true
		}
		out.Candidate += int64(len(write.Windows) + len(write.Nodes))
	}
	out.Total = out.Current - out.Replaced + out.Candidate
	if maxArtifacts > 0 && out.Total > int64(maxArtifacts) {
		return out, knowledge.ArtifactLimitExceeded(projectID, int64(maxArtifacts), out.Total)
	}
	return out, nil
}

func (s *Store) refreshGenerationCountsTx(tx *sql.Tx, generationID string, watermark int64) error {
	generation, err := s.generation(tx, generationID)
	if err != nil {
		return err
	}
	var sources, windows, nodes int
	if err := tx.QueryRow(`SELECT COUNT(*) FROM knowledge_sources WHERE generation_id=?`, generationID).Scan(&sources); err != nil {
		return err
	}
	if err := tx.QueryRow(`SELECT COUNT(*) FROM knowledge_windows WHERE generation_id=?`, generationID).Scan(&windows); err != nil {
		return err
	}
	if err := tx.QueryRow(`SELECT COUNT(*) FROM knowledge_nodes WHERE generation_id=?`, generationID).Scan(&nodes); err != nil {
		return err
	}
	generation.SourceCount = sources
	generation.ArtifactCount = windows + nodes
	generation.SourceWatermark = watermark
	return insertGenerationTx(tx, generation)
}

func (s *Store) SaveReembedPreview(preview knowledge.ReembedPreview) error {
	if preview.ID == "" || preview.ProjectID == "" || preview.Kind == "" || preview.ToSpace.Validate() != nil {
		return knowledge.ErrGenerationConflict
	}
	raw, err := marshalJSON(preview)
	if err != nil {
		return err
	}
	result, err := s.db.Exec(`INSERT INTO knowledge_reembed_previews(id,project_id,kind,record)
		VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING`,
		preview.ID, preview.ProjectID, string(preview.Kind), raw)
	if err != nil {
		return err
	}
	if n, _ := result.RowsAffected(); n == 1 {
		return nil
	}
	existing, err := s.ReembedPreview(preview.ProjectID, preview.ID)
	if err == nil && sameJSON(existing, preview) {
		return nil
	}
	return knowledge.ErrGenerationConflict
}

func (s *Store) ReembedPreview(projectID, previewID string) (knowledge.ReembedPreview, error) {
	var raw string
	err := s.db.QueryRow(`SELECT record FROM knowledge_reembed_previews WHERE id=? AND project_id=?`,
		previewID, projectID).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return knowledge.ReembedPreview{}, knowledge.ErrReembedNotFound
	}
	var preview knowledge.ReembedPreview
	if err == nil {
		err = unmarshalJSON(raw, &preview)
	}
	return preview, err
}

func (s *Store) StartReembed(previewID string, run knowledge.ReembedRun, generation knowledge.LatticeGeneration) (knowledge.ReembedRun, bool, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return knowledge.ReembedRun{}, false, err
	}
	defer tx.Rollback()
	var raw string
	if err := tx.QueryRow(`SELECT record FROM knowledge_reembed_previews WHERE id=?`, previewID).Scan(&raw); errors.Is(err, sql.ErrNoRows) {
		return knowledge.ReembedRun{}, false, knowledge.ErrReembedNotFound
	} else if err != nil {
		return knowledge.ReembedRun{}, false, err
	}
	var preview knowledge.ReembedPreview
	if err := unmarshalJSON(raw, &preview); err != nil {
		return knowledge.ReembedRun{}, false, err
	}
	var existingRaw string
	err = tx.QueryRow(`SELECT record FROM knowledge_reembed_runs
		WHERE project_id=? AND kind=? AND idempotency_key=?`,
		preview.ProjectID, string(preview.Kind), run.IdempotencyKey).Scan(&existingRaw)
	if err == nil {
		var existing knowledge.ReembedRun
		if err := unmarshalJSON(existingRaw, &existing); err != nil {
			return knowledge.ReembedRun{}, false, err
		}
		return existing, true, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return knowledge.ReembedRun{}, false, err
	}
	state, err := s.latticeState(tx, preview.ProjectID, preview.Kind)
	if err != nil || state.Revision != preview.ExpectedStateRevision ||
		state.SourceCursor != preview.SourceCursor {
		return knowledge.ReembedRun{}, false, knowledge.ErrReembedPreviewStale
	}
	baseGenerationID := state.ActiveGenerationID
	if baseGenerationID == "" {
		base, err := s.reembedRequiredGeneration(tx, preview.ProjectID, preview.Kind)
		if err != nil {
			return knowledge.ReembedRun{}, false, knowledge.ErrReembedPreviewStale
		}
		baseGenerationID = base.ID
	}
	if baseGenerationID != preview.FromGenerationID {
		return knowledge.ReembedRun{}, false, knowledge.ErrReembedPreviewStale
	}
	if run.ID == "" || run.IdempotencyKey == "" || generation.ID == "" {
		return knowledge.ReembedRun{}, false, knowledge.ErrGenerationConflict
	}
	var collisions int
	if err := tx.QueryRow(`SELECT
			(SELECT COUNT(*) FROM knowledge_reembed_runs WHERE id=?) +
			(SELECT COUNT(*) FROM knowledge_generations WHERE id=?)`,
		run.ID, generation.ID).Scan(&collisions); err != nil {
		return knowledge.ReembedRun{}, false, err
	}
	if collisions != 0 {
		return knowledge.ReembedRun{}, false, knowledge.ErrGenerationConflict
	}
	startedAt := run.CreatedAt
	if startedAt.IsZero() {
		startedAt = generation.CreatedAt
	}
	if startedAt.IsZero() {
		startedAt = time.Now().UTC()
	}
	if !preview.ExpiresAt.IsZero() && !startedAt.Before(preview.ExpiresAt) {
		return knowledge.ReembedRun{}, false, knowledge.ErrReembedPreviewStale
	}
	run.ProjectID, run.Kind, run.PreviewID = preview.ProjectID, preview.Kind, preview.ID
	run.FromGenerationID = preview.FromGenerationID
	run.TargetGenerationID, run.TargetSpace = generation.ID, preview.ToSpace
	run.Status, run.ExpectedRevision = knowledge.ReembedQueued, preview.ExpectedStateRevision
	run.StartCursor, run.CaughtUpCursor = preview.SourceCursor, preview.SourceCursor
	run.Policy, run.SourcesTotal = preview.Policy, preview.Sources
	run.CreatedAt = startedAt
	run.UpdatedAt = run.CreatedAt
	generation.ProjectID, generation.Kind = preview.ProjectID, preview.Kind
	generation.SpaceIdentity, generation.State = preview.ToSpace.Identity(), knowledge.GenerationBuilding
	generation.SourceWatermark = preview.SourceCursor
	if generation.CreatedAt.IsZero() {
		generation.CreatedAt = run.CreatedAt
	}
	if err := insertSpaceTx(tx, preview.ToSpace); err != nil {
		return knowledge.ReembedRun{}, false, err
	}
	if err := insertGenerationTx(tx, generation); err != nil {
		return knowledge.ReembedRun{}, false, err
	}
	if err := saveRunTx(tx, run); err != nil {
		return knowledge.ReembedRun{}, false, err
	}
	if err := tx.Commit(); err != nil {
		return knowledge.ReembedRun{}, false, storageConflict(err)
	}
	return run, false, nil
}

func (s *Store) ReembedRun(projectID, runID string) (knowledge.ReembedRun, error) {
	run, err := s.loadRun(nil, runID)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && run.ProjectID != projectID) {
		return knowledge.ReembedRun{}, knowledge.ErrReembedNotFound
	}
	return run, err
}

func (s *Store) SetReembedControl(projectID, runID string, control knowledge.ReembedControl, at time.Time) (knowledge.ReembedRun, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return knowledge.ReembedRun{}, err
	}
	defer tx.Rollback()
	run, err := s.loadRun(tx, runID)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && run.ProjectID != projectID) {
		return knowledge.ReembedRun{}, knowledge.ErrReembedNotFound
	}
	if err != nil {
		return knowledge.ReembedRun{}, err
	}
	switch control {
	case knowledge.ControlPause:
		switch run.Status {
		case knowledge.ReembedQueued:
			run.Status = knowledge.ReembedPaused
		case knowledge.ReembedRunning:
			run.Status = knowledge.ReembedPausing
		case knowledge.ReembedPausing:
			run.Status = knowledge.ReembedPaused
		case knowledge.ReembedPaused:
			return run, nil
		default:
			return knowledge.ReembedRun{}, knowledge.ErrGenerationConflict
		}
	case knowledge.ControlResume:
		if run.Status != knowledge.ReembedPaused && run.Status != knowledge.ReembedPausing {
			return knowledge.ReembedRun{}, knowledge.ErrGenerationConflict
		}
		run.Status = knowledge.ReembedQueued
	case knowledge.ControlCancel:
		if run.Status == knowledge.ReembedCancelled {
			return run, nil
		}
		if terminalReembedStatus(run.Status) {
			return knowledge.ReembedRun{}, knowledge.ErrGenerationConflict
		}
		run.Status = knowledge.ReembedCancelled
		generation, err := s.generation(tx, run.TargetGenerationID)
		if err != nil {
			return knowledge.ReembedRun{}, err
		}
		generation.State = knowledge.GenerationFailed
		if err := insertGenerationTx(tx, generation); err != nil {
			return knowledge.ReembedRun{}, err
		}
	default:
		return knowledge.ReembedRun{}, knowledge.ErrGenerationConflict
	}
	run.UpdatedAt = at
	if err := saveRunTx(tx, run); err != nil {
		return knowledge.ReembedRun{}, err
	}
	return run, tx.Commit()
}

func (s *Store) ClaimReembed(runID string, at time.Time) (knowledge.ReembedRun, bool, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return knowledge.ReembedRun{}, false, err
	}
	defer tx.Rollback()
	run, err := s.loadRun(tx, runID)
	if errors.Is(err, sql.ErrNoRows) {
		return knowledge.ReembedRun{}, false, knowledge.ErrReembedNotFound
	}
	if err != nil {
		return knowledge.ReembedRun{}, false, err
	}
	claimed := false
	switch run.Status {
	case knowledge.ReembedQueued:
		run.Status, claimed = knowledge.ReembedRunning, true
	case knowledge.ReembedPausing:
		run.Status = knowledge.ReembedPaused
	case knowledge.ReembedCancelled, knowledge.ReembedCancelling:
		return run, false, knowledge.ErrReembedCancelled
	default:
		return run, false, nil
	}
	run.UpdatedAt = at
	if err := saveRunTx(tx, run); err != nil {
		return knowledge.ReembedRun{}, false, err
	}
	if err := tx.Commit(); err != nil {
		return knowledge.ReembedRun{}, false, err
	}
	return run, claimed, nil
}

func (s *Store) RecoverReembeds(at time.Time) ([]knowledge.ReembedRun, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	rows, err := tx.Query(`SELECT record FROM knowledge_reembed_runs
		WHERE status IN (?,?,?,?) ORDER BY project_id,kind,id`,
		string(knowledge.ReembedRunning), string(knowledge.ReembedValidating),
		string(knowledge.ReembedPausing), string(knowledge.ReembedQueued))
	if err != nil {
		return nil, err
	}
	var runs []knowledge.ReembedRun
	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			rows.Close()
			return nil, err
		}
		var run knowledge.ReembedRun
		if err := unmarshalJSON(raw, &run); err != nil {
			rows.Close()
			return nil, err
		}
		switch run.Status {
		case knowledge.ReembedRunning, knowledge.ReembedValidating:
			run.Status = knowledge.ReembedQueued
		case knowledge.ReembedPausing:
			run.Status = knowledge.ReembedPaused
		}
		run.UpdatedAt = at
		if err := saveRunTx(tx, run); err != nil {
			rows.Close()
			return nil, err
		}
		if run.Status == knowledge.ReembedQueued {
			runs = append(runs, run)
		}
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return runs, nil
}

func (s *Store) ReembedCheckpoints(runID string) ([]knowledge.ReembedCheckpoint, error) {
	if _, err := s.loadRun(nil, runID); errors.Is(err, sql.ErrNoRows) {
		return nil, knowledge.ErrReembedNotFound
	} else if err != nil {
		return nil, err
	}
	rows, err := s.db.Query(`SELECT record FROM knowledge_reembed_checkpoints
		WHERE run_id=? ORDER BY source_type,source_id`, runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []knowledge.ReembedCheckpoint
	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		var checkpoint knowledge.ReembedCheckpoint
		if err := unmarshalJSON(raw, &checkpoint); err != nil {
			return nil, err
		}
		out = append(out, checkpoint)
	}
	return out, rows.Err()
}

func (s *Store) CommitReembedCheckpoint(runID string, checkpoint knowledge.ReembedCheckpoint, write *knowledge.SourceWrite, maxArtifacts int, at time.Time) (knowledge.ReembedRun, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return knowledge.ReembedRun{}, err
	}
	defer tx.Rollback()
	run, err := s.loadRun(tx, runID)
	if errors.Is(err, sql.ErrNoRows) {
		return knowledge.ReembedRun{}, knowledge.ErrReembedNotFound
	}
	if err != nil {
		return knowledge.ReembedRun{}, err
	}
	if run.Status == knowledge.ReembedCancelled || run.Status == knowledge.ReembedCancelling {
		return knowledge.ReembedRun{}, knowledge.ErrReembedCancelled
	}
	if run.Status != knowledge.ReembedRunning || checkpoint.SourceType == "" || checkpoint.SourceID == "" {
		return knowledge.ReembedRun{}, knowledge.ErrGenerationConflict
	}
	if checkpoint.Status != "complete" && checkpoint.Status != "skipped" && checkpoint.Status != "failed" {
		return knowledge.ReembedRun{}, knowledge.ErrGenerationConflict
	}
	if (checkpoint.Status == "complete") != (write != nil) {
		return knowledge.ReembedRun{}, knowledge.ErrGenerationConflict
	}
	var old knowledge.ReembedCheckpoint
	var oldRaw string
	err = tx.QueryRow(`SELECT record FROM knowledge_reembed_checkpoints
		WHERE run_id=? AND source_type=? AND source_id=?`,
		runID, checkpoint.SourceType, checkpoint.SourceID).Scan(&oldRaw)
	if err == nil {
		if err := unmarshalJSON(oldRaw, &old); err != nil {
			return knowledge.ReembedRun{}, err
		}
		if old.Status == "complete" && checkpoint.Status == "complete" &&
			old.Revision == checkpoint.Revision && old.ContentHash == checkpoint.ContentHash {
			return run, nil
		}
		removeCheckpointTotalsSQL(&run, old)
	} else if !errors.Is(err, sql.ErrNoRows) {
		return knowledge.ReembedRun{}, err
	}
	checkpoint.RunID, checkpoint.UpdatedAt = runID, at
	addCheckpointTotalsSQL(&run, checkpoint)
	if write != nil {
		if write.Source.ProjectID != run.ProjectID || write.Source.SourceType != checkpoint.SourceType ||
			write.Source.SourceID != checkpoint.SourceID || write.Source.Revision != checkpoint.Revision ||
			write.Source.ContentHash != checkpoint.ContentHash ||
			!sourceWriteMatchesSpace(*write, run.TargetSpace) {
			return knowledge.ReembedRun{}, knowledge.ErrGenerationConflict
		}
		if _, err := admittedSourceCountsTx(tx, run.TargetGenerationID, run.ProjectID, maxArtifacts, []knowledge.SourceWrite{*write}); err != nil {
			return knowledge.ReembedRun{}, err
		}
		if err := replaceSourcesTx(tx, run.TargetGenerationID, []knowledge.SourceWrite{*write}); err != nil {
			return knowledge.ReembedRun{}, err
		}
	}
	checkpointRaw, err := marshalJSON(checkpoint)
	if err != nil {
		return knowledge.ReembedRun{}, err
	}
	if _, err := tx.Exec(`INSERT INTO knowledge_reembed_checkpoints(run_id,source_type,source_id,record)
		VALUES(?,?,?,?) ON CONFLICT(run_id,source_type,source_id) DO UPDATE SET record=excluded.record`,
		runID, checkpoint.SourceType, checkpoint.SourceID, checkpointRaw); err != nil {
		return knowledge.ReembedRun{}, err
	}
	run.UpdatedAt = at
	if err := saveRunTx(tx, run); err != nil {
		return knowledge.ReembedRun{}, err
	}
	if err := s.refreshGenerationCountsTx(tx, run.TargetGenerationID, run.CaughtUpCursor); err != nil {
		return knowledge.ReembedRun{}, err
	}
	return run, tx.Commit()
}

func (s *Store) DeleteReembedCheckpoint(runID, sourceType, sourceID string, at time.Time) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	run, err := s.loadRun(tx, runID)
	if errors.Is(err, sql.ErrNoRows) {
		return knowledge.ErrReembedNotFound
	}
	if err != nil {
		return err
	}
	if run.Status != knowledge.ReembedRunning && run.Status != knowledge.ReembedValidating {
		return knowledge.ErrGenerationConflict
	}
	var raw string
	if err := tx.QueryRow(`SELECT record FROM knowledge_reembed_checkpoints
		WHERE run_id=? AND source_type=? AND source_id=?`,
		runID, sourceType, sourceID).Scan(&raw); err == nil {
		var checkpoint knowledge.ReembedCheckpoint
		if err := unmarshalJSON(raw, &checkpoint); err != nil {
			return err
		}
		removeCheckpointTotalsSQL(&run, checkpoint)
	} else if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM knowledge_reembed_checkpoints
		WHERE run_id=? AND source_type=? AND source_id=?`, runID, sourceType, sourceID); err != nil {
		return err
	}
	var ref string
	err = tx.QueryRow(`SELECT local_ref_id FROM knowledge_sources
		WHERE generation_id=? AND project_id=? AND source_type=? AND source_id=?`,
		run.TargetGenerationID, run.ProjectID, sourceType, sourceID).Scan(&ref)
	if err == nil {
		if err := deleteSourceLatticeTx(tx, run.TargetGenerationID, ref); err != nil {
			return err
		}
		if err := invalidateCorpusTx(tx, run.TargetGenerationID, run.ProjectID); err != nil {
			return err
		}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	run.UpdatedAt = at
	if err := saveRunTx(tx, run); err != nil {
		return err
	}
	if err := s.refreshGenerationCountsTx(tx, run.TargetGenerationID, run.CaughtUpCursor); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) MarkReembedReady(runID string, sourceWatermark int64, validation knowledge.Validation, corpus []knowledge.Node, indexes []knowledge.CorpusLevelIndex, at time.Time) (knowledge.ReembedRun, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return knowledge.ReembedRun{}, err
	}
	defer tx.Rollback()
	run, err := s.loadRun(tx, runID)
	if errors.Is(err, sql.ErrNoRows) {
		return knowledge.ReembedRun{}, knowledge.ErrReembedNotFound
	}
	if err != nil {
		return knowledge.ReembedRun{}, err
	}
	if run.Status == knowledge.ReembedCancelled || run.Status == knowledge.ReembedCancelling {
		return knowledge.ReembedRun{}, knowledge.ErrReembedCancelled
	}
	if run.Status != knowledge.ReembedRunning && run.Status != knowledge.ReembedValidating {
		return knowledge.ReembedRun{}, knowledge.ErrGenerationConflict
	}
	state, err := s.latticeState(tx, run.ProjectID, run.Kind)
	if err != nil {
		return knowledge.ReembedRun{}, err
	}
	if sourceWatermark != state.SourceCursor {
		return knowledge.ReembedRun{}, knowledge.ErrReembedSourceChanged
	}
	var dirty int64
	if err := tx.QueryRow(`SELECT dirty_seq FROM knowledge_corpus_state
		WHERE generation_id=? AND project_id=?`, run.TargetGenerationID, run.ProjectID).Scan(&dirty); errors.Is(err, sql.ErrNoRows) {
		dirty = 0
	} else if err != nil {
		return knowledge.ReembedRun{}, err
	}
	if err := rebuildCorpusTx(tx, run.TargetGenerationID, run.ProjectID, corpus, dirty, indexes); err != nil {
		return knowledge.ReembedRun{}, err
	}
	sources, windows, nodes, err := generationCountsTx(tx, run.TargetGenerationID, run.ProjectID)
	if err != nil {
		return knowledge.ReembedRun{}, err
	}
	if run.SourcesCompleted != sources {
		return knowledge.ReembedRun{}, knowledge.ErrReembedIncomplete
	}
	vectorsValid, err := generationVectorsMatchSpaceTx(
		tx, run.TargetGenerationID, run.ProjectID, run.TargetSpace.Dimensions)
	if err != nil {
		return knowledge.ReembedRun{}, err
	}
	if !validation.Complete || validation.SpaceIdentity != run.TargetSpace.Identity() ||
		validation.SourceWatermark != sourceWatermark || validation.SourceCount != sources ||
		validation.WindowCount != windows || validation.NodeCount != nodes ||
		validation.ArtifactCount != windows+nodes || !vectorsValid ||
		(sources > 0 && validation.ProbeCount <= 0) {
		return knowledge.ReembedRun{}, knowledge.ErrReembedValidationFailed
	}
	run.Status, run.CaughtUpCursor, run.Validation = knowledge.ReembedReady, sourceWatermark, validation
	run.SourcesTotal = run.SourcesCompleted + run.SourcesSkipped
	run.UpdatedAt = at
	if err := saveRunTx(tx, run); err != nil {
		return knowledge.ReembedRun{}, err
	}
	generation, err := s.generation(tx, run.TargetGenerationID)
	if err != nil {
		return knowledge.ReembedRun{}, err
	}
	generation.State, generation.SourceWatermark = knowledge.GenerationReady, sourceWatermark
	generation.SourceCount, generation.ArtifactCount, generation.Validation = sources, windows+nodes, validation
	if err := insertGenerationTx(tx, generation); err != nil {
		return knowledge.ReembedRun{}, err
	}
	return run, tx.Commit()
}

func (s *Store) FailReembed(runID string, code, detail string, at time.Time) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	run, err := s.loadRun(tx, runID)
	if errors.Is(err, sql.ErrNoRows) {
		return knowledge.ErrReembedNotFound
	}
	if err != nil {
		return err
	}
	if run.Status == knowledge.ReembedPromoted || run.Status == knowledge.ReembedRolledBack {
		return knowledge.ErrGenerationConflict
	}
	run.Status, run.LastErrorCode, run.LastError = knowledge.ReembedFailed, code, detail
	run.UpdatedAt = at
	if err := saveRunTx(tx, run); err != nil {
		return err
	}
	generation, err := s.generation(tx, run.TargetGenerationID)
	if err != nil {
		return err
	}
	generation.State = knowledge.GenerationFailed
	if err := insertGenerationTx(tx, generation); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) PromoteReembed(projectID, runID, actorID string, expectedRevision int64, rollbackUntil, at time.Time) (knowledge.ProjectLatticeState, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return knowledge.ProjectLatticeState{}, err
	}
	defer tx.Rollback()
	run, err := s.loadRun(tx, runID)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && run.ProjectID != projectID) {
		return knowledge.ProjectLatticeState{}, knowledge.ErrReembedNotFound
	}
	if err != nil {
		return knowledge.ProjectLatticeState{}, err
	}
	state, err := s.latticeState(tx, projectID, run.Kind)
	if err != nil || state.Revision != expectedRevision || run.ExpectedRevision != expectedRevision {
		return knowledge.ProjectLatticeState{}, knowledge.ErrGenerationConflict
	}
	if run.Status != knowledge.ReembedReady || !run.Validation.Complete {
		return knowledge.ProjectLatticeState{}, knowledge.ErrReembedIncomplete
	}
	if state.SourceCursor != run.CaughtUpCursor || run.Validation.SourceWatermark != state.SourceCursor {
		return knowledge.ProjectLatticeState{}, knowledge.ErrReembedSourceChanged
	}
	target, err := s.generation(tx, run.TargetGenerationID)
	if err != nil || target.State != knowledge.GenerationReady || target.SourceWatermark != state.SourceCursor {
		return knowledge.ProjectLatticeState{}, knowledge.ErrReembedValidationFailed
	}
	if state.ActiveGenerationID != "" {
		previous, err := s.generation(tx, state.ActiveGenerationID)
		if err != nil {
			return knowledge.ProjectLatticeState{}, err
		}
		previous.State, previous.RetiredAt, previous.RollbackExpiresAt =
			knowledge.GenerationRetired, timePointerSQL(at), timePointerSQL(rollbackUntil)
		if err := insertGenerationTx(tx, previous); err != nil {
			return knowledge.ProjectLatticeState{}, err
		}
	}
	target.State, target.PromotedAt = knowledge.GenerationActive, timePointerSQL(at)
	target.RetiredAt, target.RollbackExpiresAt = nil, nil
	if err := insertGenerationTx(tx, target); err != nil {
		return knowledge.ProjectLatticeState{}, err
	}
	state.PreviousGenerationID, state.ActiveGenerationID = state.ActiveGenerationID, target.ID
	state.Revision++
	state.UpdatedAt = at
	if err := updateLatticeStateTx(tx, state); err != nil {
		return knowledge.ProjectLatticeState{}, err
	}
	run.Status, run.UpdatedAt = knowledge.ReembedPromoted, at
	if err := saveRunTx(tx, run); err != nil {
		return knowledge.ProjectLatticeState{}, err
	}
	if err := appendGenerationEventTx(tx, knowledge.GenerationEvent{
		ID: legacyGenerationID(runID + at.String()), ProjectID: projectID, Kind: run.Kind,
		GenerationID: target.ID, Type: "promoted", ActorID: actorID,
		StateRevision: state.Revision, OccurredAt: at,
	}); err != nil {
		return knowledge.ProjectLatticeState{}, err
	}
	if err := tx.Commit(); err != nil {
		return knowledge.ProjectLatticeState{}, err
	}
	return state, nil
}

func (s *Store) RollbackGeneration(projectID string, kind knowledge.LatticeKind, actorID string, expectedRevision int64, at time.Time) (knowledge.ProjectLatticeState, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return knowledge.ProjectLatticeState{}, err
	}
	defer tx.Rollback()
	state, err := s.latticeState(tx, projectID, kind)
	if err != nil || state.Revision != expectedRevision || state.PreviousGenerationID == "" {
		return knowledge.ProjectLatticeState{}, knowledge.ErrGenerationConflict
	}
	previous, err := s.generation(tx, state.PreviousGenerationID)
	if err != nil || previous.State != knowledge.GenerationRetired || previous.RollbackExpiresAt == nil {
		return knowledge.ProjectLatticeState{}, knowledge.ErrGenerationConflict
	}
	if at.After(*previous.RollbackExpiresAt) {
		return knowledge.ProjectLatticeState{}, knowledge.ErrRollbackExpired
	}
	if previous.SourceWatermark != state.SourceCursor {
		return knowledge.ProjectLatticeState{}, knowledge.ErrReembedSourceChanged
	}
	current, err := s.generation(tx, state.ActiveGenerationID)
	if err != nil {
		return knowledge.ProjectLatticeState{}, err
	}
	current.State, current.RetiredAt, current.RollbackExpiresAt =
		knowledge.GenerationRetired, timePointerSQL(at), nil
	if err := insertGenerationTx(tx, current); err != nil {
		return knowledge.ProjectLatticeState{}, err
	}
	previous.State, previous.PromotedAt = knowledge.GenerationActive, timePointerSQL(at)
	previous.RetiredAt, previous.RollbackExpiresAt = nil, nil
	if err := insertGenerationTx(tx, previous); err != nil {
		return knowledge.ProjectLatticeState{}, err
	}
	state.ActiveGenerationID, state.PreviousGenerationID = previous.ID, current.ID
	state.Revision++
	state.UpdatedAt = at
	if err := updateLatticeStateTx(tx, state); err != nil {
		return knowledge.ProjectLatticeState{}, err
	}
	rows, err := tx.Query(`SELECT record FROM knowledge_reembed_runs
		WHERE project_id=? AND kind=? AND target_generation_id=? AND status=?`,
		projectID, string(kind), current.ID, string(knowledge.ReembedPromoted))
	if err != nil {
		return knowledge.ProjectLatticeState{}, err
	}
	var promoted []knowledge.ReembedRun
	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			rows.Close()
			return knowledge.ProjectLatticeState{}, err
		}
		var run knowledge.ReembedRun
		if err := unmarshalJSON(raw, &run); err != nil {
			rows.Close()
			return knowledge.ProjectLatticeState{}, err
		}
		promoted = append(promoted, run)
	}
	rows.Close()
	for _, run := range promoted {
		run.Status, run.UpdatedAt = knowledge.ReembedRolledBack, at
		if err := saveRunTx(tx, run); err != nil {
			return knowledge.ProjectLatticeState{}, err
		}
	}
	if err := appendGenerationEventTx(tx, knowledge.GenerationEvent{
		ID: legacyGenerationID(projectID + string(kind) + at.String()), ProjectID: projectID, Kind: kind,
		GenerationID: previous.ID, Type: "rolled_back", ActorID: actorID,
		StateRevision: state.Revision, OccurredAt: at,
	}); err != nil {
		return knowledge.ProjectLatticeState{}, err
	}
	if err := tx.Commit(); err != nil {
		return knowledge.ProjectLatticeState{}, err
	}
	return state, nil
}

func (s *Store) GenerationEvents(projectID string, after int64, limit int) ([]knowledge.GenerationEvent, error) {
	if limit <= 0 {
		limit = 1000
	}
	rows, err := s.db.Query(`SELECT sequence,id,project_id,kind,generation_id,event_type,
			actor_id,state_revision,occurred_at
		FROM knowledge_generation_events WHERE project_id=? AND sequence>? ORDER BY sequence LIMIT ?`,
		projectID, after, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []knowledge.GenerationEvent
	for rows.Next() {
		var event knowledge.GenerationEvent
		var kindRaw, occurred string
		if err := rows.Scan(&event.Sequence, &event.ID, &event.ProjectID, &kindRaw,
			&event.GenerationID, &event.Type, &event.ActorID, &event.StateRevision, &occurred); err != nil {
			return nil, err
		}
		event.Kind = knowledge.LatticeKind(kindRaw)
		event.OccurredAt, err = time.Parse(timeLayout, occurred)
		if err != nil {
			return nil, err
		}
		out = append(out, event)
	}
	return out, rows.Err()
}

func (s *Store) loadRun(q rowQuerier, runID string) (knowledge.ReembedRun, error) {
	if q == nil {
		q = s.db
	}
	var raw string
	err := q.QueryRow(`SELECT record FROM knowledge_reembed_runs WHERE id=?`, runID).Scan(&raw)
	var run knowledge.ReembedRun
	if err == nil {
		err = unmarshalJSON(raw, &run)
	}
	return run, err
}

func saveRunTx(tx *sql.Tx, run knowledge.ReembedRun) error {
	raw, err := marshalJSON(run)
	if err != nil {
		return err
	}
	_, err = tx.Exec(`INSERT INTO knowledge_reembed_runs(
			id,project_id,kind,preview_id,target_generation_id,idempotency_key,status,record
		) VALUES(?,?,?,?,?,?,?,?)
		ON CONFLICT(id) DO UPDATE SET status=excluded.status,record=excluded.record`,
		run.ID, run.ProjectID, string(run.Kind), run.PreviewID, run.TargetGenerationID,
		run.IdempotencyKey, string(run.Status), raw)
	return err
}

func terminalReembedStatus(status knowledge.ReembedStatus) bool {
	switch status {
	case knowledge.ReembedCancelled, knowledge.ReembedPromoted,
		knowledge.ReembedRolledBack, knowledge.ReembedFailed:
		return true
	default:
		return false
	}
}

func addCheckpointTotalsSQL(run *knowledge.ReembedRun, checkpoint knowledge.ReembedCheckpoint) {
	if checkpoint.Status == "complete" {
		run.SourcesCompleted++
	} else if checkpoint.Status == "skipped" {
		run.SourcesSkipped++
	}
	run.BytesRead += checkpoint.BytesRead
	run.Vectors += checkpoint.Vectors
	run.Usage.PromptTokens += checkpoint.Usage.PromptTokens
	run.Usage.TotalTokens += checkpoint.Usage.TotalTokens
	run.Usage.Requests += checkpoint.Usage.Requests
	run.Usage.CostUSD += checkpoint.Usage.CostUSD
}

func removeCheckpointTotalsSQL(run *knowledge.ReembedRun, checkpoint knowledge.ReembedCheckpoint) {
	if checkpoint.Status == "complete" {
		run.SourcesCompleted--
	} else if checkpoint.Status == "skipped" {
		run.SourcesSkipped--
	}
	run.BytesRead -= checkpoint.BytesRead
	run.Vectors -= checkpoint.Vectors
	run.Usage.PromptTokens -= checkpoint.Usage.PromptTokens
	run.Usage.TotalTokens -= checkpoint.Usage.TotalTokens
	run.Usage.Requests -= checkpoint.Usage.Requests
	run.Usage.CostUSD -= checkpoint.Usage.CostUSD
}

func generationCountsTx(tx *sql.Tx, generationID, projectID string) (sources, windows, nodes int, err error) {
	if err = tx.QueryRow(`SELECT COUNT(*) FROM knowledge_sources
		WHERE generation_id=? AND project_id=?`, generationID, projectID).Scan(&sources); err != nil {
		return
	}
	if err = tx.QueryRow(`SELECT COUNT(*) FROM knowledge_windows w
		JOIN knowledge_sources s ON s.generation_id=w.generation_id AND s.local_ref_id=w.local_ref_id
		WHERE w.generation_id=? AND s.project_id=?`, generationID, projectID).Scan(&windows); err != nil {
		return
	}
	err = tx.QueryRow(`SELECT COUNT(*) FROM knowledge_nodes
		WHERE generation_id=? AND project_id=?`, generationID, projectID).Scan(&nodes)
	return
}

func generationVectorsMatchSpaceTx(tx *sql.Tx, generationID, projectID string, dimensions int) (bool, error) {
	if dimensions <= 0 {
		return false, nil
	}
	var invalid int
	wantBytes := dimensions * 4
	if err := tx.QueryRow(`SELECT COUNT(*) FROM knowledge_windows w
		JOIN knowledge_sources s ON s.generation_id=w.generation_id AND s.local_ref_id=w.local_ref_id
		WHERE w.generation_id=? AND s.project_id=? AND
		      (w.embedding_v2 IS NULL OR length(w.embedding_v2)<>?)`,
		generationID, projectID, wantBytes).Scan(&invalid); err != nil {
		return false, err
	}
	if invalid != 0 {
		return false, nil
	}
	if err := tx.QueryRow(`SELECT COUNT(*) FROM knowledge_nodes
		WHERE generation_id=? AND project_id=? AND
		      (centroid_v2 IS NULL OR length(centroid_v2)<>?)`,
		generationID, projectID, wantBytes).Scan(&invalid); err != nil {
		return false, err
	}
	return invalid == 0, nil
}

func appendGenerationEventTx(tx *sql.Tx, event knowledge.GenerationEvent) error {
	_, err := tx.Exec(`INSERT INTO knowledge_generation_events(
			id,project_id,kind,generation_id,event_type,actor_id,state_revision,occurred_at
		) VALUES(?,?,?,?,?,?,?,?)`,
		event.ID, event.ProjectID, string(event.Kind), event.GenerationID, event.Type,
		event.ActorID, event.StateRevision, event.OccurredAt.Format(timeLayout))
	return err
}

type rowQuerier interface {
	QueryRow(string, ...any) *sql.Row
}

func (s *Store) reembedRequiredGeneration(q rowQuerier, projectID string, kind knowledge.LatticeKind) (knowledge.LatticeGeneration, error) {
	if q == nil {
		q = s.db
	}
	var count int
	var generationID string
	if err := q.QueryRow(`SELECT COUNT(*),COALESCE(MIN(id),'') FROM knowledge_generations
		WHERE project_id=? AND kind=? AND state=?`,
		projectID, string(kind), string(knowledge.GenerationReembedRequired),
	).Scan(&count, &generationID); err != nil {
		return knowledge.LatticeGeneration{}, err
	}
	if count != 1 {
		return knowledge.LatticeGeneration{}, knowledge.ErrEmbeddingSpaceUnavailable
	}
	return s.generation(q, generationID)
}

func (s *Store) latticeState(q rowQuerier, projectID string, kind knowledge.LatticeKind) (knowledge.ProjectLatticeState, error) {
	if q == nil {
		q = s.db
	}
	var state knowledge.ProjectLatticeState
	var kindRaw, updated string
	err := q.QueryRow(`SELECT project_id,kind,active_generation_id,previous_generation_id,
		revision,source_cursor,updated_at FROM knowledge_lattice_state WHERE project_id=? AND kind=?`,
		projectID, string(kind)).Scan(&state.ProjectID, &kindRaw, &state.ActiveGenerationID,
		&state.PreviousGenerationID, &state.Revision, &state.SourceCursor, &updated)
	if err != nil {
		return knowledge.ProjectLatticeState{}, err
	}
	state.Kind = knowledge.LatticeKind(kindRaw)
	state.UpdatedAt, err = time.Parse(timeLayout, updated)
	if err != nil {
		return knowledge.ProjectLatticeState{}, fmt.Errorf("%w: lattice state timestamp", knowledge.ErrEvidenceCorrupt)
	}
	return state, nil
}

func (s *Store) generation(q rowQuerier, generationID string) (knowledge.LatticeGeneration, error) {
	if q == nil {
		q = s.db
	}
	var raw string
	err := q.QueryRow(`SELECT record FROM knowledge_generations WHERE id=?`, generationID).Scan(&raw)
	var generation knowledge.LatticeGeneration
	if err == nil {
		if err = json.Unmarshal([]byte(raw), &generation); err != nil {
			err = fmt.Errorf("%w: lattice generation", knowledge.ErrEvidenceCorrupt)
		}
	}
	return generation, err
}

func (s *Store) space(q rowQuerier, identity string) (knowledge.EmbeddingSpace, error) {
	if q == nil {
		q = s.db
	}
	var raw string
	err := q.QueryRow(`SELECT definition FROM knowledge_embedding_spaces WHERE identity=?`, identity).Scan(&raw)
	var space knowledge.EmbeddingSpace
	if err == nil {
		if err = json.Unmarshal([]byte(raw), &space); err != nil {
			err = fmt.Errorf("%w: embedding space", knowledge.ErrEvidenceCorrupt)
		} else if space.Identity() != identity || space.Validate() != nil {
			err = fmt.Errorf("%w: embedding space identity", knowledge.ErrEvidenceCorrupt)
		}
	}
	return space, err
}

func (s *Store) compatGeneration(projectID string) string {
	state, err := s.latticeState(nil, projectID, knowledge.LatticeText)
	if err == nil && state.ActiveGenerationID != "" {
		return state.ActiveGenerationID
	}
	return legacyArtifactGeneration
}

func (s *Store) compatIDGeneration(table, column string, ids []string) string {
	if len(ids) == 0 {
		return legacyArtifactGeneration
	}
	switch {
	case table == "knowledge_nodes" && column == "id",
		table == "knowledge_windows" && column == "id",
		table == "knowledge_sources" && column == "local_ref_id":
	default:
		return legacyArtifactGeneration
	}
	var generationID string
	query := `SELECT a.generation_id FROM ` + table + ` a
		LEFT JOIN knowledge_lattice_state s ON s.active_generation_id=a.generation_id
		WHERE a.` + column + `=? AND
		      (s.active_generation_id IS NOT NULL OR a.generation_id='legacy')
		ORDER BY (s.active_generation_id IS NOT NULL) DESC,a.generation_id LIMIT 1`
	if s.db.QueryRow(query, ids[0]).Scan(&generationID) == nil {
		return generationID
	}
	return legacyArtifactGeneration
}

func (v *sqliteArtifactView) SourceByOrigin(projectID, sourceType, sourceID string) (knowledge.Source, bool, error) {
	return v.root.sourceByOrigin(v.generationID, projectID, sourceType, sourceID)
}
func (v *sqliteArtifactView) SourcesUnder(projectID, sourceType, prefix string) ([]knowledge.Origin, error) {
	return v.root.sourcesUnder(v.generationID, projectID, sourceType, prefix)
}
func (v *sqliteArtifactView) Sources(projectID string) ([]knowledge.Source, error) {
	return v.root.sources(v.generationID, projectID)
}
func (v *sqliteArtifactView) ReplaceSources(writes []knowledge.SourceWrite) error {
	return v.root.replaceSources(v.generationID, writes)
}
func (v *sqliteArtifactView) DeleteSource(projectID, sourceType, sourceID string) (bool, error) {
	return v.root.deleteSource(v.generationID, projectID, sourceType, sourceID)
}
func (v *sqliteArtifactView) CorpusSeq(projectID string) (int64, int64, error) {
	return v.root.corpusSeq(v.generationID, projectID)
}
func (v *sqliteArtifactView) RebuildCorpus(projectID string, corpus []knowledge.Node, seq int64, indexes []knowledge.CorpusLevelIndex) error {
	return v.root.rebuildCorpus(v.generationID, projectID, corpus, seq, indexes)
}
func (v *sqliteArtifactView) CorpusIndexes(projectID string) ([]knowledge.CorpusLevelIndex, error) {
	return v.root.corpusIndexes(v.generationID, projectID)
}
func (v *sqliteArtifactView) CorpusIndexHeader(projectID string, level int) (knowledge.CorpusLevelIndex, bool, error) {
	return v.root.corpusIndexHeader(v.generationID, projectID, level)
}
func (v *sqliteArtifactView) EntryFrontierProbed(projectID string, level int, cells []int) ([]knowledge.FrontierEntry, error) {
	return v.root.entryFrontierProbed(v.generationID, projectID, level, cells)
}
func (v *sqliteArtifactView) SourceFrontier(projectID string) ([]knowledge.FrontierEntry, error) {
	return v.root.sourceFrontier(v.generationID, projectID)
}
func (v *sqliteArtifactView) Identities(projectID string) (map[string]knowledge.VectorIdentity, error) {
	return v.root.identities(v.generationID, projectID)
}
func (v *sqliteArtifactView) EntryFrontier(projectID string) ([]knowledge.FrontierEntry, error) {
	return v.root.entryFrontier(v.generationID, projectID)
}
func (v *sqliteArtifactView) NodesByID(ids []string) ([]knowledge.Node, error) {
	return v.root.nodesByID(v.generationID, ids)
}
func (v *sqliteArtifactView) WindowsByID(ids []string) ([]knowledge.Window, error) {
	return v.root.windowsByID(v.generationID, ids)
}
func (v *sqliteArtifactView) ProjectWindows(projectID string) ([]knowledge.Window, error) {
	return v.root.projectWindows(v.generationID, projectID)
}
func (v *sqliteArtifactView) WindowContent(ids []string) (map[string]knowledge.WindowContent, error) {
	return v.root.windowContent(v.generationID, ids)
}
func (v *sqliteArtifactView) SourceWindows(localRefID string) ([]knowledge.Window, error) {
	return v.root.sourceWindows(v.generationID, localRefID)
}
func (v *sqliteArtifactView) SourcesByRef(refs []string) (map[string]knowledge.Source, error) {
	return v.root.sourcesByRef(v.generationID, refs)
}
func (v *sqliteArtifactView) ArtifactCounts(projectID string) (map[string]int, error) {
	return v.root.artifactCounts(v.generationID, projectID)
}
func (v *sqliteArtifactView) AdmitAndReplaceSources(maxArtifacts int, writes []knowledge.SourceWrite) (knowledge.ArtifactCounts, error) {
	return v.root.admitAndReplaceSources(v.generationID, maxArtifacts, writes)
}
func (v *sqliteArtifactView) AdmitCorpus(projectID string, maxArtifacts int, corpus []knowledge.Node, seq int64, indexes []knowledge.CorpusLevelIndex) (knowledge.ArtifactCounts, error) {
	return v.root.admitCorpus(v.generationID, projectID, maxArtifacts, corpus, seq, indexes)
}

func marshalJSON(value any) (string, error) {
	raw, err := json.Marshal(value)
	return string(raw), err
}

func unmarshalJSON(raw string, target any) error {
	if raw == "" {
		return knowledge.ErrEvidenceCorrupt
	}
	return json.Unmarshal([]byte(raw), target)
}

func sameJSON(a, b any) bool { return reflect.DeepEqual(a, b) }

func storageConflict(err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%w: %v", knowledge.ErrGenerationConflict, err)
}
