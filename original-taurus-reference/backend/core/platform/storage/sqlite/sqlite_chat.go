// Agent chats: containers, turns, and attachments.
//
// Part of the single SQLite Store: this file holds the chat persistence
// methods. Every file in this package shares one *Store and one connection, so
// the split is organizational — it mirrors the capability boundaries in
// core/capability so each domain's storage is legible on its own.
package sqlite

import (
	"database/sql"
	"errors"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/chat"
)

// --- Agent chats (BR-AI-CHAT): project-scoped conversation containers ---

func (s *Store) CreateChat(chat chat.Chat) error {
	_, err := s.db.Exec(
		`INSERT INTO agent_chats(id, project_id, requester_id, title, mode, resource_id, persona_id, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		chat.ID, chat.ProjectID, chat.RequesterID, chat.Title, chat.Mode, chat.ResourceID, chat.PersonaID,
		chat.CreatedAt.Format(timeLayout), chat.UpdatedAt.Format(timeLayout),
	)
	return err
}

// ChatByID returns one chat scoped to its project. The project id is part of
// the WHERE clause rather than a check the caller is trusted to make: a chat
// owned by another project reads as ErrNotFound here, in SQL. The service still
// compares ProjectID after loading — two independent layers, neither
// load-bearing alone.
func (s *Store) ChatByID(projectID, id string) (chat.Chat, error) {
	return scanChat(s.db.QueryRow(
		`SELECT id, project_id, requester_id, title, mode, resource_id, persona_id, created_at, updated_at
		 FROM agent_chats WHERE id = ? AND project_id = ?`, id, projectID))
}

func (s *Store) ChatsByProject(projectID, resourceID string) ([]chat.Chat, error) {
	query := `SELECT id, project_id, requester_id, title, mode, resource_id, persona_id, created_at, updated_at FROM agent_chats WHERE project_id = ?`
	args := []any{projectID}
	if resourceID != "" {
		query += ` AND resource_id = ?`
		args = append(args, resourceID)
	}
	query += ` ORDER BY updated_at DESC`
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var chats []chat.Chat
	for rows.Next() {
		chat, err := scanChat(rows)
		if err != nil {
			return nil, err
		}
		chats = append(chats, chat)
	}
	return chats, rows.Err()
}

func (s *Store) AppendTurn(turn chat.Turn) error {
	_, err := s.db.Exec(
		`INSERT INTO agent_chat_turns(id, chat_id, project_id, role, body, task_id, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)`,
		turn.ID, turn.ChatID, turn.ProjectID, turn.Role, turn.Body, turn.TaskID, turn.CreatedAt.Format(timeLayout),
	)
	return err
}

func (s *Store) TurnsByChat(chatID string) ([]chat.Turn, error) {
	rows, err := s.db.Query(
		`SELECT id, chat_id, project_id, role, body, task_id, created_at FROM agent_chat_turns WHERE chat_id = ? ORDER BY rowid`, chatID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var turns []chat.Turn
	for rows.Next() {
		var t chat.Turn
		var created string
		if err := rows.Scan(&t.ID, &t.ChatID, &t.ProjectID, &t.Role, &t.Body, &t.TaskID, &created); err != nil {
			return nil, err
		}
		t.CreatedAt, _ = time.Parse(timeLayout, created)
		turns = append(turns, t)
	}
	return turns, rows.Err()
}

func (s *Store) TouchChat(chatID string, at time.Time) error {
	_, err := s.db.Exec(`UPDATE agent_chats SET updated_at = ? WHERE id = ?`, at.Format(timeLayout), chatID)
	return err
}

func (s *Store) SetChatPersona(chatID, personaID string) error {
	res, err := s.db.Exec(`UPDATE agent_chats SET persona_id = ? WHERE id = ?`, personaID, chatID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return chat.ErrNotFound
	}
	return nil
}

func scanChat(row rowScanner) (chat.Chat, error) {
	var c chat.Chat
	var created, updated string
	if err := row.Scan(&c.ID, &c.ProjectID, &c.RequesterID, &c.Title, &c.Mode, &c.ResourceID, &c.PersonaID, &created, &updated); errors.Is(err, sql.ErrNoRows) {
		return chat.Chat{}, chat.ErrNotFound
	} else if err != nil {
		return chat.Chat{}, err
	}
	c.CreatedAt, _ = time.Parse(timeLayout, created)
	c.UpdatedAt, _ = time.Parse(timeLayout, updated)
	return c, nil
}

// --- Agent chat attachments (files + directory manifests) ---

func (s *Store) CreateChatAttachment(att chat.Attachment) error {
	_, err := s.db.Exec(
		`INSERT INTO agent_chat_attachments(id, project_id, chat_id, kind, file_id, name, relative_path, directory_upload_id, created_at)
		 VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		att.ID, att.ProjectID, att.ChatID, att.Kind, att.FileID, att.Name,
		att.RelativePath, att.DirectoryUploadID, att.CreatedAt.Format(timeLayout),
	)
	return err
}

func (s *Store) ChatAttachmentsByChat(chatID string) ([]chat.Attachment, error) {
	rows, err := s.db.Query(
		`SELECT id, project_id, chat_id, kind, file_id, name, relative_path, directory_upload_id, created_at
		 FROM agent_chat_attachments WHERE chat_id = ? ORDER BY created_at, id`, chatID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []chat.Attachment
	for rows.Next() {
		att, err := scanChatAttachment(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, att)
	}
	return out, rows.Err()
}

// ChatAttachmentByID returns one attachment scoped to its project, for the same
// reason ChatByID is: the boundary is enforced in SQL, and the service's own
// ProjectID (and ChatID) comparison remains as the second layer.
func (s *Store) ChatAttachmentByID(projectID, id string) (chat.Attachment, error) {
	return scanChatAttachment(s.db.QueryRow(
		`SELECT id, project_id, chat_id, kind, file_id, name, relative_path, directory_upload_id, created_at
		 FROM agent_chat_attachments WHERE id = ? AND project_id = ?`, id, projectID))
}

func (s *Store) DeleteChatAttachment(id string) error {
	_, err := s.db.Exec(`DELETE FROM agent_chat_attachments WHERE id = ?`, id)
	return err
}

func scanChatAttachment(row rowScanner) (chat.Attachment, error) {
	var att chat.Attachment
	var created string
	err := row.Scan(&att.ID, &att.ProjectID, &att.ChatID, &att.Kind, &att.FileID,
		&att.Name, &att.RelativePath, &att.DirectoryUploadID, &created)
	if errors.Is(err, sql.ErrNoRows) {
		return chat.Attachment{}, chat.ErrNotFound
	}
	if err != nil {
		return chat.Attachment{}, err
	}
	att.CreatedAt, _ = time.Parse(timeLayout, created)
	return att, nil
}
