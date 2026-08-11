// Activity feed reads.
//
// Part of the single SQLite Store: this file holds the activity persistence
// methods. Every file in this package shares one *Store and one connection, so
// the split is organizational — it mirrors the capability boundaries in
// core/capability so each domain's storage is legible on its own.
package sqlite

import (
	"strings"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/activity"
)

// --- Activity Store ---

func (s *Store) ListActivity(projectID, targetID string, before *activity.Boundary, limit int) ([]activity.Event, error) {
	query := `SELECT id, project_id, actor_id, actor_name, action, target_id, target_kind, target_name,
		occurred_at, source_kind, source_id
		FROM activity_events WHERE project_id = ?`
	args := []any{projectID}
	if targetID != "" {
		query += ` AND target_id = ?`
		args = append(args, targetID)
	}
	if before != nil {
		query += ` AND (occurred_at < ? OR (occurred_at = ? AND id < ?))`
		at := sortableTime(before.OccurredAt)
		args = append(args, at, at, before.ID)
	}
	query += ` ORDER BY occurred_at DESC, id DESC LIMIT ?`
	args = append(args, limit)
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]activity.Event, 0, limit)
	for rows.Next() {
		var event activity.Event
		var action, occurred string
		if err := rows.Scan(
			&event.ID, &event.ProjectID, &event.Actor.ID, &event.Actor.Name, &action,
			&event.Target.ID, &event.Target.Kind, &event.Target.Name, &occurred,
			&event.SourceKind, &event.SourceID,
		); err != nil {
			return nil, err
		}
		event.Action = activity.Action(action)
		event.OccurredAt, _ = time.Parse(timeLayout, occurred)
		out = append(out, event)
	}
	return out, rows.Err()
}

func (s *Store) LatestActivityByProjects(projectIDs []string) (map[string]time.Time, error) {
	out := make(map[string]time.Time)
	if len(projectIDs) == 0 {
		return out, nil
	}
	placeholders := strings.TrimSuffix(strings.Repeat("?,", len(projectIDs)), ",")
	args := make([]any, len(projectIDs))
	for i, id := range projectIDs {
		args[i] = id
	}
	rows, err := s.db.Query(
		`SELECT project_id, MAX(occurred_at) FROM activity_events WHERE project_id IN (`+placeholders+`) GROUP BY project_id`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var projectID, occurred string
		if err := rows.Scan(&projectID, &occurred); err != nil {
			return nil, err
		}
		out[projectID], _ = time.Parse(timeLayout, occurred)
	}
	return out, rows.Err()
}
