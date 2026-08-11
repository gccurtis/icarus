// Documents: records, change sets, history, re-base, and anchors.
//
// Part of the single SQLite Store: this file holds the document persistence
// methods. Every file in this package shares one *Store and one connection, so
// the split is organizational — it mirrors the capability boundaries in
// core/capability so each domain's storage is legible on its own.
package sqlite

import (
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/document"
)

// --- document.Store ---

func (s *Store) CreateDocument(d document.Document, fact document.ActivityFact) error {
	base, err := json.Marshal(d.Base)
	if err != nil {
		return err
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.Exec(
		`INSERT INTO documents(id, project_id, name, base, creator_id, creator_name, base_seq, revision, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		d.ID, d.ProjectID, d.Name, string(base), d.CreatorID, d.CreatorName, d.BaseSeq, d.Revision, sortableTime(d.CreatedAt), sortableTime(d.UpdatedAt),
	); err != nil {
		return err
	}
	if err := insertDocumentActivity(tx, fact); err != nil {
		return err
	}
	return tx.Commit()
}

// DocumentByID returns one document scoped to its project. The project id is
// part of the WHERE clause rather than a check the caller is trusted to make:
// a document owned by another project reads as ErrNotFound here, in SQL. The
// service still compares ProjectID after loading — two independent layers,
// neither load-bearing alone. `id` is the primary key, so the extra predicate
// is a filter on the single row the index already found.
func (s *Store) DocumentByID(projectID, id string) (document.Document, error) {
	return scanDocument(s.db.QueryRow(
		`SELECT id, project_id, name, base, creator_id, creator_name, base_seq, revision, created_at, updated_at, lifecycle, trashed_at
		 FROM documents WHERE id = ? AND project_id = ?`, id, projectID))
}

func (s *Store) DocumentsByProject(projectID string) ([]document.Document, error) {
	rows, err := s.db.Query(
		`SELECT id, project_id, name, base, creator_id, creator_name, base_seq, revision, created_at, updated_at, lifecycle, trashed_at
		   FROM documents WHERE project_id = ? AND lifecycle = 'active' ORDER BY created_at`,
		projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []document.Document
	for rows.Next() {
		d, err := scanDocument(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (s *Store) DocumentSummaries(projectID string, before *document.SummaryBoundary, limit int) ([]document.Summary, error) {
	query := `SELECT id, name, creator_id, creator_name, created_at, updated_at FROM documents WHERE project_id = ? AND lifecycle = 'active'`
	args := []any{projectID}
	if before != nil {
		at := sortableTime(before.UpdatedAt)
		if before.SkipEqualTime {
			query += ` AND updated_at < ?`
			args = append(args, at)
		} else {
			query += ` AND (updated_at < ? OR (updated_at = ? AND id > ?))`
			args = append(args, at, at, before.ID)
		}
	}
	query += ` ORDER BY updated_at DESC, id ASC LIMIT ?`
	args = append(args, limit)
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]document.Summary, 0, limit)
	for rows.Next() {
		var summary document.Summary
		var created, updated string
		if err := rows.Scan(&summary.ID, &summary.Name, &summary.CreatorID, &summary.CreatorName, &created, &updated); err != nil {
			return nil, err
		}
		summary.CreatedAt, _ = time.Parse(timeLayout, created)
		summary.UpdatedAt, _ = time.Parse(timeLayout, updated)
		out = append(out, summary)
	}
	return out, rows.Err()
}

func (s *Store) RenameDocument(id, name string, updatedAt time.Time, fact document.ActivityFact) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	res, err := tx.Exec(`UPDATE documents SET name = ?, updated_at = ? WHERE id = ?`, name, sortableTime(updatedAt), id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return document.ErrNotFound
	}
	if err := insertDocumentActivity(tx, fact); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) DeleteDocument(id string, fact document.ActivityFact) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM document_submissions WHERE document_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM document_history WHERE document_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM change_sets WHERE document_id = ?`, id); err != nil {
		return err
	}
	res, err := tx.Exec(`DELETE FROM documents WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return document.ErrNotFound
	}
	if err := insertDocumentActivity(tx, fact); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) SetLifecycle(id, lifecycle string, trashedAt time.Time, updatedAt time.Time, fact document.ActivityFact) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	res, err := tx.Exec(
		`UPDATE documents SET lifecycle = ?, trashed_at = ?, updated_at = ? WHERE id = ?`,
		lifecycle, sortableTime(trashedAt), sortableTime(updatedAt), id,
	)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return document.ErrNotFound
	}
	if err := insertDocumentActivity(tx, fact); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) TrashedDocumentsOlderThan(before time.Time) ([]document.Document, error) {
	rows, err := s.db.Query(
		`SELECT id, project_id, name, base, creator_id, creator_name, base_seq, revision, created_at, updated_at, lifecycle, trashed_at
		   FROM documents WHERE lifecycle = 'trashed' AND trashed_at < ?`,
		sortableTime(before))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []document.Document
	for rows.Next() {
		d, err := scanDocument(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (s *Store) AppendChangeSet(cs document.ChangeSet, expectedRevision int64, fact document.ActivityFact) (document.ChangeSet, error) {
	ops, err := json.Marshal(cs.Ops)
	if err != nil {
		return document.ChangeSet{}, err
	}
	inverseOps, err := json.Marshal(cs.InverseOps)
	if err != nil {
		return document.ChangeSet{}, err
	}
	summary, err := json.Marshal(cs.Summary)
	if err != nil {
		return document.ChangeSet{}, err
	}

	tx, err := s.db.Begin()
	if err != nil {
		return document.ChangeSet{}, err
	}
	defer tx.Rollback()

	if cs.SubmissionID != "" {
		existing, err := scanSubmissionReceipt(tx.QueryRow(
			`SELECT submission_hash, receipt
			 FROM document_submissions
			 WHERE document_id = ? AND author_id = ? AND submission_id = ?`,
			cs.DocumentID, cs.AuthorID, cs.SubmissionID))
		switch {
		case err == nil && existing.SubmissionHash == cs.SubmissionHash:
			return existing, nil
		case err == nil:
			return document.ChangeSet{}, document.ErrSubmissionConflict
		case !errors.Is(err, document.ErrChangeSetNotFound):
			return document.ChangeSet{}, err
		}
	}

	cs.PriorRevision = expectedRevision
	cs.Seq = expectedRevision + 1
	res, err := tx.Exec(
		`UPDATE documents SET revision = ?, updated_at = ? WHERE id = ? AND revision = ?`,
		cs.Seq, sortableTime(cs.CreatedAt), cs.DocumentID, expectedRevision)
	if err != nil {
		return document.ChangeSet{}, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		var exists int
		if err := tx.QueryRow(`SELECT COUNT(*) FROM documents WHERE id = ?`, cs.DocumentID).Scan(&exists); err != nil {
			return document.ChangeSet{}, err
		}
		if exists == 0 {
			return document.ChangeSet{}, document.ErrNotFound
		}
		return document.ChangeSet{}, document.ErrRevisionConflict
	}

	if _, err := tx.Exec(
		`INSERT INTO change_sets(
			id, document_id, author_id, author_name, submission_id, submission_hash,
			authored_revision, prior_revision, seq, created_at, ops, undo_of, redo_of,
			summary, inverse_ops
		 ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		cs.ID, cs.DocumentID, cs.AuthorID, cs.AuthorName, cs.SubmissionID, cs.SubmissionHash,
		cs.AuthoredRevision, cs.PriorRevision, cs.Seq, cs.CreatedAt.Format(timeLayout), string(ops),
		cs.UndoOf, cs.RedoOf, string(summary), string(inverseOps),
	); err != nil {
		return document.ChangeSet{}, err
	}
	history := document.HistoryEntryForChangeSet(cs)
	if _, err := tx.Exec(`INSERT INTO document_history(
		change_set_id, document_id, author_id, author_name, submission_id,
		authored_revision, prior_revision, seq, created_at, undo_of, redo_of, summary
	) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		history.ID, cs.DocumentID, history.Author.ID, history.Author.Name, history.SubmissionID,
		history.AuthoredRevision, history.PriorRevision, history.Revision, cs.CreatedAt.Format(timeLayout),
		history.UndoOf, history.RedoOf, string(summary),
	); err != nil {
		return document.ChangeSet{}, err
	}
	if cs.SubmissionID != "" {
		receipt, err := json.Marshal(struct {
			ChangeSet  document.ChangeSet  `json:"changeSet"`
			InverseOps []document.ChangeOp `json:"inverseOps"`
		}{
			ChangeSet: cs, InverseOps: cs.InverseOps,
		})
		if err != nil {
			return document.ChangeSet{}, err
		}
		if _, err := tx.Exec(
			`INSERT INTO document_submissions(
				document_id, author_id, submission_id, submission_hash, receipt
			 ) VALUES(?, ?, ?, ?, ?)`,
			cs.DocumentID, cs.AuthorID, cs.SubmissionID, cs.SubmissionHash, string(receipt),
		); err != nil {
			return document.ChangeSet{}, err
		}
	}
	if err := insertDocumentActivity(tx, fact); err != nil {
		return document.ChangeSet{}, err
	}
	if err := tx.Commit(); err != nil {
		return document.ChangeSet{}, err
	}
	return cs, nil
}

func (s *Store) ChangeSetsSince(documentID string, afterSeq int64) ([]document.ChangeSet, error) {
	rows, err := s.db.Query(
		`SELECT id, document_id, author_id, author_name, submission_id, submission_hash,
		        authored_revision, prior_revision, seq, created_at, ops, undo_of,
		        redo_of, summary, inverse_ops
		 FROM change_sets WHERE document_id = ? AND seq > ? ORDER BY seq`,
		documentID, afterSeq)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []document.ChangeSet
	for rows.Next() {
		cs, err := scanChangeSet(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, cs)
	}
	return out, rows.Err()
}

func (s *Store) ChangeSetByID(documentID, changeSetID string) (document.ChangeSet, error) {
	return scanChangeSet(s.db.QueryRow(
		`SELECT id, document_id, author_id, author_name, submission_id, submission_hash,
		        authored_revision, prior_revision, seq, created_at, ops, undo_of,
		        redo_of, summary, inverse_ops
		 FROM change_sets WHERE document_id = ? AND id = ?`,
		documentID, changeSetID))
}

func (s *Store) ChangeSetBySubmission(documentID, authorID, submissionID string) (document.ChangeSet, error) {
	return scanSubmissionReceipt(s.db.QueryRow(
		`SELECT submission_hash, receipt
		 FROM document_submissions
		 WHERE document_id = ? AND author_id = ? AND submission_id = ?`,
		documentID, authorID, submissionID))
}

func scanSubmissionReceipt(row rowScanner) (document.ChangeSet, error) {
	var hash, raw string
	switch err := row.Scan(&hash, &raw); {
	case errors.Is(err, sql.ErrNoRows):
		return document.ChangeSet{}, document.ErrChangeSetNotFound
	case err != nil:
		return document.ChangeSet{}, err
	}
	var receipt struct {
		ChangeSet  document.ChangeSet  `json:"changeSet"`
		InverseOps []document.ChangeOp `json:"inverseOps"`
	}
	if err := json.Unmarshal([]byte(raw), &receipt); err != nil {
		return document.ChangeSet{}, err
	}
	receipt.ChangeSet.SubmissionHash = hash
	receipt.ChangeSet.InverseOps = receipt.InverseOps
	if receipt.ChangeSet.AuthorName == "" {
		receipt.ChangeSet.AuthorName = receipt.ChangeSet.AuthorID
	}
	if receipt.ChangeSet.Summary.OperationCount == 0 && len(receipt.ChangeSet.Ops) > 0 {
		receipt.ChangeSet.Summary = document.SummarizeChangeOps(receipt.ChangeSet.Ops)
	}
	return receipt.ChangeSet, nil
}

func (s *Store) ListChangeSetHistory(documentID string, beforeRevision int64, limit int) ([]document.HistoryEntry, error) {
	rows, err := s.db.Query(`SELECT
		h.change_set_id, h.seq, h.authored_revision, h.prior_revision, h.created_at,
		h.author_id, h.author_name, h.submission_id, h.undo_of, h.redo_of,
		h.summary, CASE WHEN c.id IS NULL THEN 0 ELSE 1 END,
		CASE WHEN c.inverse_ops IS NOT NULL
		       AND c.inverse_ops <> '' AND c.inverse_ops <> '[]'
		     THEN 1 ELSE 0 END
		FROM document_history h
		LEFT JOIN change_sets c ON c.id = h.change_set_id
		WHERE h.document_id = ? AND (? = 0 OR h.seq < ?)
		ORDER BY h.seq DESC LIMIT ?`,
		documentID, beforeRevision, beforeRevision, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []document.HistoryEntry
	for rows.Next() {
		var entry document.HistoryEntry
		var created, summary string
		var detail, hasInverse int
		if err := rows.Scan(
			&entry.ID, &entry.Revision, &entry.AuthoredRevision,
			&entry.PriorRevision, &created,
			&entry.Author.ID, &entry.Author.Name, &entry.SubmissionID,
			&entry.UndoOf, &entry.RedoOf, &summary, &detail, &hasInverse,
		); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(summary), &entry.Summary); err != nil {
			return nil, err
		}
		entry.DetailAvailable = detail != 0
		entry.HasInverse = hasInverse != 0
		if parsed, err := time.Parse(timeLayout, created); err == nil {
			entry.CreatedAt = parsed.UTC().Format(time.RFC3339Nano)
		} else {
			entry.CreatedAt = created
		}
		out = append(out, entry)
	}
	return out, rows.Err()
}

func scanChangeSet(row rowScanner) (document.ChangeSet, error) {
	var cs document.ChangeSet
	var created, ops, summary, inverseOps string
	switch err := row.Scan(
		&cs.ID, &cs.DocumentID, &cs.AuthorID, &cs.AuthorName, &cs.SubmissionID, &cs.SubmissionHash,
		&cs.AuthoredRevision, &cs.PriorRevision, &cs.Seq, &created, &ops,
		&cs.UndoOf, &cs.RedoOf, &summary, &inverseOps,
	); {
	case errors.Is(err, sql.ErrNoRows):
		return document.ChangeSet{}, document.ErrChangeSetNotFound
	case err != nil:
		return document.ChangeSet{}, err
	}
	if err := json.Unmarshal([]byte(ops), &cs.Ops); err != nil {
		return document.ChangeSet{}, err
	}
	if err := json.Unmarshal([]byte(summary), &cs.Summary); err != nil {
		return document.ChangeSet{}, err
	}
	if err := json.Unmarshal([]byte(inverseOps), &cs.InverseOps); err != nil {
		return document.ChangeSet{}, err
	}
	if cs.AuthorName == "" {
		cs.AuthorName = cs.AuthorID
	}
	cs.CreatedAt, _ = time.Parse(timeLayout, created)
	return cs, nil
}

func (s *Store) RebaseDocument(documentID string, base document.Base, baseSeq int64) error {
	b, err := json.Marshal(base)
	if err != nil {
		return err
	}
	// Guard the watermark: only apply a rebase that advances base_seq. Rebase is
	// the one write to the head that isn't gated by the revision CAS, and it can
	// run on either job worker without dedup, so a stale or duplicate rebase must
	// not wind base_seq backward and clobber a newer base (which, racing a prune,
	// can drop change sets the folded base still needs).
	_, err = s.db.Exec(
		`UPDATE documents SET base = ?, base_seq = ? WHERE id = ? AND base_seq < ?`,
		string(b), baseSeq, documentID, baseSeq,
	)
	return err
}

type documentActivityExecer interface {
	Exec(query string, args ...any) (sql.Result, error)
}

func insertDocumentActivity(exec documentActivityExecer, fact document.ActivityFact) error {
	switch fact.Action {
	case document.ActivityCreated, document.ActivityEdited, document.ActivityRenamed, document.ActivityDeleted,
		document.ActivityTrashed, document.ActivityRestored, document.ActivityPurged,
		document.ActivityDuplicated:
	default:
		return errors.New("sqlite: invalid document activity action")
	}
	_, err := exec.Exec(`INSERT INTO activity_events(
		id, project_id, actor_id, actor_name, action, target_id, target_kind,
		target_name, occurred_at, source_kind, source_id
	) VALUES(?, ?, ?, ?, ?, ?, 'document', ?, ?, ?, ?)`,
		fact.ID, fact.ProjectID, fact.Actor.ID, fact.Actor.Name, fact.Action,
		fact.TargetID, fact.TargetName, sortableTime(fact.OccurredAt), fact.SourceKind, fact.SourceID,
	)
	return err
}

// PruneChangeSets deletes folded detail except the current head recipe, retains
// every pending reconstruction ChangeSet, and bounds immutable summary History.
func (s *Store) PruneChangeSets(documentID string, keep int) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`
		DELETE FROM change_sets
		WHERE document_id = ?
		  AND seq <= (SELECT base_seq FROM documents WHERE id = ?)
		  AND seq < (SELECT revision FROM documents WHERE id = ?)`,
		documentID, documentID, documentID); err != nil {
		return err
	}
	if _, err := tx.Exec(`
		DELETE FROM document_history
		WHERE document_id = ?
		  AND seq NOT IN (
			SELECT seq FROM document_history
			WHERE document_id = ?
			ORDER BY seq DESC LIMIT ?
		  )`,
		documentID, documentID, keep); err != nil {
		return err
	}
	return tx.Commit()
}

func scanDocument(row rowScanner) (document.Document, error) {
	var d document.Document
	var base, created, updated, trashed string
	switch err := row.Scan(&d.ID, &d.ProjectID, &d.Name, &base, &d.CreatorID, &d.CreatorName, &d.BaseSeq, &d.Revision, &created, &updated, &d.Lifecycle, &trashed); {
	case errors.Is(err, sql.ErrNoRows):
		return document.Document{}, document.ErrNotFound
	case err != nil:
		return document.Document{}, err
	}
	if err := json.Unmarshal([]byte(base), &d.Base); err != nil {
		return document.Document{}, err
	}
	d.CreatedAt, _ = time.Parse(timeLayout, created)
	d.UpdatedAt, _ = time.Parse(timeLayout, updated)
	if trashed != "" {
		d.TrashedAt, _ = time.Parse(timeLayout, trashed)
	}
	return d, nil
}

func (s *Store) CreateAnchor(docID string, a document.DocumentAnchor) error {
	_, err := s.db.Exec(
		`INSERT INTO document_anchors(id, document_id, row_id, block_id, atom_id, start_offset, end_offset, state, created_at)
		 VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		a.ID, docID, a.RowID, a.BlockID, a.AtomID, a.Start, a.End, a.State, sortableTime(a.CreatedAt),
	)
	return err
}

func (s *Store) ListAnchors(docID string) ([]document.DocumentAnchor, error) {
	rows, err := s.db.Query(
		`SELECT id, document_id, row_id, block_id, atom_id, start_offset, end_offset, state, created_at
		   FROM document_anchors WHERE document_id = ? ORDER BY created_at`, docID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []document.DocumentAnchor
	for rows.Next() {
		var a document.DocumentAnchor
		var atomID sql.NullString
		var created string
		if err := rows.Scan(&a.ID, &a.DocumentID, &a.RowID, &a.BlockID, &atomID, &a.Start, &a.End, &a.State, &created); err != nil {
			return nil, err
		}
		a.AtomID = atomID.String
		a.CreatedAt, _ = time.Parse(timeLayout, created)
		out = append(out, a)
	}
	if out == nil {
		out = []document.DocumentAnchor{}
	}
	return out, rows.Err()
}

func (s *Store) DeleteAnchor(docID, anchorID string) error {
	_, err := s.db.Exec(`DELETE FROM document_anchors WHERE document_id = ? AND id = ?`, docID, anchorID)
	return err
}

func (s *Store) UpdateAnchor(docID string, a document.DocumentAnchor) error {
	_, err := s.db.Exec(
		`UPDATE document_anchors SET row_id = ?, block_id = ?, atom_id = ?, start_offset = ?, end_offset = ?, state = ?
		 WHERE document_id = ? AND id = ?`,
		a.RowID, a.BlockID, a.AtomID, a.Start, a.End, a.State, docID, a.ID,
	)
	return err
}
