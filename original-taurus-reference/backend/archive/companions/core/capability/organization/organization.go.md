# organization.go

Organizations — named entities users belong to, ABOVE any one Project (like a user's avatar). Role-based memberships (owner/admin/member): owner/admin manage members and rename; only an owner grants/revokes owner; the last owner is protected. Organizations never grant Project access; UserOrgIDs is the narrow query the resource access-scope resolver consults. See repo conventions (AGENTS.md).

## Code breakdown

```go
// Package organization provides organizations — named entities that users
// belong to — and their role-based memberships. Organizations sit ABOVE any one
// Project: a user↔organization link is one of the deliberate exceptions to the
// otherwise-absolute Project scoping (like a user's avatar), because an
// organization spans Projects. Organizations never grant Project access on their
// own; the resource access capability (see the access-scope resolver) only uses
// org membership to narrow who, among a Project's members, may see a resource.
package organization

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sort"
	"strings"
	"time"
)

const maxNameLen = 200

// Role is the closed vocabulary for a member's standing within an organization.
// owner and admin may manage members and rename the org; only an owner may
// grant or revoke the owner role, and the last owner can never be removed or
// demoted.
type Role string

const (
	RoleOwner  Role = "owner"
	RoleAdmin  Role = "admin"
	RoleMember Role = "member"
)

func validRole(role Role) bool {
	return role == RoleOwner || role == RoleAdmin || role == RoleMember
}

var (
	ErrInvalidName = errors.New("organization name must not be empty")
	ErrInvalidRole = errors.New("organization role must be owner, admin, or member")
	ErrNotFound    = errors.New("organization not found")
	ErrForbidden   = errors.New("not permitted for this organization")
	ErrLastOwner   = errors.New("an organization must keep at least one owner")
	ErrNotMember   = errors.New("user is not a member of the organization")
)

// Organization is a named entity users belong to, independent of any Project.
type Organization struct {
	ID        string
	Name      string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Membership is one user's role within one organization.
type Membership struct {
	UserID string
	OrgID  string
	Role   Role
}

// MyOrganization pairs an organization with the caller's role in it.
type MyOrganization struct {
	Organization Organization
	Role         Role
}

// Store persists organizations and their memberships. As with every capability,
// one *sqlite.Store implements this alongside the others, so method names are
// organization-specific.
type Store interface {
	CreateOrganization(Organization) error
	OrganizationByID(id string) (Organization, error)
	UpdateOrganization(Organization) error
	AddOrgMembership(Membership) error
	RemoveOrgMembership(orgID, userID string) error
	SetOrgMembershipRole(orgID, userID string, role Role) error
	OrgMembershipsByUser(userID string) ([]Membership, error)
	OrgMembershipsByOrg(orgID string) ([]Membership, error)
	OrgMembershipFor(orgID, userID string) (Membership, error)
}

// Organizations is the organization service. It is safe for concurrent callers
// when the supplied Store is.
type Organizations struct {
	store Store
	now   func() time.Time
	id    func() string
}

// New constructs the service over a Store.
func New(store Store) (*Organizations, error) {
	if store == nil {
		return nil, errors.New("organization: store is required")
	}
	return &Organizations{store: store, now: time.Now, id: newID}, nil
}

// Create records a new organization and makes its creator the sole owner.
func (o *Organizations) Create(creatorID, name string) (Organization, error) {
	if strings.TrimSpace(creatorID) == "" {
		return Organization{}, ErrForbidden
	}
	name, err := normalizeName(name)
	if err != nil {
		return Organization{}, err
	}
	now := o.now().UTC()
	org := Organization{ID: o.id(), Name: name, CreatedAt: now, UpdatedAt: now}
	if err := o.store.CreateOrganization(org); err != nil {
		return Organization{}, err
	}
	if err := o.store.AddOrgMembership(Membership{UserID: creatorID, OrgID: org.ID, Role: RoleOwner}); err != nil {
		return Organization{}, err
	}
	return org, nil
}

// Rename changes an organization's name. The actor must be an owner or admin.
func (o *Organizations) Rename(actorID, orgID, name string) (Organization, error) {
	if err := o.requireManage(orgID, actorID); err != nil {
		return Organization{}, err
	}
	name, err := normalizeName(name)
	if err != nil {
		return Organization{}, err
	}
	org, err := o.store.OrganizationByID(orgID)
	if err != nil {
		return Organization{}, err
	}
	org.Name, org.UpdatedAt = name, o.now().UTC()
	if err := o.store.UpdateOrganization(org); err != nil {
		return Organization{}, err
	}
	return org, nil
}

// ListMine returns the organizations the user belongs to, with the user's role,
// in stable name order.
func (o *Organizations) ListMine(userID string) ([]MyOrganization, error) {
	memberships, err := o.store.OrgMembershipsByUser(userID)
	if err != nil {
		return nil, err
	}
	out := make([]MyOrganization, 0, len(memberships))
	for _, m := range memberships {
		org, err := o.store.OrganizationByID(m.OrgID)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				continue
			}
			return nil, err
		}
		out = append(out, MyOrganization{Organization: org, Role: m.Role})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Organization.Name != out[j].Organization.Name {
			return out[i].Organization.Name < out[j].Organization.Name
		}
		return out[i].Organization.ID < out[j].Organization.ID
	})
	return out, nil
}

// Members returns an organization's memberships in stable order. The actor must
// be a member of the organization.
func (o *Organizations) Members(actorID, orgID string) ([]Membership, error) {
	if _, err := o.membershipOf(orgID, actorID); err != nil {
		return nil, err
	}
	members, err := o.store.OrgMembershipsByOrg(orgID)
	if err != nil {
		return nil, err
	}
	sort.Slice(members, func(i, j int) bool { return members[i].UserID < members[j].UserID })
	return members, nil
}

// AddMember adds userID to the organization with the given role. The actor must
// be an owner or admin, and only an owner may grant the owner role.
func (o *Organizations) AddMember(actorID, orgID, userID string, role Role) (Membership, error) {
	if !validRole(role) {
		return Membership{}, ErrInvalidRole
	}
	if strings.TrimSpace(userID) == "" {
		return Membership{}, ErrNotMember
	}
	actor, err := o.requireManageMembership(orgID, actorID)
	if err != nil {
		return Membership{}, err
	}
	if role == RoleOwner && actor.Role != RoleOwner {
		return Membership{}, ErrForbidden
	}
	membership := Membership{UserID: userID, OrgID: orgID, Role: role}
	if err := o.store.AddOrgMembership(membership); err != nil {
		return Membership{}, err
	}
	return membership, nil
}

// RemoveMember removes userID from the organization. The actor must be an owner
// or admin; an admin may not remove an owner, and the last owner is protected.
func (o *Organizations) RemoveMember(actorID, orgID, userID string) error {
	actor, err := o.requireManageMembership(orgID, actorID)
	if err != nil {
		return err
	}
	target, err := o.membershipOf(orgID, userID)
	if err != nil {
		return err
	}
	if target.Role == RoleOwner {
		if actor.Role != RoleOwner {
			return ErrForbidden
		}
		if err := o.ensureNotLastOwner(orgID, userID); err != nil {
			return err
		}
	}
	return o.store.RemoveOrgMembership(orgID, userID)
}

// SetRole changes userID's role. The actor must be an owner or admin; only an
// owner may grant or revoke the owner role, and the last owner cannot be demoted.
func (o *Organizations) SetRole(actorID, orgID, userID string, role Role) error {
	if !validRole(role) {
		return ErrInvalidRole
	}
	actor, err := o.requireManageMembership(orgID, actorID)
	if err != nil {
		return err
	}
	target, err := o.membershipOf(orgID, userID)
	if err != nil {
		return err
	}
	// Granting or revoking owner is an owner-only act.
	if (role == RoleOwner || target.Role == RoleOwner) && actor.Role != RoleOwner {
		return ErrForbidden
	}
	if target.Role == RoleOwner && role != RoleOwner {
		if err := o.ensureNotLastOwner(orgID, userID); err != nil {
			return err
		}
	}
	return o.store.SetOrgMembershipRole(orgID, userID, role)
}

// UserOrgIDs returns the IDs of the organizations a user belongs to. It is the
// narrow query the resource access-scope resolver consults, so it never reveals
// roles or other users' memberships.
func (o *Organizations) UserOrgIDs(userID string) ([]string, error) {
	memberships, err := o.store.OrgMembershipsByUser(userID)
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(memberships))
	for _, m := range memberships {
		ids = append(ids, m.OrgID)
	}
	sort.Strings(ids)
	return ids, nil
}

func (o *Organizations) membershipOf(orgID, userID string) (Membership, error) {
	m, err := o.store.OrgMembershipFor(orgID, userID)
	if errors.Is(err, ErrNotFound) {
		return Membership{}, ErrForbidden
	}
	if err != nil {
		return Membership{}, err
	}
	return m, nil
}

// requireManage authorizes rename-level acts (owner or admin).
func (o *Organizations) requireManage(orgID, actorID string) error {
	_, err := o.requireManageMembership(orgID, actorID)
	return err
}

func (o *Organizations) requireManageMembership(orgID, actorID string) (Membership, error) {
	m, err := o.membershipOf(orgID, actorID)
	if err != nil {
		return Membership{}, err
	}
	if m.Role != RoleOwner && m.Role != RoleAdmin {
		return Membership{}, ErrForbidden
	}
	return m, nil
}

func (o *Organizations) ensureNotLastOwner(orgID, userID string) error {
	members, err := o.store.OrgMembershipsByOrg(orgID)
	if err != nil {
		return err
	}
	for _, m := range members {
		if m.Role == RoleOwner && m.UserID != userID {
			return nil
		}
	}
	return ErrLastOwner
}

func normalizeName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", ErrInvalidName
	}
	if len(name) > maxNameLen {
		name = name[:maxNameLen]
	}
	return name, nil
}

func newID() string {
	buf := make([]byte, 16)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}
```
