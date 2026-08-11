# sqlite.go

`sqlite.go` is the **durable** implementation of the access layer's storage
seams. Where `access/store.go` declares four interfaces — `UserStore`,
`ProjectStore`, `MembershipStore`, and `SessionStore` — this file provides a
single `Store` type that satisfies all four against a SQLite database. It is the
backend the `Access` service runs on in production.

It uses the pure-Go `modernc.org/sqlite` driver, chosen so the core builds with a
plain `go build` and no cgo toolchain. `Open` handles everything needed to reach
a ready database: it creates the parent directory, opens the connection, pins it
to a single writer to sidestep SQLite's "database is locked" contention, and
applies an idempotent schema migration. The rest of the file is a straightforward
mapping of each interface method to a parameterized SQL statement, with small
scan helpers that translate `sql.ErrNoRows` into the package's shared
`access.ErrNotFound`.

One consistent convention runs through the file: timestamps are stored as RFC3339
text with nanosecond precision rather than as native SQLite time, keeping the
database file portable and human-readable. The four interface groups are marked
with comment banners and kept in the same order as the interfaces they implement.

## Code breakdown

### Package documentation and declaration

```go
// Package sqlite is the durable, SQLite-backed implementation of the access
// storage interfaces. It uses the pure-Go modernc.org/sqlite driver, so it
// builds with plain `go build` (no cgo). A single Store value implements every
// access store interface (users, projects, memberships, sessions).
package sqlite
```

The doc comment states the package's role and the two facts that most shape it:
it is the durable backend for the access stores, and it uses the pure-Go driver so
no cgo is required. It also notes the design that a single `Store` value covers
all four store interfaces.

### Imports

```go
import (
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"

	"github.com/gccurtis/taurus-omega/core/access"
)
```

`database/sql` is the standard SQL layer this store is built on, `errors` provides
`errors.Is` for detecting `sql.ErrNoRows`, and `os`/`path/filepath` create the
database's parent directory. `time` parses and formats the text timestamps. The
blank import of `modernc.org/sqlite` registers the pure-Go driver under the name
`"sqlite"` without referencing it directly. The `access` import supplies the
domain types this store reads and writes, and the `ErrNotFound` sentinel it
returns.

### The timestamp layout

```go
// timeLayout is how timestamps are stored: RFC3339 with nanoseconds, in text, so
// values are portable and human-readable in the database file.
const timeLayout = time.RFC3339Nano
```

`timeLayout` fixes the on-disk timestamp format for the whole file: RFC3339 with
nanoseconds, as text. Storing times this way — rather than as SQLite's native
numeric time — keeps the database file portable across tools and readable by a
human inspecting it directly. Every `Format` and `Parse` call below uses this
single constant.

### The Store type

```go
// Store is a SQLite-backed implementation of the access stores.
type Store struct {
	db *sql.DB
}
```

`Store` is the whole implementation, and it holds nothing but the `*sql.DB`
handle. Because every store method is defined on this one type, a single `Store`
value simultaneously satisfies all four access store interfaces — which is exactly
what the `access.Stores` aggregate expects.

### Opening the database

```go
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
```

`Open` is the constructor and does all the setup needed to hand back a usable
store. It first ensures the parent directory of the DSN exists (skipping the case
where the path has no meaningful directory), then opens the connection against the
registered `"sqlite"` driver. The deliberate `SetMaxOpenConns(1)` caps the pool at
a single connection so writes serialize — the simplest robust way to avoid
SQLite's "database is locked" errors under concurrency. It pings to confirm the
connection is live, then runs `migrate` to apply the schema before returning the
ready `Store`.

### Closing the database

```go
// Close closes the underlying database.
func (s *Store) Close() error { return s.db.Close() }
```

`Close` releases the underlying connection pool, forwarding directly to the
standard library's `db.Close`.

### The schema migration

```go
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
```

`migrate` applies the schema, one table per domain type: `users`, `projects`,
`memberships`, and `sessions`. Each statement is `CREATE TABLE IF NOT EXISTS`, so
migration is idempotent and safe to run on every `Open`. The schema encodes the
domain's rules structurally — the unique email on `users`, the foreign keys tying
projects, memberships, and sessions back to their users, the composite primary key
on `memberships` that prevents duplicate links, and the empty-string default for a
session's `project_id` mirroring "no project selected yet". Timestamps are `TEXT`
columns, consistent with the text time layout.

### UserStore: create and look up users

```go
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
```

This group implements `UserStore`. `CreateUser` inserts a row, formatting the
`CreatedAt` time through the shared layout. `UserByID` and `UserByEmail` are the
two lookups the `Access` service needs — the latter backing both registration's
"email taken?" check and login — and both defer to `scanUser`. `scanUser` is the
shared row decoder that establishes the file's error convention: it maps
`sql.ErrNoRows` to `access.ErrNotFound` (the sentinel callers check with
`errors.Is`), propagates any other error, and otherwise parses the stored text
timestamp back into `time.Time`.

### ProjectStore: create, look up, and list projects

```go
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
```

This group implements `ProjectStore`, following the same shape as users.
`CreateProject` inserts a row and `ProjectByID` reads one back via the
`scanProject` helper — the project mirror of `scanUser`, with the identical
`ErrNotFound` mapping. `ProjectsByUser` is the one genuinely relational query in
the file: it joins `projects` to `memberships` on the project ID and filters by
user, so it returns exactly the projects the user is a member of, ordered by
creation time. It iterates the result set, parsing each timestamp, and returns
`rows.Err()` so an error that surfaces only at the end of iteration is not lost.

### MembershipStore: link users to projects and test membership

```go
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
```

This group implements `MembershipStore`, the basis for project isolation.
`AddMembership` uses `INSERT OR IGNORE` so re-adding an existing link is a no-op
rather than a primary-key error — making the operation idempotent. `IsMember` is
the check `SelectProject` relies on before letting a user pick a project: it
selects a sentinel `1` for the pairing and interprets the outcome by presence —
`sql.ErrNoRows` means not a member (`false`, no error), a returned row means member
(`true`), and any other error propagates. Here absence is a normal answer, not
`ErrNotFound`.

### SessionStore: create, read, update, and delete sessions

```go
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
```

This final group implements `SessionStore`, the full lifecycle of a session.
`CreateSession` inserts a new session (formatting both timestamps), and
`SessionByID` reads one back — inlining its scan rather than using a helper, but
with the same `ErrNoRows` → `ErrNotFound` mapping and parsing both the created and
expiry times. `UpdateSession` rewrites a session's mutable fields, which is what
`SelectProject` uses to attach a chosen project to an existing session.
`DeleteSession` removes it, backing both logout and the deletion of an expired
session during `Resolve`.
