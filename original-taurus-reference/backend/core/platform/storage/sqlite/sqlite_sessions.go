// Ephemeral per-project presence sessions.
//
// Part of the single SQLite Store: this file holds the sessions persistence
// methods. Every file in this package shares one *Store and one connection, so
// the split is organizational — it mirrors the capability boundaries in
// core/capability so each domain's storage is legible on its own.
package sqlite

import (
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/session"
)

func (s *Store) UpsertProjectSession(sess session.Session) error {
	_, err := s.db.Exec(
		`INSERT INTO project_sessions
			(project_id, user_id, session_id, user_name, user_email, current_document_id,
			 caret_atom_id, caret_offset,
			 selection_start_atom_id, selection_start_offset,
			 selection_end_atom_id, selection_end_offset,
			 started_at, last_activity_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(project_id, user_id) DO UPDATE SET
			session_id       = excluded.session_id,
			user_name        = excluded.user_name,
			user_email       = excluded.user_email,
			started_at       = excluded.started_at,
			last_activity_at = excluded.last_activity_at`,
		sess.ProjectID, sess.UserID, sess.SessionID, sess.UserName, sess.UserEmail,
		sess.CurrentDocumentID,
		sess.CaretAtomID, sess.CaretOffset,
		sess.SelectionStartAtomID, sess.SelectionStartOffset,
		sess.SelectionEndAtomID, sess.SelectionEndOffset,
		sortableTime(sess.StartedAt), sortableTime(sess.LastActivityAt),
	)
	return err
}

func (s *Store) CloseProjectSession(projectID, userID string) error {
	_, err := s.db.Exec(`DELETE FROM project_sessions WHERE project_id = ? AND user_id = ?`, projectID, userID)
	return err
}

func (s *Store) UpdateProjectSession(sess session.Session) error {
	_, err := s.db.Exec(
		`UPDATE project_sessions SET
			current_document_id     = ?,
			caret_atom_id           = ?,
			caret_offset            = ?,
			selection_start_atom_id = ?,
			selection_start_offset  = ?,
			selection_end_atom_id   = ?,
			selection_end_offset    = ?,
			last_activity_at        = ?
		 WHERE project_id = ? AND user_id = ?`,
		sess.CurrentDocumentID,
		sess.CaretAtomID, sess.CaretOffset,
		sess.SelectionStartAtomID, sess.SelectionStartOffset,
		sess.SelectionEndAtomID, sess.SelectionEndOffset,
		sortableTime(sess.LastActivityAt),
		sess.ProjectID, sess.UserID,
	)
	return err
}

func (s *Store) ListProjectSessions(projectID string) ([]session.Session, error) {
	rows, err := s.db.Query(
		`SELECT project_id, user_id, session_id, user_name, user_email,
		        current_document_id,
		        caret_atom_id, caret_offset,
		        selection_start_atom_id, selection_start_offset,
		        selection_end_atom_id, selection_end_offset,
		        started_at, last_activity_at
		   FROM project_sessions
		  WHERE project_id = ?
		  ORDER BY last_activity_at DESC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []session.Session
	for rows.Next() {
		var (
			sess                  session.Session
			started, lastActivity string
		)
		if err := rows.Scan(
			&sess.ProjectID, &sess.UserID, &sess.SessionID, &sess.UserName, &sess.UserEmail,
			&sess.CurrentDocumentID,
			&sess.CaretAtomID, &sess.CaretOffset,
			&sess.SelectionStartAtomID, &sess.SelectionStartOffset,
			&sess.SelectionEndAtomID, &sess.SelectionEndOffset,
			&started, &lastActivity,
		); err != nil {
			return nil, err
		}
		sess.StartedAt, _ = time.Parse(timeLayout, started)
		sess.LastActivityAt, _ = time.Parse(timeLayout, lastActivity)
		result = append(result, sess)
	}
	if result == nil {
		result = []session.Session{}
	}
	return result, rows.Err()
}

func (s *Store) BumpProjectSessionActivity(projectID, userID string, t time.Time) error {
	_, err := s.db.Exec(
		`UPDATE project_sessions SET last_activity_at = ? WHERE project_id = ? AND user_id = ?`,
		sortableTime(t), projectID, userID,
	)
	return err
}

func (s *Store) DeleteStaleProjectSessions(before time.Time) error {
	_, err := s.db.Exec(
		`DELETE FROM project_sessions WHERE last_activity_at < ?`,
		sortableTime(before),
	)
	return err
}
