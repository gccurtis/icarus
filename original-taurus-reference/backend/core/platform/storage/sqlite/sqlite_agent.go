// Durable agent tasks.
//
// Part of the single SQLite Store: this file holds the agent persistence
// methods. Every file in this package shares one *Store and one connection, so
// the split is organizational — it mirrors the capability boundaries in
// core/capability so each domain's storage is legible on its own.
package sqlite

import (
	"database/sql"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/agent"
	"github.com/gccurtis/taurus-omega/core/capability/persona"
)

// --- agent.TaskStore ---

func (s *Store) CreateTask(task agent.Task) error {
	raw, err := json.Marshal(task)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(
		`INSERT INTO agent_tasks(id, project_id, requester_id, persona_id, state, content, target_document_id, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		task.ID, task.ProjectID, task.RequesterID, task.Persona.ID, task.State, string(raw), task.TargetDocumentID, task.CreatedAt.Format(timeLayout), task.UpdatedAt.Format(timeLayout),
	)
	return err
}

// TasksByDocument returns the project's tasks scoped to one target document.
func (s *Store) TasksByDocument(projectID, documentID string) ([]agent.Task, error) {
	rows, err := s.db.Query(`SELECT content FROM agent_tasks WHERE project_id = ? AND target_document_id = ? ORDER BY created_at`, projectID, documentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tasks []agent.Task
	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		task, err := decodeTask(raw)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, rows.Err()
}

func (s *Store) TaskByID(id string) (agent.Task, error) {
	return scanTask(s.db.QueryRow(`SELECT content FROM agent_tasks WHERE id = ?`, id))
}

func (s *Store) TasksByProject(projectID string) ([]agent.Task, error) {
	rows, err := s.db.Query(`SELECT content FROM agent_tasks WHERE project_id = ? ORDER BY created_at`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tasks []agent.Task
	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		task, err := decodeTask(raw)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, rows.Err()
}

func (s *Store) TasksByPersona(projectID, personaID string) ([]agent.Task, error) {
	rows, err := s.db.Query(`SELECT content FROM agent_tasks WHERE project_id = ? AND persona_id = ? ORDER BY created_at`, projectID, personaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tasks []agent.Task
	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		task, err := decodeTask(raw)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, rows.Err()
}

func (s *Store) UpdateTask(task agent.Task) error {
	raw, err := json.Marshal(task)
	if err != nil {
		return err
	}
	result, err := s.db.Exec(
		`UPDATE agent_tasks SET state = ?, content = ?, updated_at = ? WHERE id = ?`,
		task.State, string(raw), task.UpdatedAt.Format(timeLayout), task.ID,
	)
	if err != nil {
		return err
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if changed == 0 {
		return agent.ErrTaskNotFound
	}
	return nil
}

// BeginTaskRun atomically transitions a queued task to running. It sets the
// content, state, and heartbeat in one conditional UPDATE so two workers
// cannot claim the same task.
func (s *Store) BeginTaskRun(taskID, runID string, content []byte, now time.Time) (agent.Task, error) {
	at := sortableTime(now)
	result, err := s.db.Exec(
		`UPDATE agent_tasks SET state = ?, content = ?, updated_at = ?, heartbeat_at = ? WHERE id = ? AND state = ?`,
		string(agent.TaskStateRunning), string(content), at, at, taskID, string(agent.TaskStateQueued),
	)
	if err != nil {
		return agent.Task{}, err
	}
	changed, _ := result.RowsAffected()
	if changed == 0 {
		_, err := s.TaskByID(taskID)
		if errors.Is(err, agent.ErrTaskNotFound) {
			return agent.Task{}, err
		}
		return agent.Task{}, agent.ErrTaskNotRunnable
	}
	return s.TaskByID(taskID)
}

// BumpHeartbeat updates the heartbeat timestamp on a running task so the reaper
// does not consider it stale.
func (s *Store) BumpHeartbeat(taskID string, now time.Time) error {
	_, err := s.db.Exec(`UPDATE agent_tasks SET heartbeat_at = ? WHERE id = ? AND state = ?`,
		sortableTime(now), taskID, string(agent.TaskStateRunning))
	return err
}

// ReapStaleTasks transitions tasks stuck in running back to queued when their
// heartbeat is older than before.
func (s *Store) ReapStaleTasks(before time.Time) error {
	_, err := s.db.Exec(
		`UPDATE agent_tasks SET state = ?, heartbeat_at = '' WHERE state = ? AND heartbeat_at != '' AND heartbeat_at < ?`,
		string(agent.TaskStateQueued), string(agent.TaskStateRunning), sortableTime(before),
	)
	return err
}

func scanTask(row *sql.Row) (agent.Task, error) {
	var raw string
	if err := row.Scan(&raw); errors.Is(err, sql.ErrNoRows) {
		return agent.Task{}, agent.ErrTaskNotFound
	} else if err != nil {
		return agent.Task{}, err
	}
	return decodeTask(raw)
}

func decodeTask(raw string) (agent.Task, error) {
	var task agent.Task
	if err := json.Unmarshal([]byte(raw), &task); err == nil {
		return task, nil
	}
	var aggregate map[string]json.RawMessage
	if err := json.Unmarshal([]byte(raw), &aggregate); err != nil {
		return agent.Task{}, err
	}
	var snapshot map[string]json.RawMessage
	if err := json.Unmarshal(aggregate["persona"], &snapshot); err != nil {
		return agent.Task{}, err
	}
	var legacyVersion string
	if err := json.Unmarshal(snapshot["version"], &legacyVersion); err != nil {
		return agent.Task{}, err
	}
	version, err := strconv.Atoi(strings.TrimPrefix(legacyVersion, "v"))
	if err != nil || version < 1 {
		return agent.Task{}, errors.New("sqlite: invalid legacy Persona version")
	}
	snapshot["version"], _ = json.Marshal(version)
	if _, exists := snapshot["name"]; !exists {
		var id string
		_ = json.Unmarshal(snapshot["id"], &id)
		name := id
		if id == persona.GeneralID {
			name = "General"
		}
		snapshot["name"], _ = json.Marshal(name)
	}
	aggregate["persona"], _ = json.Marshal(snapshot)
	normalized, err := json.Marshal(aggregate)
	if err != nil {
		return agent.Task{}, err
	}
	if err := json.Unmarshal(normalized, &task); err != nil {
		return agent.Task{}, err
	}
	return task, nil
}
