// Identity and authority: users, sessions, projects, memberships, share links.
//
// Part of the single SQLite Store: this file holds the access persistence
// methods. Every file in this package shares one *Store and one connection, so
// the split is organizational — it mirrors the capability boundaries in
// core/capability so each domain's storage is legible on its own.
package sqlite

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/access"
)

// --- UserStore ---

func (s *Store) CreateUser(u access.User) error {
	_, err := s.db.Exec(
		`INSERT INTO users(id, email, name, password_hash, created_at) VALUES(?, ?, ?, ?, ?)`,
		u.ID, u.Email, u.Name, u.PasswordHash, u.CreatedAt.Format(timeLayout),
	)
	return err
}

func (s *Store) UserByID(id string) (access.User, error) {
	return scanUser(s.db.QueryRow(
		`SELECT id, email, name, password_hash, created_at, color, avatar_url FROM users WHERE id = ?`, id))
}

func (s *Store) UserByEmail(email string) (access.User, error) {
	return scanUser(s.db.QueryRow(
		`SELECT id, email, name, password_hash, created_at, color, avatar_url FROM users WHERE email = ?`, email))
}

func (s *Store) UpdateUserName(id, name string) error {
	res, err := s.db.Exec(`UPDATE users SET name = ? WHERE id = ?`, name, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return access.ErrNotFound
	}
	return nil
}

func (s *Store) UpdateUserProfile(id, name, color, avatarURL string) error {
	res, err := s.db.Exec(`UPDATE users SET name = ?, color = ?, avatar_url = ? WHERE id = ?`, name, color, avatarURL, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return access.ErrNotFound
	}
	return nil
}

func scanUser(row *sql.Row) (access.User, error) {
	var u access.User
	var created string
	switch err := row.Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &created, &u.Color, &u.AvatarURL); {
	case errors.Is(err, sql.ErrNoRows):
		return access.User{}, access.ErrNotFound
	case err != nil:
		return access.User{}, err
	}
	u.CreatedAt, _ = time.Parse(timeLayout, created)
	return u, nil
}

// --- SessionStore ---

func (s *Store) CreateSession(sess access.Session) error {
	_, err := s.db.Exec(
		`INSERT INTO sessions(id, user_id, project_id, created_at, expires_at) VALUES(?, ?, ?, ?, ?)`,
		sess.ID, sess.UserID, sess.ProjectID, sess.CreatedAt.Format(timeLayout), sess.ExpiresAt.Format(timeLayout),
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
		sess.UserID, sess.ProjectID, sess.CreatedAt.Format(timeLayout), sess.ExpiresAt.Format(timeLayout), sess.ID,
	)
	return err
}

func (s *Store) DeleteSession(id string) error {
	_, err := s.db.Exec(`DELETE FROM sessions WHERE id = ?`, id)
	return err
}

// --- ProjectStore ---

func (s *Store) CreateProject(p access.Project) error {
	_, err := s.db.Exec(
		`INSERT INTO projects(id, name, icon, purpose, visibility, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?)`,
		p.ID, p.Name, p.Icon, p.Purpose, string(p.Visibility), p.CreatedAt.Format(timeLayout), p.UpdatedAt.Format(timeLayout),
	)
	return err
}

func (s *Store) ProjectByID(id string) (access.Project, error) {
	var p access.Project
	var visibility, created, updated string
	err := s.db.QueryRow(
		`SELECT id, name, icon, purpose, visibility, created_at, updated_at FROM projects WHERE id = ?`, id,
	).Scan(&p.ID, &p.Name, &p.Icon, &p.Purpose, &visibility, &created, &updated)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return access.Project{}, access.ErrNotFound
	case err != nil:
		return access.Project{}, err
	}
	p.Visibility = access.Visibility(visibility)
	p.CreatedAt, _ = time.Parse(timeLayout, created)
	p.UpdatedAt, _ = time.Parse(timeLayout, updated)
	return p, nil
}

func (s *Store) DeleteProject(id string) error {
	_, err := s.db.Exec(`DELETE FROM projects WHERE id = ?`, id)
	return err
}

func (s *Store) UpdateProject(p access.Project) error {
	res, err := s.db.Exec(
		`UPDATE projects SET name = ?, icon = ?, purpose = ?, visibility = ?, updated_at = ? WHERE id = ?`,
		p.Name, p.Icon, p.Purpose, string(p.Visibility), p.UpdatedAt.Format(timeLayout), p.ID,
	)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return access.ErrNotFound
	}
	return nil
}

func (s *Store) ProjectsForUser(userID string) ([]access.ProjectMembership, error) {
	rows, err := s.db.Query(`
		SELECT p.id, p.name, p.icon, p.purpose, p.visibility, p.created_at, p.updated_at, m.role
		FROM projects p
		JOIN memberships m ON m.project_id = p.id
		WHERE m.user_id = ?
		ORDER BY p.created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []access.ProjectMembership
	for rows.Next() {
		var p access.Project
		var visibility, created, updated, role string
		if err := rows.Scan(&p.ID, &p.Name, &p.Icon, &p.Purpose, &visibility, &created, &updated, &role); err != nil {
			return nil, err
		}
		p.Visibility = access.Visibility(visibility)
		p.CreatedAt, _ = time.Parse(timeLayout, created)
		p.UpdatedAt, _ = time.Parse(timeLayout, updated)
		out = append(out, access.ProjectMembership{Project: p, Role: access.Role(role)})
	}
	return out, rows.Err()
}

// --- MembershipStore ---

func (s *Store) AddMembership(m access.Membership) error {
	_, err := s.db.Exec(
		`INSERT OR REPLACE INTO memberships(user_id, project_id, role) VALUES(?, ?, ?)`,
		m.UserID, m.ProjectID, string(m.Role),
	)
	return err
}

func (s *Store) Membership(userID, projectID string) (access.Membership, error) {
	m := access.Membership{UserID: userID, ProjectID: projectID}
	var role string
	err := s.db.QueryRow(
		`SELECT role FROM memberships WHERE user_id = ? AND project_id = ?`, userID, projectID,
	).Scan(&role)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return access.Membership{}, access.ErrNotFound
	case err != nil:
		return access.Membership{}, err
	}
	m.Role = access.Role(role)
	return m, nil
}

func (s *Store) RemoveMembership(userID, projectID string) error {
	_, err := s.db.Exec(`DELETE FROM memberships WHERE user_id = ? AND project_id = ?`, userID, projectID)
	return err
}

func (s *Store) RemoveProjectMemberships(projectID string) error {
	_, err := s.db.Exec(`DELETE FROM memberships WHERE project_id = ?`, projectID)
	return err
}

func (s *Store) MembersForProject(projectID string) ([]access.ProjectMember, error) {
	rows, err := s.db.Query(`
		SELECT u.id, u.name, u.email, m.role
		FROM memberships m
		JOIN users u ON u.id = m.user_id
		WHERE m.project_id = ?
		ORDER BY u.email`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []access.ProjectMember
	for rows.Next() {
		var m access.ProjectMember
		var role string
		if err := rows.Scan(&m.UserID, &m.Name, &m.Email, &role); err != nil {
			return nil, err
		}
		m.Role = access.Role(role)
		out = append(out, m)
	}
	return out, rows.Err()
}

// MembersSummaryByProjects returns a bounded, public-safe member summary for each
// given project in one batched read: up to limit ordered items (by email) plus
// the exact total. Every requested project gets an entry, even with zero members.
func (s *Store) MembersSummaryByProjects(projectIDs []string, limit int) (map[string]access.ProjectMemberSummary, error) {
	out := make(map[string]access.ProjectMemberSummary, len(projectIDs))
	if len(projectIDs) == 0 {
		return out, nil
	}
	placeholders := make([]string, len(projectIDs))
	args := make([]any, len(projectIDs))
	for i, id := range projectIDs {
		placeholders[i] = "?"
		args[i] = id
	}
	rows, err := s.db.Query(`
		SELECT m.project_id, u.id, u.name, u.avatar_url
		FROM memberships m
		JOIN users u ON u.id = m.user_id
		WHERE m.project_id IN (`+strings.Join(placeholders, ",")+`)
		ORDER BY m.project_id, u.email`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var projectID string
		var sum access.MemberSummary
		if err := rows.Scan(&projectID, &sum.UserID, &sum.Name, &sum.AvatarURL); err != nil {
			return nil, err
		}
		summary := out[projectID]
		summary.Total++
		if limit <= 0 || len(summary.Items) < limit {
			summary.Items = append(summary.Items, sum)
		}
		out[projectID] = summary
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for _, id := range projectIDs {
		if _, ok := out[id]; !ok {
			out[id] = access.ProjectMemberSummary{}
		}
	}
	return out, nil
}

// --- ProjectLinkStore ---

func (s *Store) PutProjectLink(l access.ProjectLink) error {
	_, err := s.db.Exec(
		`INSERT INTO project_links(project_id, role, token) VALUES(?, ?, ?)
		 ON CONFLICT(project_id, role) DO UPDATE SET token = excluded.token`,
		l.ProjectID, string(l.Role), l.Token,
	)
	return err
}

func (s *Store) ProjectLinkByToken(token string) (access.ProjectLink, error) {
	l := access.ProjectLink{Token: token}
	var role string
	err := s.db.QueryRow(
		`SELECT project_id, role FROM project_links WHERE token = ?`, token,
	).Scan(&l.ProjectID, &role)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return access.ProjectLink{}, access.ErrNotFound
	case err != nil:
		return access.ProjectLink{}, err
	}
	l.Role = access.Role(role)
	return l, nil
}

func (s *Store) ProjectLinksForProject(projectID string) ([]access.ProjectLink, error) {
	rows, err := s.db.Query(
		`SELECT project_id, role, token FROM project_links WHERE project_id = ? ORDER BY role`, projectID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []access.ProjectLink
	for rows.Next() {
		var l access.ProjectLink
		var role string
		if err := rows.Scan(&l.ProjectID, &role, &l.Token); err != nil {
			return nil, err
		}
		l.Role = access.Role(role)
		out = append(out, l)
	}
	return out, rows.Err()
}

func (s *Store) DeleteProjectLink(projectID string, role access.Role) error {
	_, err := s.db.Exec(`DELETE FROM project_links WHERE project_id = ? AND role = ?`, projectID, string(role))
	return err
}

func (s *Store) RemoveProjectLinks(projectID string) error {
	_, err := s.db.Exec(`DELETE FROM project_links WHERE project_id = ?`, projectID)
	return err
}
