package access

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

// Role is a user's access level within a project. These are the starting access
// levels; the creator of a project becomes its owner.
type Role string

const (
	RoleOwner Role = "owner"
	RoleEdit  Role = "edit"
	RoleRead  Role = "read"
)

// CanWrite reports whether a role may modify a project's contents — owner and
// edit may, read may not. This is the one definition of the write-permission
// predicate; handlers ask the role itself rather than each keeping a copy, so a
// future change to what "may write" means lands everywhere at once.
func (r Role) CanWrite() bool { return r == RoleOwner || r == RoleEdit }

// Visibility controls whether a project's role-carrying share links are active.
// "private" disables them; "link" lets a signed-in bearer join at the link's
// read or edit role.
type Visibility string

const (
	VisibilityPrivate Visibility = "private"
	VisibilityLink    Visibility = "link"
	// MaxProjectPurposeRunes bounds the plain-text purpose stored on a Project.
	MaxProjectPurposeRunes = 1000
)

// Project is a workspace users are members of. Everything the user does beyond
// sign-in and project management happens within a selected project. Icon is an
// opaque client-owned key (a color or glyph); UpdatedAt bumps on every mutation.
type Project struct {
	ID         string
	Name       string
	Icon       string
	Purpose    string
	Visibility Visibility
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// Membership records a user's role in a project. It is the basis both for
// project isolation (only members may select or act on a project) and for the
// access levels (owner/edit/read).
type Membership struct {
	UserID    string
	ProjectID string
	Role      Role
}

// ProjectMembership pairs a project with the requesting user's role in it — what
// a project listing returns.
type ProjectMembership struct {
	Project Project
	Role    Role
}

// ProjectMember is one member of a project, joined with their user identity —
// what a member listing returns.
type ProjectMember struct {
	UserID string
	Name   string
	Email  string
	Role   Role
}

// MemberSummary is one member's public-safe identity for an avatar cluster — no
// email and no role, the same safety as any public profile projection.
type MemberSummary struct {
	UserID    string
	Name      string
	AvatarURL string
}

// ProjectMemberSummary is a bounded avatar-cluster view of a project's members:
// up to a small stack of items plus the exact total member count.
type ProjectMemberSummary struct {
	Items []MemberSummary
	Total int
}

// DefaultMemberStackSize is the avatar-cluster size returned alongside each
// project in the list projection — a standard avatar-cluster size.
const DefaultMemberStackSize = 5

// ProjectStore persists projects.
type ProjectStore interface {
	CreateProject(p Project) error
	ProjectByID(id string) (Project, error)
	DeleteProject(id string) error
	// ProjectsForUser returns the projects the user is a member of, each paired
	// with the user's role.
	ProjectsForUser(userID string) ([]ProjectMembership, error)
	// UpdateProject persists a project's mutable profile fields.
	// It returns ErrNotFound if the project does not exist.
	UpdateProject(p Project) error
}

// MembershipStore persists the user↔project memberships and their roles.
type MembershipStore interface {
	AddMembership(m Membership) error
	Membership(userID, projectID string) (Membership, error)
	RemoveMembership(userID, projectID string) error
	RemoveProjectMemberships(projectID string) error
	// MembersForProject returns every member of a project, each joined with their
	// user identity (name, email) and role.
	MembersForProject(projectID string) ([]ProjectMember, error)
	// MembersSummaryByProjects returns, for each of the given projects, a bounded
	// public-safe member summary — up to limit ordered items plus the exact total
	// — in one batched read.
	MembersSummaryByProjects(projectIDs []string, limit int) (map[string]ProjectMemberSummary, error)
}

// ProjectLink is a shareable, role-carrying join link for a project: opening it
// grants the bearer the link's Role (read or edit). At most one link exists per
// (project, role); Token is an unguessable capability secret.
type ProjectLink struct {
	ProjectID string
	Role      Role
	Token     string
}

// ProjectLinkStore persists a project's share links, keyed uniquely by Token and
// by (project, role).
type ProjectLinkStore interface {
	// PutProjectLink creates or replaces the link for (ProjectID, Role) with a
	// fresh Token.
	PutProjectLink(l ProjectLink) error
	// ProjectLinkByToken looks up a link by its token, or ErrNotFound.
	ProjectLinkByToken(token string) (ProjectLink, error)
	// ProjectLinksForProject returns the project's active links (at most one per role).
	ProjectLinksForProject(projectID string) ([]ProjectLink, error)
	// DeleteProjectLink removes the link for (projectID, role); absent is not an error.
	DeleteProjectLink(projectID string, role Role) error
	// RemoveProjectLinks removes every link of a project (used when it is deleted).
	RemoveProjectLinks(projectID string) error
}

// CreateProject creates a project and makes the creator its owner.
func (a *Access) CreateProject(userID, name string) (Project, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Project{}, ErrInvalidName
	}

	now := a.now().UTC()
	p := Project{ID: newID(), Name: name, Visibility: VisibilityPrivate, CreatedAt: now, UpdatedAt: now}
	if err := a.stores.Projects.CreateProject(p); err != nil {
		return Project{}, err
	}
	if err := a.stores.Memberships.AddMembership(Membership{UserID: userID, ProjectID: p.ID, Role: RoleOwner}); err != nil {
		return Project{}, err
	}
	return p, nil
}

// ProjectsForUser lists the projects the user may access, with their role.
func (a *Access) ProjectsForUser(userID string) ([]ProjectMembership, error) {
	return a.stores.Projects.ProjectsForUser(userID)
}

// ProjectChanges is a partial update to a project. A nil field is left
// unchanged; a non-nil field is applied (an empty Icon clears it).
type ProjectChanges struct {
	Name       *string
	Icon       *string
	Purpose    *string
	Visibility *string
}

// UpdateProject applies a partial Project-profile update. Owners may update every
// field; editors may update purpose only; readers and non-members may not update.
// Authorization considers the complete requested field set, so a mixed request
// is rejected as a whole. Normalized no-ops retain the existing UpdatedAt.
func (a *Access) UpdateProject(userID, projectID string, ch ProjectChanges) (Project, Role, error) {
	if ch.Name == nil && ch.Icon == nil && ch.Purpose == nil && ch.Visibility == nil {
		return Project{}, "", ErrNoProjectChanges
	}
	m, err := a.stores.Memberships.Membership(userID, projectID)
	if errors.Is(err, ErrNotFound) {
		return Project{}, "", ErrForbidden
	} else if err != nil {
		return Project{}, "", err
	}
	ownerFields := ch.Name != nil || ch.Icon != nil || ch.Visibility != nil
	if (ownerFields && m.Role != RoleOwner) || (ch.Purpose != nil && m.Role != RoleOwner && m.Role != RoleEdit) {
		return Project{}, "", ErrForbidden
	}

	p, err := a.stores.Projects.ProjectByID(projectID)
	if err != nil {
		return Project{}, "", err
	}
	changed := false
	if ch.Name != nil {
		name := strings.TrimSpace(*ch.Name)
		if name == "" {
			return Project{}, "", ErrInvalidName
		}
		if p.Name != name {
			p.Name = name
			changed = true
		}
	}
	if ch.Icon != nil {
		icon := strings.TrimSpace(*ch.Icon)
		if utf8.RuneCountInString(icon) > 64 {
			return Project{}, "", ErrInvalidIcon
		}
		if p.Icon != icon {
			p.Icon = icon
			changed = true
		}
	}
	if ch.Purpose != nil {
		purpose := strings.TrimSpace(*ch.Purpose)
		if utf8.RuneCountInString(purpose) > MaxProjectPurposeRunes {
			return Project{}, "", ErrInvalidPurpose
		}
		if p.Purpose != purpose {
			p.Purpose = purpose
			changed = true
		}
	}
	if ch.Visibility != nil {
		v := Visibility(*ch.Visibility)
		if !validVisibility(v) {
			return Project{}, "", ErrInvalidVisibility
		}
		if p.Visibility != v {
			p.Visibility = v
			changed = true
		}
	}
	if !changed {
		return p, m.Role, nil
	}
	p.UpdatedAt = a.now().UTC()
	if err := a.stores.Projects.UpdateProject(p); err != nil {
		return Project{}, "", err
	}
	return p, m.Role, nil
}

// DeleteProject deletes a project entirely, along with its memberships. Only an
// owner may do this; a non-member or a non-owner member gets ErrForbidden.
func (a *Access) DeleteProject(userID, projectID string) error {
	if err := a.requireOwner(userID, projectID); err != nil {
		return err
	}
	if err := a.stores.Memberships.RemoveProjectMemberships(projectID); err != nil {
		return err
	}
	if err := a.stores.Links.RemoveProjectLinks(projectID); err != nil {
		return err
	}
	return a.stores.Projects.DeleteProject(projectID)
}

// LeaveProject removes the user from a project without deleting it. Any member
// may leave; a non-member gets ErrNotFound. The sole remaining owner may not
// leave (it would strand the project) — they get ErrLastOwner and must promote
// someone else or delete the project first.
func (a *Access) LeaveProject(userID, projectID string) error {
	m, err := a.stores.Memberships.Membership(userID, projectID)
	if err != nil {
		return err
	}
	if m.Role == RoleOwner {
		members, err := a.stores.Memberships.MembersForProject(projectID)
		if err != nil {
			return err
		}
		if ownerCount(members) == 1 {
			return ErrLastOwner
		}
	}
	return a.stores.Memberships.RemoveMembership(userID, projectID)
}

// requireOwner returns nil only if userID is an owner of projectID; a non-member
// and a non-owner member both get ErrForbidden, so callers never reveal a
// project's existence to someone who cannot act on it.
func (a *Access) requireOwner(userID, projectID string) error {
	m, err := a.stores.Memberships.Membership(userID, projectID)
	if errors.Is(err, ErrNotFound) {
		return ErrForbidden
	} else if err != nil {
		return err
	}
	if m.Role != RoleOwner {
		return ErrForbidden
	}
	return nil
}

// MembershipRole returns the caller's role in a project, or ErrForbidden if the
// user is not a member (so a non-member cannot distinguish absence from denial).
func (a *Access) MembershipRole(userID, projectID string) (Role, error) {
	m, err := a.stores.Memberships.Membership(userID, projectID)
	if errors.Is(err, ErrNotFound) {
		return "", ErrForbidden
	} else if err != nil {
		return "", err
	}
	return m.Role, nil
}

// validRole reports whether r is one of the three assignable roles.
func validRole(r Role) bool {
	return r == RoleOwner || r == RoleEdit || r == RoleRead
}

// validVisibility reports whether v is one of the two visibility modes.
func validVisibility(v Visibility) bool {
	return v == VisibilityPrivate || v == VisibilityLink
}

// roleRank orders roles so access levels can be compared: owner > edit > read
// (unknown ranks 0). Used for upgrade-only share-link joins.
func roleRank(r Role) int {
	switch r {
	case RoleOwner:
		return 3
	case RoleEdit:
		return 2
	case RoleRead:
		return 1
	default:
		return 0
	}
}

// validLinkRole reports whether r is a role a share link may grant — read or
// edit only, never owner.
func validLinkRole(r Role) bool {
	return r == RoleEdit || r == RoleRead
}

// ownerCount counts how many of the members hold the owner role.
func ownerCount(members []ProjectMember) int {
	n := 0
	for _, m := range members {
		if m.Role == RoleOwner {
			n++
		}
	}
	return n
}

// findMember returns the member with the given user id, if present.
func findMember(members []ProjectMember, userID string) (ProjectMember, bool) {
	for _, m := range members {
		if m.UserID == userID {
			return m, true
		}
	}
	return ProjectMember{}, false
}

// MembersSummaryByProjects returns bounded, public-safe member summaries for the
// given projects. The caller passes their own projects (from ProjectsForUser),
// so no per-project membership re-check is needed; the summary itself carries no
// email or role.
func (a *Access) MembersSummaryByProjects(projectIDs []string, limit int) (map[string]ProjectMemberSummary, error) {
	if len(projectIDs) == 0 {
		return map[string]ProjectMemberSummary{}, nil
	}
	return a.stores.Memberships.MembersSummaryByProjects(projectIDs, limit)
}

// ProjectMembers lists a project's members with their identity and role. The
// caller must themselves be a member; a non-member gets ErrForbidden.
func (a *Access) ProjectMembers(actorID, projectID string) ([]ProjectMember, error) {
	if _, err := a.stores.Memberships.Membership(actorID, projectID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrForbidden
		}
		return nil, err
	}
	return a.stores.Memberships.MembersForProject(projectID)
}

// AddProjectMember adds an existing user (looked up by email) to a project at a
// role. Owner-only. An unknown role yields ErrInvalidRole; no account for the
// email yields ErrNotFound; an existing member yields ErrAlreadyMember.
func (a *Access) AddProjectMember(actorID, projectID, email string, role Role) (ProjectMember, error) {
	if !validRole(role) {
		return ProjectMember{}, ErrInvalidRole
	}
	if err := a.requireOwner(actorID, projectID); err != nil {
		return ProjectMember{}, err
	}

	u, err := a.stores.Users.UserByEmail(normalizeEmail(email))
	if err != nil {
		return ProjectMember{}, err // ErrNotFound when no account has that email
	}
	if _, err := a.stores.Memberships.Membership(u.ID, projectID); err == nil {
		return ProjectMember{}, ErrAlreadyMember
	} else if !errors.Is(err, ErrNotFound) {
		return ProjectMember{}, err
	}
	if err := a.stores.Memberships.AddMembership(Membership{UserID: u.ID, ProjectID: projectID, Role: role}); err != nil {
		return ProjectMember{}, err
	}
	return ProjectMember{UserID: u.ID, Name: u.Name, Email: u.Email, Role: role}, nil
}

// SetMemberRole changes a member's role. Owner-only. An unknown role yields
// ErrInvalidRole; a target who is not a member yields ErrNotFound; demoting the
// sole owner yields ErrLastOwner.
func (a *Access) SetMemberRole(actorID, projectID, targetID string, role Role) error {
	if !validRole(role) {
		return ErrInvalidRole
	}
	if err := a.requireOwner(actorID, projectID); err != nil {
		return err
	}
	members, err := a.stores.Memberships.MembersForProject(projectID)
	if err != nil {
		return err
	}
	target, ok := findMember(members, targetID)
	if !ok {
		return ErrNotFound
	}
	if target.Role == RoleOwner && role != RoleOwner && ownerCount(members) == 1 {
		return ErrLastOwner
	}
	// AddMembership is an upsert, so this rewrites the existing row's role.
	return a.stores.Memberships.AddMembership(Membership{UserID: targetID, ProjectID: projectID, Role: role})
}

// RemoveMember removes a member from a project. Owner-only. A target who is not a
// member yields ErrNotFound; removing the sole owner yields ErrLastOwner.
func (a *Access) RemoveMember(actorID, projectID, targetID string) error {
	if err := a.requireOwner(actorID, projectID); err != nil {
		return err
	}
	members, err := a.stores.Memberships.MembersForProject(projectID)
	if err != nil {
		return err
	}
	target, ok := findMember(members, targetID)
	if !ok {
		return ErrNotFound
	}
	if target.Role == RoleOwner && ownerCount(members) == 1 {
		return ErrLastOwner
	}
	return a.stores.Memberships.RemoveMembership(targetID, projectID)
}

// SelectProject sets the session's active project — the project subsequent
// project-scoped requests operate within. The user must be a member; a
// non-member gets ErrForbidden.
func (a *Access) SelectProject(sessionID, projectID string) (Session, error) {
	s, err := a.stores.Sessions.SessionByID(sessionID)
	if err != nil {
		return Session{}, err
	}

	if _, err := a.stores.Memberships.Membership(s.UserID, projectID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return Session{}, ErrForbidden
		}
		return Session{}, err
	}

	s.ProjectID = projectID
	if err := a.stores.Sessions.UpdateSession(s); err != nil {
		return Session{}, err
	}
	return s, nil
}

// CreateOrRotateProjectLink mints (or rotates) the share link for a role. Owner
// only. role must be read or edit (ErrInvalidLinkRole otherwise). A fresh,
// unguessable token replaces any existing link for (project, role).
func (a *Access) CreateOrRotateProjectLink(actorID, projectID string, role Role) (ProjectLink, error) {
	if !validLinkRole(role) {
		return ProjectLink{}, ErrInvalidLinkRole
	}
	if err := a.requireOwner(actorID, projectID); err != nil {
		return ProjectLink{}, err
	}
	l := ProjectLink{ProjectID: projectID, Role: role, Token: newToken()}
	if err := a.stores.Links.PutProjectLink(l); err != nil {
		return ProjectLink{}, err
	}
	return l, nil
}

// ProjectLinks lists a project's active share links. Owner only.
func (a *Access) ProjectLinks(actorID, projectID string) ([]ProjectLink, error) {
	if err := a.requireOwner(actorID, projectID); err != nil {
		return nil, err
	}
	return a.stores.Links.ProjectLinksForProject(projectID)
}

// DeleteProjectLink turns off the share link for a role. Owner only.
func (a *Access) DeleteProjectLink(actorID, projectID string, role Role) error {
	if !validLinkRole(role) {
		return ErrInvalidLinkRole
	}
	if err := a.requireOwner(actorID, projectID); err != nil {
		return err
	}
	return a.stores.Links.DeleteProjectLink(projectID, role)
}

// JoinByLink joins a project via a share-link token, granting the link's role.
// Upgrade-only: an existing member is raised to the link's role if it is higher,
// but never demoted (an owner is never lowered). If the project's visibility is
// not "link" the master switch is off — its links stop working and the caller
// gets ErrNotFound, the same secrecy an unknown token gets. Returns the project
// and the caller's resulting role.
func (a *Access) JoinByLink(userID, token string) (Project, Role, error) {
	link, err := a.stores.Links.ProjectLinkByToken(token)
	if errors.Is(err, ErrNotFound) {
		return Project{}, "", ErrNotFound
	} else if err != nil {
		return Project{}, "", err
	}

	p, err := a.stores.Projects.ProjectByID(link.ProjectID)
	if err != nil {
		return Project{}, "", err
	}
	if p.Visibility != VisibilityLink {
		return Project{}, "", ErrNotFound // master switch off: links are disabled
	}

	current, err := a.stores.Memberships.Membership(userID, link.ProjectID)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return Project{}, "", err
	}
	if err == nil && roleRank(current.Role) >= roleRank(link.Role) {
		return p, current.Role, nil // already at or above the link's role: no change
	}
	if err := a.stores.Memberships.AddMembership(Membership{UserID: userID, ProjectID: link.ProjectID, Role: link.Role}); err != nil {
		return Project{}, "", err
	}
	return p, link.Role, nil
}
