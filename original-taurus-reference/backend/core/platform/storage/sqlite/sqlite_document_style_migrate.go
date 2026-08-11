package sqlite

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/gccurtis/taurus-omega/core/capability/document"
)

const documentStyleScrubBatch = 100

type documentStyleScrubReport struct {
	DocumentsChanged   int
	ChangeSetsChanged  int
	SubmissionsChanged int
	ValuesCleared      int
	MarksRemoved       int
	OperationsRemoved  int
}

func (r *documentStyleScrubReport) add(scrub document.StyleScrubReport) {
	r.ValuesCleared += scrub.ValuesCleared
	r.MarksRemoved += scrub.MarksRemoved
	r.OperationsRemoved += scrub.OperationsRemoved
}

func (r documentStyleScrubReport) changed() bool {
	return r.DocumentsChanged != 0 || r.ChangeSetsChanged != 0 || r.SubmissionsChanged != 0
}

// scrubDocumentStyles is a resumable, idempotent pre-release data migration.
// Each bounded batch is read and then rows are repaired independently, so a
// restart resumes from the first still-unsafe row. No rejected value is logged.
func (s *Store) scrubDocumentStyles() (documentStyleScrubReport, error) {
	var report documentStyleScrubReport
	if err := s.scrubDocumentBases(&report); err != nil {
		return report, err
	}
	if err := s.scrubDocumentChangeSets(&report); err != nil {
		return report, err
	}
	if err := s.scrubDocumentSubmissions(&report); err != nil {
		return report, err
	}
	if report.changed() {
		log.Printf(
			"document style scrub: code=%s documents=%d change_sets=%d submissions=%d values=%d marks=%d operations=%d",
			document.StyleValidationCode,
			report.DocumentsChanged,
			report.ChangeSetsChanged,
			report.SubmissionsChanged,
			report.ValuesCleared,
			report.MarksRemoved,
			report.OperationsRemoved,
		)
	}
	return report, nil
}

func (s *Store) scrubDocumentBases(report *documentStyleScrubReport) error {
	cursor := ""
	for {
		rows, err := s.db.Query(
			`SELECT id, base FROM documents WHERE id > ? ORDER BY id LIMIT ?`,
			cursor, documentStyleScrubBatch,
		)
		if err != nil {
			return err
		}
		type storedBase struct{ id, raw string }
		var batch []storedBase
		for rows.Next() {
			var row storedBase
			if err := rows.Scan(&row.id, &row.raw); err != nil {
				rows.Close()
				return err
			}
			batch = append(batch, row)
		}
		if err := rows.Close(); err != nil {
			return err
		}
		if len(batch) == 0 {
			return nil
		}
		for _, row := range batch {
			var base document.Base
			if err := json.Unmarshal([]byte(row.raw), &base); err != nil {
				return fmt.Errorf("document style scrub base %s: %w", row.id, err)
			}
			scrub := document.ScrubUnsafeStyles(&base)
			if scrub.Empty() {
				continue
			}
			raw, err := json.Marshal(base)
			if err != nil {
				return fmt.Errorf("document style scrub base %s: %w", row.id, err)
			}
			if _, err := s.db.Exec(`UPDATE documents SET base = ? WHERE id = ?`, string(raw), row.id); err != nil {
				return fmt.Errorf("document style scrub base %s: %w", row.id, err)
			}
			report.DocumentsChanged++
			report.add(scrub)
		}
		cursor = batch[len(batch)-1].id
	}
}

func (s *Store) scrubDocumentChangeSets(report *documentStyleScrubReport) error {
	cursor := ""
	for {
		rows, err := s.db.Query(
			`SELECT id, ops, inverse_ops FROM change_sets WHERE id > ? ORDER BY id LIMIT ?`,
			cursor, documentStyleScrubBatch,
		)
		if err != nil {
			return err
		}
		type storedChangeSet struct{ id, ops, inverse string }
		var batch []storedChangeSet
		for rows.Next() {
			var row storedChangeSet
			if err := rows.Scan(&row.id, &row.ops, &row.inverse); err != nil {
				rows.Close()
				return err
			}
			batch = append(batch, row)
		}
		if err := rows.Close(); err != nil {
			return err
		}
		if len(batch) == 0 {
			return nil
		}
		for _, row := range batch {
			var ops, inverse []document.ChangeOp
			if err := json.Unmarshal([]byte(row.ops), &ops); err != nil {
				return fmt.Errorf("document style scrub change set %s ops: %w", row.id, err)
			}
			if err := json.Unmarshal([]byte(row.inverse), &inverse); err != nil {
				return fmt.Errorf("document style scrub change set %s inverse: %w", row.id, err)
			}
			safeOps, opsReport := document.ScrubUnsafeStyleOps(ops)
			safeInverse, inverseReport := document.ScrubUnsafeStyleOps(inverse)
			if opsReport.Empty() && inverseReport.Empty() {
				continue
			}
			opsRaw, err := json.Marshal(safeOps)
			if err != nil {
				return fmt.Errorf("document style scrub change set %s ops: %w", row.id, err)
			}
			inverseRaw, err := json.Marshal(safeInverse)
			if err != nil {
				return fmt.Errorf("document style scrub change set %s inverse: %w", row.id, err)
			}
			if _, err := s.db.Exec(
				`UPDATE change_sets SET ops = ?, inverse_ops = ? WHERE id = ?`,
				string(opsRaw), string(inverseRaw), row.id,
			); err != nil {
				return fmt.Errorf("document style scrub change set %s: %w", row.id, err)
			}
			report.ChangeSetsChanged++
			report.add(opsReport)
			report.add(inverseReport)
		}
		cursor = batch[len(batch)-1].id
	}
}

func (s *Store) scrubDocumentSubmissions(report *documentStyleScrubReport) error {
	cursorDocument, cursorAuthor, cursorSubmission := "", "", ""
	for {
		rows, err := s.db.Query(
			`SELECT document_id, author_id, submission_id, receipt
			 FROM document_submissions
			 WHERE document_id > ?
			    OR (document_id = ? AND author_id > ?)
			    OR (document_id = ? AND author_id = ? AND submission_id > ?)
			 ORDER BY document_id, author_id, submission_id LIMIT ?`,
			cursorDocument,
			cursorDocument, cursorAuthor,
			cursorDocument, cursorAuthor, cursorSubmission,
			documentStyleScrubBatch,
		)
		if err != nil {
			return err
		}
		type storedSubmission struct{ documentID, authorID, submissionID, raw string }
		var batch []storedSubmission
		for rows.Next() {
			var row storedSubmission
			if err := rows.Scan(&row.documentID, &row.authorID, &row.submissionID, &row.raw); err != nil {
				rows.Close()
				return err
			}
			batch = append(batch, row)
		}
		if err := rows.Close(); err != nil {
			return err
		}
		if len(batch) == 0 {
			return nil
		}
		for _, row := range batch {
			var receipt struct {
				ChangeSet  document.ChangeSet  `json:"changeSet"`
				InverseOps []document.ChangeOp `json:"inverseOps"`
			}
			if err := json.Unmarshal([]byte(row.raw), &receipt); err != nil {
				return fmt.Errorf(
					"document style scrub submission %s/%s/%s: %w",
					row.documentID, row.authorID, row.submissionID, err,
				)
			}
			safeOps, opsReport := document.ScrubUnsafeStyleOps(receipt.ChangeSet.Ops)
			safeInverse, inverseReport := document.ScrubUnsafeStyleOps(receipt.InverseOps)
			if opsReport.Empty() && inverseReport.Empty() {
				continue
			}
			receipt.ChangeSet.Ops = safeOps
			receipt.InverseOps = safeInverse
			raw, err := json.Marshal(receipt)
			if err != nil {
				return fmt.Errorf(
					"document style scrub submission %s/%s/%s: %w",
					row.documentID, row.authorID, row.submissionID, err,
				)
			}
			if _, err := s.db.Exec(
				`UPDATE document_submissions SET receipt = ?
				 WHERE document_id = ? AND author_id = ? AND submission_id = ?`,
				string(raw), row.documentID, row.authorID, row.submissionID,
			); err != nil {
				return fmt.Errorf(
					"document style scrub submission %s/%s/%s: %w",
					row.documentID, row.authorID, row.submissionID, err,
				)
			}
			report.SubmissionsChanged++
			report.add(opsReport)
			report.add(inverseReport)
		}
		last := batch[len(batch)-1]
		cursorDocument, cursorAuthor, cursorSubmission =
			last.documentID, last.authorID, last.submissionID
	}
}
