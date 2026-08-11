// Personas and their versions.
//
// Part of the single SQLite Store: this file holds the persona persistence
// methods. Every file in this package shares one *Store and one connection, so
// the split is organizational — it mirrors the capability boundaries in
// core/capability so each domain's storage is legible on its own.
package sqlite

import (
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/persona"
)

// --- persona.Store ---

func (s *Store) CreatePersona(item persona.Persona, version persona.Version) error {
	definition, err := json.Marshal(version.Definition)
	if err != nil {
		return err
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`INSERT INTO personas(project_id, id, name, description, current_version, created_by, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
		item.ProjectID, item.ID, item.Name, item.Description, item.CurrentVersion, item.CreatedBy, item.CreatedAt.Format(timeLayout), item.UpdatedAt.Format(timeLayout)); err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return persona.ErrAlreadyExists
		}
		return err
	}
	if _, err := tx.Exec(`INSERT INTO persona_versions(project_id, persona_id, version, definition, created_by, created_at) VALUES(?, ?, ?, ?, ?, ?)`,
		version.ProjectID, version.PersonaID, version.Version, string(definition), version.CreatedBy, version.CreatedAt.Format(timeLayout)); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) UpdatePersonaVersion(item persona.Persona, version persona.Version, expectedVersion int) error {
	definition, err := json.Marshal(version.Definition)
	if err != nil {
		return err
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.Exec(`UPDATE personas SET name = ?, description = ?, current_version = ?, updated_at = ? WHERE project_id = ? AND id = ? AND current_version = ?`,
		item.Name, item.Description, item.CurrentVersion, item.UpdatedAt.Format(timeLayout), item.ProjectID, item.ID, expectedVersion)
	if err != nil {
		return err
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if changed == 0 {
		var exists int
		if err := tx.QueryRow(`SELECT COUNT(*) FROM personas WHERE project_id = ? AND id = ?`, item.ProjectID, item.ID).Scan(&exists); err != nil {
			return err
		}
		if exists == 0 {
			return persona.ErrNotFound
		}
		return persona.ErrVersionConflict
	}
	if _, err := tx.Exec(`INSERT INTO persona_versions(project_id, persona_id, version, definition, created_by, created_at) VALUES(?, ?, ?, ?, ?, ?)`,
		version.ProjectID, version.PersonaID, version.Version, string(definition), version.CreatedBy, version.CreatedAt.Format(timeLayout)); err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return persona.ErrVersionConflict
		}
		return err
	}
	return tx.Commit()
}

func (s *Store) DeletePersona(projectID, id string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM persona_defaults WHERE project_id = ? AND persona_id = ?`, projectID, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM persona_versions WHERE project_id = ? AND persona_id = ?`, projectID, id); err != nil {
		return err
	}
	result, err := tx.Exec(`DELETE FROM personas WHERE project_id = ? AND id = ?`, projectID, id)
	if err != nil {
		return err
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if changed == 0 {
		return persona.ErrNotFound
	}
	return tx.Commit()
}

func (s *Store) PersonaByID(projectID, id string) (persona.Persona, error) {
	return scanPersona(s.db.QueryRow(`SELECT project_id, id, name, description, current_version, created_by, created_at, updated_at FROM personas WHERE project_id = ? AND id = ?`, projectID, id))
}

func scanPersona(row rowScanner) (persona.Persona, error) {
	var item persona.Persona
	var created, updated string
	if err := row.Scan(&item.ProjectID, &item.ID, &item.Name, &item.Description, &item.CurrentVersion, &item.CreatedBy, &created, &updated); errors.Is(err, sql.ErrNoRows) {
		return persona.Persona{}, persona.ErrNotFound
	} else if err != nil {
		return persona.Persona{}, err
	}
	item.CreatedAt, _ = time.Parse(timeLayout, created)
	item.UpdatedAt, _ = time.Parse(timeLayout, updated)
	return item, nil
}

func (s *Store) PersonaVersion(projectID, id string, version int) (persona.Version, error) {
	return scanPersonaVersion(s.db.QueryRow(`SELECT project_id, persona_id, version, definition, created_by, created_at FROM persona_versions WHERE project_id = ? AND persona_id = ? AND version = ?`, projectID, id, version))
}

func scanPersonaVersion(row rowScanner) (persona.Version, error) {
	var item persona.Version
	var definition, created string
	if err := row.Scan(&item.ProjectID, &item.PersonaID, &item.Version, &definition, &item.CreatedBy, &created); errors.Is(err, sql.ErrNoRows) {
		return persona.Version{}, persona.ErrNotFound
	} else if err != nil {
		return persona.Version{}, err
	}
	if err := json.Unmarshal([]byte(definition), &item.Definition); err != nil {
		return persona.Version{}, err
	}
	item.CreatedAt, _ = time.Parse(timeLayout, created)
	return item, nil
}

func (s *Store) PersonaVersions(projectID, id string) ([]persona.Version, error) {
	rows, err := s.db.Query(`SELECT project_id, persona_id, version, definition, created_by, created_at FROM persona_versions WHERE project_id = ? AND persona_id = ? ORDER BY version`, projectID, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var versions []persona.Version
	for rows.Next() {
		version, err := scanPersonaVersion(rows)
		if err != nil {
			return nil, err
		}
		versions = append(versions, version)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(versions) == 0 {
		return nil, persona.ErrNotFound
	}
	return versions, nil
}

func (s *Store) PersonasByProject(projectID string) ([]persona.Persona, error) {
	rows, err := s.db.Query(`SELECT project_id, id, name, description, current_version, created_by, created_at, updated_at FROM personas WHERE project_id = ? ORDER BY name, id`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var personas []persona.Persona
	for rows.Next() {
		item, err := scanPersona(rows)
		if err != nil {
			return nil, err
		}
		personas = append(personas, item)
	}
	return personas, rows.Err()
}

func (s *Store) DefaultPersona(projectID, userID string) (persona.Default, error) {
	var item persona.Default
	var updated string
	if err := s.db.QueryRow(`SELECT project_id, user_id, persona_id, updated_at FROM persona_defaults WHERE project_id = ? AND user_id = ?`, projectID, userID).Scan(&item.ProjectID, &item.UserID, &item.PersonaID, &updated); errors.Is(err, sql.ErrNoRows) {
		return persona.Default{}, persona.ErrNotFound
	} else if err != nil {
		return persona.Default{}, err
	}
	item.UpdatedAt, _ = time.Parse(timeLayout, updated)
	return item, nil
}

func (s *Store) SetDefaultPersona(item persona.Default) error {
	var exists int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM personas WHERE project_id = ? AND id = ?`, item.ProjectID, item.PersonaID).Scan(&exists); err != nil {
		return err
	}
	if exists == 0 {
		return persona.ErrNotFound
	}
	_, err := s.db.Exec(`INSERT INTO persona_defaults(project_id, user_id, persona_id, updated_at) VALUES(?, ?, ?, ?) ON CONFLICT(project_id, user_id) DO UPDATE SET persona_id = excluded.persona_id, updated_at = excluded.updated_at`,
		item.ProjectID, item.UserID, item.PersonaID, item.UpdatedAt.Format(timeLayout))
	return err
}
