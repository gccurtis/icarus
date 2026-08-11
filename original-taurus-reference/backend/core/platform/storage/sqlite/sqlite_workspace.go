// Per-user workspace state.
//
// Part of the single SQLite Store: this file holds the workspace persistence
// methods. Every file in this package shares one *Store and one connection, so
// the split is organizational — it mirrors the capability boundaries in
// core/capability so each domain's storage is legible on its own.
package sqlite

import (
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/workspace"
)

// --- Per-user workspace state (opaque JSON, keyed by user × project) ---

func (s *Store) Workspace(userID, projectID string) (workspace.Workspace, error) {
	var state, updated string
	err := s.db.QueryRow(
		`SELECT state, updated_at FROM workspaces WHERE user_id = ? AND project_id = ?`,
		userID, projectID,
	).Scan(&state, &updated)
	if errors.Is(err, sql.ErrNoRows) {
		return workspace.Workspace{}, workspace.ErrNotFound
	}
	if err != nil {
		return workspace.Workspace{}, err
	}
	at, _ := time.Parse(sortableTimeLayout, updated)
	return workspace.Workspace{
		UserID: userID, ProjectID: projectID,
		State: json.RawMessage(state), UpdatedAt: at,
	}, nil
}

func (s *Store) SetWorkspace(w workspace.Workspace) error {
	_, err := s.db.Exec(
		`INSERT INTO workspaces (user_id, project_id, state, updated_at)
		 VALUES (?, ?, ?, ?)
		 ON CONFLICT(user_id, project_id) DO UPDATE SET
			state      = excluded.state,
			updated_at = excluded.updated_at`,
		w.UserID, w.ProjectID, string(w.State), sortableTime(w.UpdatedAt),
	)
	return err
}
