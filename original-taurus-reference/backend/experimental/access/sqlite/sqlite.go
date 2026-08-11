// Package sqlite is the durable, SQLite-backed implementation of the access
// storage interfaces. It uses the pure-Go modernc.org/sqlite driver, so it
// builds with plain `go build` (no cgo). A single Store value implements every
// access store interface (users, projects, memberships, sessions).
package sqlite

import (
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"

	"github.com/gccurtis/taurus-omega/core/access"
)

// timeLayout is how timestamps are stored: RFC3339 with nanoseconds, in text, so
// values are portable and human-readable in the database file.
const timeLayout = time.RFC3339Nano

// Store is a SQLite-backed implementation of the access stores.
type Store struct {
	db *sql.DB
}

// Open opens (creating if needed) the SQLite database at dsn, applies the
// schema, and returns a ready Store. The parent directory is created if missing.
func Open(dsn string) (*Store, error) {
	if dir := filepath.Dir(dsn); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, err
		}
	}

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// One writer at a time keeps SQLite simple and avoids "database is locked".
	db.SetMaxOpenConns(1)
	if err := db.Ping(); err != nil {
		return nil, err
	}

	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		return nil, err
	}
	return s, nil
}

// Close closes the underlying database.
func (s *Store) Close() error { return s.db.Close() }

func (s *Store) migrate() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id            TEXT PRIMARY KEY,
			email         TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			created_at    TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS projects (
			id         TEXT PRIMARY KEY,
			owner_id   TEXT NOT NULL REFERENCES users(id),
			name       TEXT NOT NULL,
			created_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS memberships (
			user_id    TEXT NOT NULL REFERENCES users(id),
			project_id TEXT NOT NULL REFERENCES projects(id),
			PRIMARY KEY (user_id, project_id)
		)`,
		`CREATE TABLE IF NOT EXISTS sessions (
			id         TEXT PRIMARY KEY,
			user_id    TEXT NOT NULL REFERENCES users(id),
			project_id TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL,
			expires_at TEXT NOT NULL
		)`,
	}
	for _, stmt := range stmts {
		if _, err := s.db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

// --- UserStore ---

func (s *Store) CreateUser(u access.User) error {
	_, err := s.db.Exec(
		`INSERT INTO users(id, email, password_hash, created_at) VALUES(?, ?, ?, ?)`,
		u.ID, u.Email, u.PasswordHash, u.CreatedAt.Format(timeLayout),
	)
	return err
}

func (s *Store) UserByID(id string) (access.User, error) {
	return scanUser(s.db.QueryRow(
		`SELECT id, email, password_hash, created_at FROM users WHERE id = ?`, id))
}

func (s *Store) UserByEmail(email string) (access.User, error) {
	return scanUser(s.db.QueryRow(
		`SELECT id, email, password_hash, created_at FROM users WHERE email = ?`, email))
}

func scanUser(row *sql.Row) (access.User, error) {
	var u access.User
	var created string
	switch err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &created); {
	case errors.Is(err, sql.ErrNoRows):
		return access.User{}, access.ErrNotFound
	case err != nil:
		return access.User{}, err
	}
	u.CreatedAt, _ = time.Parse(timeLayout, created)
	return u, nil
}

// --- ProjectStore ---

func (s *Store) CreateProject(p access.Project) error {
	_, err := s.db.Exec(
		`INSERT INTO projects(id, owner_id, name, created_at) VALUES(?, ?, ?, ?)`,
		p.ID, p.OwnerID, p.Name, p.CreatedAt.Format(timeLayout),
	)
	return err
}

func (s *Store) ProjectByID(id string) (access.Project, error) {
	return scanProject(s.db.QueryRow(
		`SELECT id, owner_id, name, created_at FROM projects WHERE id = ?`, id))
}

func (s *Store) ProjectsByUser(userID string) ([]access.Project, error) {
	rows, err := s.db.Query(`
		SELECT p.id, p.owner_id, p.name, p.created_at
		FROM projects p
		JOIN memberships m ON m.project_id = p.id
		WHERE m.user_id = ?
		ORDER BY p.created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []access.Project
	for rows.Next() {
		var p access.Project
		var created string
		if err := rows.Scan(&p.ID, &p.OwnerID, &p.Name, &created); err != nil {
			return nil, err
		}
		p.CreatedAt, _ = time.Parse(timeLayout, created)
		projects = append(projects, p)
	}
	return projects, rows.Err()
}

func scanProject(row *sql.Row) (access.Project, error) {
	var p access.Project
	var created string
	switch err := row.Scan(&p.ID, &p.OwnerID, &p.Name, &created); {
	case errors.Is(err, sql.ErrNoRows):
		return access.Project{}, access.ErrNotFound
	case err != nil:
		return access.Project{}, err
	}
	p.CreatedAt, _ = time.Parse(timeLayout, created)
	return p, nil
}

// --- MembershipStore ---

func (s *Store) AddMembership(m access.Membership) error {
	_, err := s.db.Exec(
		`INSERT OR IGNORE INTO memberships(user_id, project_id) VALUES(?, ?)`,
		m.UserID, m.ProjectID,
	)
	return err
}

func (s *Store) IsMember(userID, projectID string) (bool, error) {
	var one int
	err := s.db.QueryRow(
		`SELECT 1 FROM memberships WHERE user_id = ? AND project_id = ?`,
		userID, projectID,
	).Scan(&one)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// --- SessionStore ---

func (s *Store) CreateSession(sess access.Session) error {
	_, err := s.db.Exec(
		`INSERT INTO sessions(id, user_id, project_id, created_at, expires_at) VALUES(?, ?, ?, ?, ?)`,
		sess.ID, sess.UserID, sess.ProjectID,
		sess.CreatedAt.Format(timeLayout), sess.ExpiresAt.Format(timeLayout),
	)
	return err
}

func (s *Store) SessionByID(id string) (access.Session, error) {
	var sess access.Session
	var created, expires string
	err := s.db.QueryRow(
		`SELECT id, user_id, project_id, created_at, expires_at FROM sessions WHERE id = ?`, id,
	).Scan(&sess.ID, &sess.UserID, &sess.ProjectID, &created, &expires)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return access.Session{}, access.ErrNotFound
	case err != nil:
		return access.Session{}, err
	}
	sess.CreatedAt, _ = time.Parse(timeLayout, created)
	sess.ExpiresAt, _ = time.Parse(timeLayout, expires)
	return sess, nil
}

func (s *Store) UpdateSession(sess access.Session) error {
	_, err := s.db.Exec(
		`UPDATE sessions SET user_id = ?, project_id = ?, created_at = ?, expires_at = ? WHERE id = ?`,
		sess.UserID, sess.ProjectID,
		sess.CreatedAt.Format(timeLayout), sess.ExpiresAt.Format(timeLayout), sess.ID,
	)
	return err
}

func (s *Store) DeleteSession(id string) error {
	_, err := s.db.Exec(`DELETE FROM sessions WHERE id = ?`, id)
	return err
}
