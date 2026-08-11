// The per-project formula name manager.
//
// Part of the single SQLite Store: this file holds the formula_names persistence
// methods. Every file in this package shares one *Store and one connection, so
// the split is organizational — it mirrors the capability boundaries in
// core/capability so each domain's storage is legible on its own.
package sqlite

import (
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/formula/names"
)

// --- names.NameStore ---

// scalarEntry reports whether an entry type stores its payload in the value
// column (a scalar) rather than in schema/rows (a table) or source (a
// function).
func scalarEntry(t names.EntryType) bool {
	switch t {
	case names.TypeNull, names.TypeNumber, names.TypeText, names.TypeLogic:
		return true
	default:
		return false
	}
}

// marshalName serializes an entry's payload columns. value is meaningful only
// for a scalar, schema/rows only for a table; the unused columns are stored as
// harmless "null"/"[]" JSON and ignored on read (see scanName).
func marshalName(entry names.Entry) (value, schema, rows string, err error) {
	v := []byte("null")
	if scalarEntry(entry.Type) {
		if v, err = json.Marshal(entry.Value); err != nil {
			return "", "", "", err
		}
	}
	sc, err := json.Marshal(entry.Schema)
	if err != nil {
		return "", "", "", err
	}
	rw, err := json.Marshal(entry.Rows)
	if err != nil {
		return "", "", "", err
	}
	return string(v), string(sc), string(rw), nil
}

// PutName upserts one name-manager entry. It stamps updated_at on every write
// and, via ON CONFLICT, leaves created_at untouched on an update — only an
// insert sets it.
func (s *Store) PutName(project string, entry names.Entry) error {
	value, schema, rows, err := marshalName(entry)
	if err != nil {
		return err
	}
	now := time.Now().UTC().Format(timeLayout)
	_, err = s.db.Exec(`
		INSERT INTO formula_names(project_id, name, type, value, schema, rows, source, created_at, updated_at)
		VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(project_id, name) DO UPDATE SET
			type = excluded.type,
			value = excluded.value,
			schema = excluded.schema,
			rows = excluded.rows,
			source = excluded.source,
			updated_at = excluded.updated_at`,
		project, entry.Name, string(entry.Type), value, schema, rows, entry.Source, now, now,
	)
	return err
}

// UpdateName reads, mutates, and writes an entry inside one immediate
// transaction (BEGIN takes the write lock up front, see pragmaDSN), so
// concurrent read-modify-write callers are serialized and cannot lose an update.
func (s *Store) UpdateName(project, name string, mutate func(names.Entry) (names.Entry, error)) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	entry, err := scanName(tx.QueryRow(
		`SELECT name, type, value, schema, rows, source, created_at, updated_at
		 FROM formula_names WHERE project_id = ? AND name = ?`, project, name))
	if err != nil {
		return err
	}
	updated, err := mutate(entry)
	if err != nil {
		return err
	}
	value, schema, rows, err := marshalName(updated)
	if err != nil {
		return err
	}
	now := time.Now().UTC().Format(timeLayout)
	if _, err := tx.Exec(
		`UPDATE formula_names SET type = ?, value = ?, schema = ?, rows = ?, source = ?, updated_at = ?
		 WHERE project_id = ? AND name = ?`,
		string(updated.Type), value, schema, rows, updated.Source, now, project, name); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) Name(project, name string) (names.Entry, error) {
	return scanName(s.db.QueryRow(
		`SELECT name, type, value, schema, rows, source, created_at, updated_at
		 FROM formula_names WHERE project_id = ? AND name = ?`, project, name))
}

func (s *Store) Names(project string) ([]names.Entry, error) {
	rows, err := s.db.Query(
		`SELECT name, type, value, schema, rows, source, created_at, updated_at
		 FROM formula_names WHERE project_id = ? ORDER BY name`, project)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []names.Entry
	for rows.Next() {
		e, err := scanName(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s *Store) DeleteName(project, name string) error {
	res, err := s.db.Exec(`DELETE FROM formula_names WHERE project_id = ? AND name = ?`, project, name)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return names.ErrNotFound
	}
	return nil
}

// scanName decodes one formula_names row into an Entry, unmarshaling the
// value/schema/rows JSON columns only when the entry's type actually carries
// them (a scalar's value, or a table's schema and rows).
func scanName(row rowScanner) (names.Entry, error) {
	var e names.Entry
	var typ, value, schema, rowsJSON, created, updated string
	switch err := row.Scan(&e.Name, &typ, &value, &schema, &rowsJSON, &e.Source, &created, &updated); {
	case errors.Is(err, sql.ErrNoRows):
		return names.Entry{}, names.ErrNotFound
	case err != nil:
		return names.Entry{}, err
	}
	e.Type = names.EntryType(typ)
	if scalarEntry(e.Type) {
		if err := json.Unmarshal([]byte(value), &e.Value); err != nil {
			return names.Entry{}, err
		}
	}
	if e.Type == names.TypeTable {
		if err := json.Unmarshal([]byte(schema), &e.Schema); err != nil {
			return names.Entry{}, err
		}
		if err := json.Unmarshal([]byte(rowsJSON), &e.Rows); err != nil {
			return names.Entry{}, err
		}
	}
	e.CreatedAt, _ = time.Parse(timeLayout, created)
	e.UpdatedAt, _ = time.Parse(timeLayout, updated)
	return e, nil
}
