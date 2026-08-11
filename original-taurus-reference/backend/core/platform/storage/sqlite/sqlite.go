// Package sqlite is the durable, SQLite-backed store for the whole application.
// It uses the pure-Go modernc.org/sqlite driver, so it builds with plain
// `go build` (no cgo). A single Store value implements every persistence
// interface — the access stores (users, sessions, projects, memberships) and the
// document store — so one connection, and one file, backs all of them and every
// resource survives a restart.
package sqlite

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"

	"github.com/gccurtis/taurus-omega/core/capability/agent"
	"github.com/gccurtis/taurus-omega/core/capability/chat"
	"github.com/gccurtis/taurus-omega/core/capability/comment"
	"github.com/gccurtis/taurus-omega/core/capability/file"
	"github.com/gccurtis/taurus-omega/core/capability/organization"
	"github.com/gccurtis/taurus-omega/core/capability/persona"
	"github.com/gccurtis/taurus-omega/core/capability/reference"
	"github.com/gccurtis/taurus-omega/core/capability/resource"
	"github.com/gccurtis/taurus-omega/core/capability/workspace"
)

// timeLayout is how timestamps are stored: RFC3339 with nanoseconds, as text, so
// values are portable and human-readable in the database file.
const timeLayout = time.RFC3339Nano

// sortableTimeLayout stores a timestamp with a fixed-width fractional second, so
// lexical comparison in SQL matches chronological order. RFC3339Nano trims
// trailing zeros, which would break a `run_at <= ?` range query; the jobs table
// uses this layout for run_at. time.Parse(timeLayout, ...) still reads it back.
const sortableTimeLayout = "2006-01-02T15:04:05.000000000Z07:00"

func sortableTime(t time.Time) string { return t.UTC().Format(sortableTimeLayout) }

// Store is a SQLite-backed implementation of the access stores.
type Store struct {
	db                 *sql.DB
	documentStyleScrub documentStyleScrubReport
}

// Open opens (creating if needed) the SQLite database at dsn, applies the schema,
// and returns a ready Store. The parent directory is created if missing.
func Open(dsn string) (*Store, error) {
	if dir := filepath.Dir(dsn); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, err
		}
	}

	db, err := sql.Open("sqlite", pragmaDSN(dsn))
	if err != nil {
		return nil, err
	}
	// WAL lets readers run concurrently with a writer, so a modest connection pool
	// gives real read concurrency. Writes still serialize on SQLite's single
	// writer; busy_timeout makes a contended write wait rather than fail, and
	// immediate transactions (set in pragmaDSN) take the write lock up front — so
	// the read-then-write transactions (change-set seq assignment, job claiming)
	// cannot interleave and race on a stale read.
	db.SetMaxOpenConns(maxOpenConns)
	if err := db.Ping(); err != nil {
		return nil, err
	}

	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		return nil, err
	}
	return s, nil
}

// maxOpenConns bounds the connection pool. With WAL, up to this many reads run
// concurrently; writes still serialize on SQLite's single writer.
const maxOpenConns = 8

// pragmaDSN turns a plain database path into a modernc DSN that applies, on every
// connection: WAL journaling (readers do not block the writer), a busy timeout (a
// contended write waits instead of erroring), and immediate transactions (BEGIN
// takes the write lock up front). A DSN that is already a file: URI or in-memory
// is returned unchanged.
func pragmaDSN(dsn string) string {
	if strings.HasPrefix(dsn, "file:") || strings.Contains(dsn, ":memory:") {
		return dsn
	}
	return "file:" + dsn + "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_txlock=immediate"
}

// Close closes the underlying database.
func (s *Store) Close() error { return s.db.Close() }

// rowScanner is satisfied by both *sql.Row and *sql.Rows, so one scan routine
// serves DocumentByID and the DocumentsByProject loop.
type rowScanner interface {
	Scan(dest ...any) error
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// Compile-time interface assertions.
var _ agent.TaskStore = (*Store)(nil)
var _ chat.ChatStore = (*Store)(nil)
var _ chat.AttachmentStore = (*Store)(nil)
var _ workspace.Store = (*Store)(nil)

var _ comment.Store = (*Store)(nil)
var _ file.Store = (*Store)(nil)
var _ organization.Store = (*Store)(nil)
var _ persona.Store = (*Store)(nil)
var _ reference.Store = (*Store)(nil)
var _ resource.AttributeStore = (*Store)(nil)
