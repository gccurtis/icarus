// The durable job queue.
//
// Part of the single SQLite Store: this file holds the jobs persistence
// methods. Every file in this package shares one *Store and one connection, so
// the split is organizational — it mirrors the capability boundaries in
// core/capability so each domain's storage is legible on its own.
package sqlite

import (
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/gccurtis/taurus-omega/core/platform/job"
)

// --- job.Store ---

func (s *Store) Enqueue(j job.Job) (job.Job, error) {
	_, err := s.db.Exec(
		`INSERT INTO jobs(id, type, payload, status, attempts, max_attempts, last_error, run_at, created_at, updated_at)
		 VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		j.ID, j.Type, string(j.Payload), string(j.Status), j.Attempts, j.MaxAttempts, j.LastError,
		sortableTime(j.RunAt), j.CreatedAt.Format(timeLayout), j.UpdatedAt.Format(timeLayout),
	)
	return j, err
}

// ClaimDue selects the earliest-due queued job and marks it running in one
// transaction, so under the single writer no two workers claim the same job.
func (s *Store) ClaimDue(now time.Time) (job.Job, bool, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return job.Job{}, false, err
	}
	defer tx.Rollback()

	j, err := scanJob(tx.QueryRow(
		`SELECT id, type, payload, status, attempts, max_attempts, last_error, run_at, created_at, updated_at
		 FROM jobs WHERE status = ? AND run_at <= ? ORDER BY run_at LIMIT 1`,
		string(job.StatusQueued), sortableTime(now)))
	switch {
	case errors.Is(err, job.ErrNotFound):
		return job.Job{}, false, nil
	case err != nil:
		return job.Job{}, false, err
	}

	j.Attempts++
	j.Status = job.StatusRunning
	if _, err := tx.Exec(
		`UPDATE jobs SET status = ?, attempts = ?, updated_at = ? WHERE id = ?`,
		string(j.Status), j.Attempts, now.UTC().Format(timeLayout), j.ID,
	); err != nil {
		return job.Job{}, false, err
	}
	if err := tx.Commit(); err != nil {
		return job.Job{}, false, err
	}
	return j, true, nil
}

func (s *Store) Complete(id string) error { return s.setJobStatus(id, job.StatusDone, "") }

func (s *Store) Fail(id, lastErr string) error { return s.setJobStatus(id, job.StatusFailed, lastErr) }

func (s *Store) Retry(id, lastErr string, runAt time.Time) error {
	_, err := s.db.Exec(
		`UPDATE jobs SET status = ?, last_error = ?, run_at = ?, updated_at = ? WHERE id = ?`,
		string(job.StatusQueued), lastErr, sortableTime(runAt), time.Now().UTC().Format(timeLayout), id,
	)
	return err
}

func (s *Store) setJobStatus(id string, status job.Status, lastErr string) error {
	_, err := s.db.Exec(
		`UPDATE jobs SET status = ?, last_error = ?, updated_at = ? WHERE id = ?`,
		string(status), lastErr, time.Now().UTC().Format(timeLayout), id,
	)
	return err
}

func (s *Store) JobByID(id string) (job.Job, error) {
	return scanJob(s.db.QueryRow(
		`SELECT id, type, payload, status, attempts, max_attempts, last_error, run_at, created_at, updated_at
		 FROM jobs WHERE id = ?`, id))
}

// JobsByStatus is the observability read: jobs of one status (empty means any),
// newest first, bounded by the queue's shared page cap so it can never scan out
// the whole table. Ordering is by the stored created_at text, as everywhere else
// in this store.
func (s *Store) JobsByStatus(status job.Status, limit int) ([]job.Job, error) {
	rows, err := s.db.Query(
		`SELECT id, type, payload, status, attempts, max_attempts, last_error, run_at, created_at, updated_at
		 FROM jobs WHERE (? = '' OR status = ?) ORDER BY created_at DESC, id DESC LIMIT ?`,
		string(status), string(status), job.ClampJobsPage(limit))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []job.Job
	for rows.Next() {
		j, err := scanJob(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, j)
	}
	return out, rows.Err()
}

// JobCounts tallies the queue by status, the summary half of the observability
// read: a growing queued count or any failed count is visible without holding a
// job id.
func (s *Store) JobCounts() (map[job.Status]int, error) {
	rows, err := s.db.Query(`SELECT status, COUNT(*) FROM jobs GROUP BY status`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := make(map[job.Status]int)
	for rows.Next() {
		var status string
		var n int
		if err := rows.Scan(&status, &n); err != nil {
			return nil, err
		}
		counts[job.Status(status)] = n
	}
	return counts, rows.Err()
}

// ReapStale requeues jobs left running since before the given time (their worker
// died), making them due immediately again while preserving their attempt count.
func (s *Store) ReapStale(before time.Time) (int, error) {
	at := before.UTC().Format(timeLayout)
	res, err := s.db.Exec(
		`UPDATE jobs SET status = ?, run_at = ?, updated_at = ? WHERE status = ? AND updated_at < ?`,
		string(job.StatusQueued), sortableTime(before), at, string(job.StatusRunning), at,
	)
	if err != nil {
		return 0, err
	}
	n, err := res.RowsAffected()
	return int(n), err
}

func scanJob(row rowScanner) (job.Job, error) {
	var j job.Job
	var payload, status, runAt, created, updated string
	switch err := row.Scan(&j.ID, &j.Type, &payload, &status, &j.Attempts, &j.MaxAttempts, &j.LastError, &runAt, &created, &updated); {
	case errors.Is(err, sql.ErrNoRows):
		return job.Job{}, job.ErrNotFound
	case err != nil:
		return job.Job{}, err
	}
	j.Payload = json.RawMessage(payload)
	j.Status = job.Status(status)
	j.RunAt, _ = time.Parse(timeLayout, runAt)
	j.CreatedAt, _ = time.Parse(timeLayout, created)
	j.UpdatedAt, _ = time.Parse(timeLayout, updated)
	return j, nil
}
