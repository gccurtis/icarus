// The project-scoped binary file store.
//
// Part of the single SQLite Store: this file holds the file persistence
// methods. Every file in this package shares one *Store and one connection, so
// the split is organizational — it mirrors the capability boundaries in
// core/capability so each domain's storage is legible on its own.
package sqlite

import (
	"database/sql"
	"errors"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/file"
)

// --- Files (project-scoped binary store) ---

// Put inserts a file's metadata and content.
func (s *Store) Put(f file.File, content []byte) error {
	_, err := s.db.Exec(
		`INSERT INTO files(id, project_id, name, content_type, size, uploader_id, uploader_name, content, created_at)
		 VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		f.ID, f.ProjectID, f.Name, f.ContentType, f.Size, f.UploaderID, f.UploaderName, content, f.CreatedAt.Format(timeLayout),
	)
	return err
}

// Meta returns a file's metadata without its bytes, scoped to its project.
func (s *Store) Meta(projectID, id string) (file.File, error) {
	return scanFileMeta(s.db.QueryRow(
		`SELECT id, project_id, name, content_type, size, uploader_id, uploader_name, created_at
		 FROM files WHERE id = ? AND project_id = ?`, id, projectID))
}

// Content returns a file's bytes, scoped to its project. The project id is part
// of the WHERE clause rather than a check the caller is trusted to make: bytes
// carry no label of their own, so a file belonging to another project reads as
// not-found here, in SQL.
func (s *Store) Content(projectID, id string) ([]byte, error) {
	var content []byte
	err := s.db.QueryRow(
		`SELECT content FROM files WHERE id = ? AND project_id = ?`, id, projectID).Scan(&content)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, file.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return content, nil
}

// ByProject returns a project's file metadata, newest first.
func (s *Store) ByProject(projectID string) ([]file.File, error) {
	rows, err := s.db.Query(
		`SELECT id, project_id, name, content_type, size, uploader_id, uploader_name, created_at
		 FROM files WHERE project_id = ? ORDER BY created_at DESC, id`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []file.File
	for rows.Next() {
		f, err := scanFileMeta(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func scanFileMeta(row rowScanner) (file.File, error) {
	var f file.File
	var created string
	if err := row.Scan(&f.ID, &f.ProjectID, &f.Name, &f.ContentType, &f.Size, &f.UploaderID, &f.UploaderName, &created); errors.Is(err, sql.ErrNoRows) {
		return file.File{}, file.ErrNotFound
	} else if err != nil {
		return file.File{}, err
	}
	f.CreatedAt, _ = time.Parse(timeLayout, created)
	return f, nil
}
