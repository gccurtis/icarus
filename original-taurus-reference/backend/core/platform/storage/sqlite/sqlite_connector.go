// External-source connectors.
//
// Part of the single SQLite Store: this file holds the connector persistence
// methods. Every file in this package shares one *Store and one connection, so
// the split is organizational — it mirrors the capability boundaries in
// core/capability so each domain's storage is legible on its own.
package sqlite

import (
	"database/sql"
	"errors"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/connector"
)

// --- connectors ---

func (s *Store) InsertConnector(c connector.Connector) error {
	_, err := s.db.Exec(
		`INSERT INTO connectors(project_id,id,name,subkind,path,creator_id,created_at,updated_at)
		 VALUES(?,?,?,?,?,?,?,?)`,
		c.ProjectID, c.ID, c.Name, string(c.SubKind), c.Path, c.CreatorID,
		c.CreatedAt.UTC().Format(time.RFC3339Nano), c.UpdatedAt.UTC().Format(time.RFC3339Nano))
	return err
}

func (s *Store) ConnectorByID(projectID, id string) (connector.Connector, error) {
	row := s.db.QueryRow(
		`SELECT project_id,id,name,subkind,path,creator_id,fingerprint,sync_seq,synced_at,
		        failed_attempts,last_error,retry_after,created_at,updated_at
		 FROM connectors WHERE project_id=? AND id=?`, projectID, id)
	return scanConnector(row)
}

func (s *Store) ConnectorSummaries(projectID string) ([]connector.Connector, error) {
	rows, err := s.db.Query(
		`SELECT project_id,id,name,subkind,path,creator_id,fingerprint,sync_seq,synced_at,
		        failed_attempts,last_error,retry_after,created_at,updated_at
		 FROM connectors WHERE project_id=?`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []connector.Connector
	for rows.Next() {
		c, err := scanConnector(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) AllConnectors() ([]connector.Connector, error) {
	rows, err := s.db.Query(
		`SELECT project_id,id,name,subkind,path,creator_id,fingerprint,sync_seq,synced_at,
		        failed_attempts,last_error,retry_after,created_at,updated_at
		 FROM connectors`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []connector.Connector
	for rows.Next() {
		c, err := scanConnector(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) UpdateConnector(c connector.Connector) error {
	res, err := s.db.Exec(
		`UPDATE connectors SET name=?,path=?,updated_at=? WHERE project_id=? AND id=?`,
		c.Name, c.Path, c.UpdatedAt.UTC().Format(time.RFC3339Nano), c.ProjectID, c.ID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return connector.ErrNotFound
	}
	return nil
}

func (s *Store) DeleteConnector(projectID, id string) error {
	res, err := s.db.Exec(`DELETE FROM connectors WHERE project_id=? AND id=?`, projectID, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return connector.ErrNotFound
	}
	return nil
}

// SetConnectorSyncState records a successful sync. It clears the failure columns
// in the same statement: success is what ends a failure, and two writes for one
// fact is how the two would come to disagree.
func (s *Store) SetConnectorSyncState(projectID, id, fingerprint string, seq int64, at time.Time) error {
	stamp := at.UTC().Format(time.RFC3339Nano)
	res, err := s.db.Exec(
		`UPDATE connectors
		 SET fingerprint=?,sync_seq=?,synced_at=?,updated_at=?,
		     failed_attempts=0,last_error='',retry_after=''
		 WHERE project_id=? AND id=?`,
		fingerprint, seq, stamp, stamp, projectID, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return connector.ErrNotFound
	}
	return nil
}

// SetConnectorSyncFailure records a failing sync's attempt count, cause, and the
// earliest the automatic path may try again. It deliberately leaves updated_at
// alone: a failed attempt did not change the connector a person configured, and
// stamping it would make every backoff tick look like an edit in any listing
// ordered by that column.
func (s *Store) SetConnectorSyncFailure(projectID, id string, attempts int, lastErr string, retryAfter time.Time) error {
	var stamp string
	if !retryAfter.IsZero() {
		stamp = retryAfter.UTC().Format(time.RFC3339Nano)
	}
	res, err := s.db.Exec(
		`UPDATE connectors SET failed_attempts=?,last_error=?,retry_after=? WHERE project_id=? AND id=?`,
		attempts, lastErr, stamp, projectID, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return connector.ErrNotFound
	}
	return nil
}

func scanConnector(row rowScanner) (connector.Connector, error) {
	var c connector.Connector
	var sub, fingerprint, syncedAt, retryAfter, createdAt, updatedAt string
	if err := row.Scan(&c.ProjectID, &c.ID, &c.Name, &sub, &c.Path, &c.CreatorID, &fingerprint, &c.SyncSeq, &syncedAt,
		&c.FailedAttempts, &c.LastError, &retryAfter, &createdAt, &updatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return connector.Connector{}, connector.ErrNotFound
		}
		return connector.Connector{}, err
	}
	c.SubKind = connector.SubKind(sub)
	c.Fingerprint = fingerprint
	if syncedAt != "" {
		c.SyncedAt, _ = time.Parse(time.RFC3339Nano, syncedAt)
	}
	if retryAfter != "" {
		c.RetryAfter, _ = time.Parse(time.RFC3339Nano, retryAfter)
	}
	c.CreatedAt, _ = time.Parse(time.RFC3339Nano, createdAt)
	c.UpdatedAt, _ = time.Parse(time.RFC3339Nano, updatedAt)
	return c, nil
}
