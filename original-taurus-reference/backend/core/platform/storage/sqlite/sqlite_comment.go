// Anchored document comments and their replies.
//
// Part of the single SQLite Store: this file holds the comment persistence
// methods. Every file in this package shares one *Store and one connection, so
// the split is organizational — it mirrors the capability boundaries in
// core/capability so each domain's storage is legible on its own.
package sqlite

import (
	"database/sql"
	"errors"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/comment"
)

// --- Comments (anchored document discussion) ---

// CreateComment inserts a new comment.
func (s *Store) CreateComment(c comment.Comment) error {
	_, err := s.db.Exec(
		`INSERT INTO document_comments(id, project_id, document_id, anchor_id, author_id, author_name, body, resolved, created_at, updated_at)
		 VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		c.ID, c.ProjectID, c.DocumentID, c.AnchorID, c.AuthorID, c.AuthorName, c.Body,
		boolToInt(c.Resolved), c.CreatedAt.Format(timeLayout), c.UpdatedAt.Format(timeLayout),
	)
	return err
}

// CommentByID returns one comment without its replies, scoped to its project.
// The project id is part of the WHERE clause rather than a check the caller is
// trusted to make: a comment owned by another project reads as ErrNotFound
// here, in SQL. The service still compares ProjectID after loading — two
// independent layers, neither load-bearing alone.
func (s *Store) CommentByID(projectID, id string) (comment.Comment, error) {
	return scanComment(s.db.QueryRow(
		`SELECT id, project_id, document_id, anchor_id, author_id, author_name, body, resolved, created_at, updated_at
		 FROM document_comments WHERE id = ? AND project_id = ?`, id, projectID))
}

// CommentsByDocument returns a document's comments in creation order, optionally
// filtered to open (resolved=false) or resolved (resolved=true).
func (s *Store) CommentsByDocument(projectID, documentID string, resolved *bool) ([]comment.Comment, error) {
	query := `SELECT id, project_id, document_id, anchor_id, author_id, author_name, body, resolved, created_at, updated_at
		 FROM document_comments WHERE project_id = ? AND document_id = ?`
	args := []any{projectID, documentID}
	if resolved != nil {
		query += ` AND resolved = ?`
		args = append(args, boolToInt(*resolved))
	}
	query += ` ORDER BY created_at, id`
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []comment.Comment
	for rows.Next() {
		c, err := scanComment(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// UpdateComment persists a comment's body, resolved state, and updated time.
func (s *Store) UpdateComment(c comment.Comment) error {
	_, err := s.db.Exec(
		`UPDATE document_comments SET body = ?, resolved = ?, updated_at = ? WHERE id = ?`,
		c.Body, boolToInt(c.Resolved), c.UpdatedAt.Format(timeLayout), c.ID,
	)
	return err
}

// DeleteComment removes a comment and cascades its replies in one transaction.
func (s *Store) DeleteComment(id string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM comment_replies WHERE comment_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM document_comments WHERE id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

// AddReply appends a reply to a comment thread.
func (s *Store) AddReply(r comment.Reply) error {
	_, err := s.db.Exec(
		`INSERT INTO comment_replies(id, comment_id, project_id, author_id, author_name, body, created_at)
		 VALUES(?, ?, ?, ?, ?, ?, ?)`,
		r.ID, r.CommentID, r.ProjectID, r.AuthorID, r.AuthorName, r.Body, r.CreatedAt.Format(timeLayout),
	)
	return err
}

// RepliesByComment returns a comment's replies in creation order.
func (s *Store) RepliesByComment(commentID string) ([]comment.Reply, error) {
	rows, err := s.db.Query(
		`SELECT id, comment_id, project_id, author_id, author_name, body, created_at
		 FROM comment_replies WHERE comment_id = ? ORDER BY created_at, id`, commentID)
	if err != nil {
		return nil, err
	}
	return scanReplies(rows)
}

// RepliesByComments loads several threads in one query, grouped by comment id.
// Listing a document's comments would otherwise fire one RepliesByComment per
// comment — an N+1 on the hot thread-page read. The ordering within each thread
// matches RepliesByComment (`created_at, id`), so the batched and single-comment
// paths agree; comments with no replies are simply absent from the map.
func (s *Store) RepliesByComments(commentIDs []string) (map[string][]comment.Reply, error) {
	out := map[string][]comment.Reply{}
	if len(commentIDs) == 0 {
		return out, nil
	}
	ph, args := inPlaceholders(commentIDs)
	rows, err := s.db.Query(
		`SELECT id, comment_id, project_id, author_id, author_name, body, created_at
		 FROM comment_replies WHERE comment_id IN (`+ph+`) ORDER BY created_at, id`, args...)
	if err != nil {
		return nil, err
	}
	replies, err := scanReplies(rows)
	if err != nil {
		return nil, err
	}
	for _, r := range replies {
		out[r.CommentID] = append(out[r.CommentID], r)
	}
	return out, nil
}

// scanReplies drains a reply query into ordered Replies and closes the rows.
func scanReplies(rows *sql.Rows) ([]comment.Reply, error) {
	defer rows.Close()
	var out []comment.Reply
	for rows.Next() {
		var r comment.Reply
		var created string
		if err := rows.Scan(&r.ID, &r.CommentID, &r.ProjectID, &r.AuthorID, &r.AuthorName, &r.Body, &created); err != nil {
			return nil, err
		}
		r.CreatedAt, _ = time.Parse(timeLayout, created)
		out = append(out, r)
	}
	return out, rows.Err()
}

func scanComment(row rowScanner) (comment.Comment, error) {
	var c comment.Comment
	var resolved int
	var created, updated string
	if err := row.Scan(&c.ID, &c.ProjectID, &c.DocumentID, &c.AnchorID, &c.AuthorID, &c.AuthorName, &c.Body, &resolved, &created, &updated); errors.Is(err, sql.ErrNoRows) {
		return comment.Comment{}, comment.ErrNotFound
	} else if err != nil {
		return comment.Comment{}, err
	}
	c.Resolved = resolved != 0
	c.CreatedAt, _ = time.Parse(timeLayout, created)
	c.UpdatedAt, _ = time.Parse(timeLayout, updated)
	return c, nil
}
