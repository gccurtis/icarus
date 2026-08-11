// The reference graph (links and backlinks).
//
// Part of the single SQLite Store: this file holds the reference persistence
// methods. Every file in this package shares one *Store and one connection, so
// the split is organizational — it mirrors the capability boundaries in
// core/capability so each domain's storage is legible on its own.
package sqlite

import (
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/reference"
)

// ReplaceOutgoing atomically swaps a resource's outgoing reference edges for a
// new set, so re-indexing a document after an edit leaves exactly its current
// links.
func (s *Store) ReplaceOutgoing(projectID, fromKind, fromID string, edges []reference.StoredEdge) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(
		`DELETE FROM resource_references WHERE project_id = ? AND from_kind = ? AND from_id = ?`,
		projectID, fromKind, fromID,
	); err != nil {
		return err
	}
	for _, e := range edges {
		if _, err := tx.Exec(
			`INSERT OR REPLACE INTO resource_references(project_id, from_kind, from_id, to_kind, to_id, kind, anchor, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
			projectID, e.FromKind, e.FromID, e.ToKind, e.ToID, e.Kind, e.Anchor, e.UpdatedAt.Format(timeLayout),
		); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// Outgoing returns the edges that start at a resource.
func (s *Store) Outgoing(projectID, kind, id string) ([]reference.StoredEdge, error) {
	return s.queryEdges(
		`SELECT from_kind, from_id, to_kind, to_id, kind, anchor, updated_at FROM resource_references
		 WHERE project_id = ? AND from_kind = ? AND from_id = ? ORDER BY to_id, anchor`,
		projectID, kind, id,
	)
}

// Incoming returns the edges that point at a resource — its backlinks.
func (s *Store) Incoming(projectID, kind, id string) ([]reference.StoredEdge, error) {
	return s.queryEdges(
		`SELECT from_kind, from_id, to_kind, to_id, kind, anchor, updated_at FROM resource_references
		 WHERE project_id = ? AND to_kind = ? AND to_id = ? ORDER BY from_id, anchor`,
		projectID, kind, id,
	)
}

func (s *Store) queryEdges(query string, args ...any) ([]reference.StoredEdge, error) {
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var edges []reference.StoredEdge
	for rows.Next() {
		var e reference.StoredEdge
		var updated string
		if err := rows.Scan(&e.FromKind, &e.FromID, &e.ToKind, &e.ToID, &e.Kind, &e.Anchor, &updated); err != nil {
			return nil, err
		}
		e.UpdatedAt, _ = time.Parse(timeLayout, updated)
		edges = append(edges, e)
	}
	return edges, rows.Err()
}
