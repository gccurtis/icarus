// Resource catalog attributes: pinning and access scopes.
//
// Part of the single SQLite Store: this file holds the resource persistence
// methods. Every file in this package shares one *Store and one connection, so
// the split is organizational — it mirrors the capability boundaries in
// core/capability so each domain's storage is legible on its own.
package sqlite

import (
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/gccurtis/taurus-omega/core/capability/resource"
)

// --- Resource catalog attributes (pinning) ---

// GetResourceAttributes returns a resource's catalog attributes, or the zero
// value when none are set.
func (s *Store) ResourceAttributes(projectID string, kind resource.Kind, id string) (resource.Attributes, error) {
	var pinned int
	var access string
	err := s.db.QueryRow(
		`SELECT pinned, access FROM resource_attributes WHERE project_id = ? AND kind = ? AND resource_id = ?`,
		projectID, string(kind), id,
	).Scan(&pinned, &access)
	if errors.Is(err, sql.ErrNoRows) {
		return resource.Attributes{}, nil
	}
	if err != nil {
		return resource.Attributes{}, err
	}
	return resource.Attributes{Pinned: pinned != 0, Access: decodeAccessScope(access)}, nil
}

// SetResourceAttributes replaces a resource's catalog attributes, deleting the
// row when nothing is set so the table only holds real restrictions.
func (s *Store) SetResourceAttributes(projectID string, kind resource.Kind, id string, attrs resource.Attributes) error {
	if attrs.IsZero() {
		_, err := s.db.Exec(
			`DELETE FROM resource_attributes WHERE project_id = ? AND kind = ? AND resource_id = ?`,
			projectID, string(kind), id)
		return err
	}
	_, err := s.db.Exec(
		`INSERT INTO resource_attributes(project_id, kind, resource_id, pinned, access) VALUES(?, ?, ?, ?, ?)
		 ON CONFLICT(project_id, kind, resource_id) DO UPDATE SET pinned = excluded.pinned, access = excluded.access`,
		projectID, string(kind), id, boolToInt(attrs.Pinned), encodeAccessScope(attrs.Access),
	)
	return err
}

// ResourceAttributesByProject returns every set attribute in a project keyed by
// kind and id.
func (s *Store) ResourceAttributesByProject(projectID string) (map[resource.AttributeKey]resource.Attributes, error) {
	rows, err := s.db.Query(`SELECT kind, resource_id, pinned, access FROM resource_attributes WHERE project_id = ?`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[resource.AttributeKey]resource.Attributes{}
	for rows.Next() {
		var kind, id, access string
		var pinned int
		if err := rows.Scan(&kind, &id, &pinned, &access); err != nil {
			return nil, err
		}
		out[resource.AttributeKey{Kind: resource.Kind(kind), ID: id}] = resource.Attributes{Pinned: pinned != 0, Access: decodeAccessScope(access)}
	}
	return out, rows.Err()
}

// encodeAccessScope serializes an access scope to JSON, or "" for the default
// (nil) scope so an unrestricted resource stores no scope text.
func encodeAccessScope(scope *resource.AccessScope) string {
	if scope == nil {
		return ""
	}
	raw, err := json.Marshal(scope)
	if err != nil {
		return ""
	}
	return string(raw)
}

// decodeAccessScope parses a stored access scope; empty or malformed text is the
// default (nil) scope.
func decodeAccessScope(text string) *resource.AccessScope {
	if text == "" {
		return nil
	}
	var scope resource.AccessScope
	if err := json.Unmarshal([]byte(text), &scope); err != nil {
		return nil
	}
	return &scope
}
