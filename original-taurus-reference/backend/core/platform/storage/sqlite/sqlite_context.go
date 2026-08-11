// Stored contexts (named resource sets).
//
// Part of the single SQLite Store: this file holds the context persistence
// methods. Every file in this package shares one *Store and one connection, so
// the split is organizational — it mirrors the capability boundaries in
// core/capability so each domain's storage is legible on its own.
package sqlite

import (
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/contexts"
)

// --- contexts ---

func marshalRefs(refs []contexts.Ref) string {
	if len(refs) == 0 {
		return "[]"
	}
	b, err := json.Marshal(refs)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func unmarshalRefs(s string) []contexts.Ref {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	var refs []contexts.Ref
	if err := json.Unmarshal([]byte(s), &refs); err != nil {
		return nil
	}
	return refs
}

func (s *Store) InsertContext(c contexts.Context) error {
	_, err := s.db.Exec(
		`INSERT INTO contexts(project_id,id,name,creator_id,includes_json,excludes_json,created_at,updated_at)
		 VALUES(?,?,?,?,?,?,?,?)`,
		c.ProjectID, c.ID, c.Name, c.CreatorID,
		marshalRefs(c.Includes), marshalRefs(c.Excludes),
		c.CreatedAt.UTC().Format(time.RFC3339Nano), c.UpdatedAt.UTC().Format(time.RFC3339Nano))
	return err
}

func (s *Store) ContextByID(projectID, id string) (contexts.Context, error) {
	row := s.db.QueryRow(
		`SELECT project_id,id,name,creator_id,includes_json,excludes_json,created_at,updated_at
		 FROM contexts WHERE project_id=? AND id=?`, projectID, id)
	return scanContext(row)
}

func (s *Store) ContextSummaries(projectID string) ([]contexts.Context, error) {
	rows, err := s.db.Query(
		`SELECT project_id,id,name,creator_id,includes_json,excludes_json,created_at,updated_at
		 FROM contexts WHERE project_id=?`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []contexts.Context
	for rows.Next() {
		c, err := scanContext(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) UpdateContext(c contexts.Context) error {
	res, err := s.db.Exec(
		`UPDATE contexts SET name=?,includes_json=?,excludes_json=?,updated_at=? WHERE project_id=? AND id=?`,
		c.Name, marshalRefs(c.Includes), marshalRefs(c.Excludes),
		c.UpdatedAt.UTC().Format(time.RFC3339Nano), c.ProjectID, c.ID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return contexts.ErrNotFound
	}
	return nil
}

func (s *Store) DeleteContext(projectID, id string) error {
	res, err := s.db.Exec(`DELETE FROM contexts WHERE project_id=? AND id=?`, projectID, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return contexts.ErrNotFound
	}
	return nil
}

// scanContext reads one contexts row (from *sql.Row or *sql.Rows via the shared
// rowScanner interface declared in sqlite.go).
func scanContext(sc rowScanner) (contexts.Context, error) {
	var c contexts.Context
	var inc, exc, created, updated string
	if err := sc.Scan(&c.ProjectID, &c.ID, &c.Name, &c.CreatorID, &inc, &exc, &created, &updated); err != nil {
		if err == sql.ErrNoRows {
			return contexts.Context{}, contexts.ErrNotFound
		}
		return contexts.Context{}, err
	}
	c.Includes = unmarshalRefs(inc)
	c.Excludes = unmarshalRefs(exc)
	c.CreatedAt, _ = time.Parse(time.RFC3339Nano, created)
	c.UpdatedAt, _ = time.Parse(time.RFC3339Nano, updated)
	return c, nil
}
