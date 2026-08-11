// Organizations and their memberships.
//
// Part of the single SQLite Store: this file holds the organization persistence
// methods. Every file in this package shares one *Store and one connection, so
// the split is organizational — it mirrors the capability boundaries in
// core/capability so each domain's storage is legible on its own.
package sqlite

import (
	"database/sql"
	"errors"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/organization"
)

// --- Organizations ---

// CreateOrganization inserts a new organization row.
func (s *Store) CreateOrganization(org organization.Organization) error {
	_, err := s.db.Exec(
		`INSERT INTO organizations(id, name, created_at, updated_at) VALUES(?, ?, ?, ?)`,
		org.ID, org.Name, org.CreatedAt.Format(timeLayout), org.UpdatedAt.Format(timeLayout),
	)
	return err
}

// OrganizationByID loads one organization.
func (s *Store) OrganizationByID(id string) (organization.Organization, error) {
	var org organization.Organization
	var created, updated string
	err := s.db.QueryRow(
		`SELECT id, name, created_at, updated_at FROM organizations WHERE id = ?`, id,
	).Scan(&org.ID, &org.Name, &created, &updated)
	if errors.Is(err, sql.ErrNoRows) {
		return organization.Organization{}, organization.ErrNotFound
	}
	if err != nil {
		return organization.Organization{}, err
	}
	org.CreatedAt, _ = time.Parse(timeLayout, created)
	org.UpdatedAt, _ = time.Parse(timeLayout, updated)
	return org, nil
}

// UpdateOrganization persists a renamed organization.
func (s *Store) UpdateOrganization(org organization.Organization) error {
	res, err := s.db.Exec(
		`UPDATE organizations SET name = ?, updated_at = ? WHERE id = ?`,
		org.Name, org.UpdatedAt.Format(timeLayout), org.ID,
	)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return organization.ErrNotFound
	}
	return nil
}

// AddOrgMembership upserts a user's role in an organization.
func (s *Store) AddOrgMembership(m organization.Membership) error {
	_, err := s.db.Exec(
		`INSERT INTO org_memberships(org_id, user_id, role) VALUES(?, ?, ?)
		 ON CONFLICT(org_id, user_id) DO UPDATE SET role = excluded.role`,
		m.OrgID, m.UserID, string(m.Role),
	)
	return err
}

// RemoveOrgMembership deletes a user's membership; a missing row is not an error.
func (s *Store) RemoveOrgMembership(orgID, userID string) error {
	_, err := s.db.Exec(
		`DELETE FROM org_memberships WHERE org_id = ? AND user_id = ?`, orgID, userID)
	return err
}

// SetOrgMembershipRole changes an existing membership's role.
func (s *Store) SetOrgMembershipRole(orgID, userID string, role organization.Role) error {
	res, err := s.db.Exec(
		`UPDATE org_memberships SET role = ? WHERE org_id = ? AND user_id = ?`,
		string(role), orgID, userID,
	)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return organization.ErrNotFound
	}
	return nil
}

// OrgMembershipsByUser returns every organization membership held by a user.
func (s *Store) OrgMembershipsByUser(userID string) ([]organization.Membership, error) {
	return s.scanOrgMemberships(
		`SELECT org_id, user_id, role FROM org_memberships WHERE user_id = ?`, userID)
}

// OrgMembershipsByOrg returns every membership of one organization.
func (s *Store) OrgMembershipsByOrg(orgID string) ([]organization.Membership, error) {
	return s.scanOrgMemberships(
		`SELECT org_id, user_id, role FROM org_memberships WHERE org_id = ?`, orgID)
}

// OrgMembershipFor returns one user's membership of one organization.
func (s *Store) OrgMembershipFor(orgID, userID string) (organization.Membership, error) {
	var m organization.Membership
	var role string
	err := s.db.QueryRow(
		`SELECT org_id, user_id, role FROM org_memberships WHERE org_id = ? AND user_id = ?`,
		orgID, userID,
	).Scan(&m.OrgID, &m.UserID, &role)
	if errors.Is(err, sql.ErrNoRows) {
		return organization.Membership{}, organization.ErrNotFound
	}
	if err != nil {
		return organization.Membership{}, err
	}
	m.Role = organization.Role(role)
	return m, nil
}

func (s *Store) scanOrgMemberships(query string, arg string) ([]organization.Membership, error) {
	rows, err := s.db.Query(query, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []organization.Membership
	for rows.Next() {
		var m organization.Membership
		var role string
		if err := rows.Scan(&m.OrgID, &m.UserID, &role); err != nil {
			return nil, err
		}
		m.Role = organization.Role(role)
		out = append(out, m)
	}
	return out, rows.Err()
}
