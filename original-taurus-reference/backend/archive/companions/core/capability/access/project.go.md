# project.go

This companion describes the current implementation of `core/capability/access/project.go`. Its source blocks are presented in order and reproduce the Go file verbatim.

## Code breakdown

### Source block 1: package access

```go
package access

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 2: type Role string

```go
// Role is a user's access level within a project. These are the starting access
// levels; the creator of a project becomes its owner.
type Role string

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 3: const (

```go
const (
	RoleOwner Role = "owner"
	RoleEdit  Role = "edit"
	RoleRead  Role = "read"
)

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### The write-permission predicate on Role

```go
func (r Role) CanWrite() bool { return r == RoleOwner || r == RoleEdit }
```

`CanWrite` is the single answer to "may this role change things?" — owner and
edit may, read may not, and any value that is not one of the three assignable
roles (the zero `Role`, a corrupted string) falls through to `false`, so the
predicate fails closed.

It lives here, on the type that defines what a role *is*, because every handler
package needs it. Each of them used to keep a private `canWrite(role
access.Role) bool` with exactly this body; they agreed, so collapsing them was a
coherence fix rather than a behavior change, but the duplication meant a future
change to the write rule would have to be repeated in every package and a single
missed copy would be a silent authorization gap. With the predicate owned by the
role type, that change now lands in one place and the call sites read as a
question put to the role itself (`ctx.Role.CanWrite()`).

Note this is deliberately *not* the same thing as `validRole` below: `validRole`
asks whether a string is an assignable role at all (an input-validation
question), while `CanWrite` asks what a known role is permitted to do.

### Source block 4: type Visibility string

```go
// Visibility controls whether a project's role-carrying share links are active.
// "private" disables them; "link" lets a signed-in bearer join at the link's
// read or edit role.
type Visibility string

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 5: const (

```go
const (
	VisibilityPrivate Visibility = "private"
	VisibilityLink    Visibility = "link"
	// MaxProjectPurposeRunes bounds the plain-text purpose stored on a Project.
	MaxProjectPurposeRunes = 1000
)

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 6: type Project struct {

```go
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

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 7: type Membership struct {

```go
// Membership records a user's role in a project. It is the basis both for
// project isolation (only members may select or act on a project) and for the
// access levels (owner/edit/read).
type Membership struct {
	UserID    string
	ProjectID string
	Role      Role
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 8: type ProjectMembership struct {

```go
// ProjectMembership pairs a project with the requesting user's role in it — what
// a project listing returns.
type ProjectMembership struct {
	Project Project
	Role    Role
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 9: type ProjectMember struct {

```go
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

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 10: type ProjectStore interface {

```go
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

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 11: type MembershipStore interface {

```go
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

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### ProjectLink — a shareable, role-carrying join link

```go
// ProjectLink is a shareable, role-carrying join link for a project: opening it
// grants the bearer the link's Role (read or edit). At most one link exists per
// (project, role); Token is an unguessable capability secret.
type ProjectLink struct {
	ProjectID string
	Role      Role
	Token     string
}

```

A `ProjectLink` is the persisted form of a share link: it pins a project, the role
opening it grants, and the secret `Token` that stands in for a password. Because
there is at most one link per `(project, role)`, a project has a small, bounded set
of links — one per grantable role.

### ProjectLinkStore — persists a project's share links

```go
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

```

`ProjectLinkStore` is the persistence seam for share links. It supports both lookup
directions the feature needs — by `Token` (the redemption path in `JoinByLink`) and
by `(project, role)` (the owner-management paths) — plus a project-wide
`RemoveProjectLinks` used by the delete cascade so a project's links never outlive it.

### Source block 12: func (a *Access) CreateProject(userID, name string) (Project, error) {

```go
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

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 13: func (a *Access) ProjectsForUser(userID string) ([]ProjectMembership, error) {

```go
// ProjectsForUser lists the projects the user may access, with their role.
func (a *Access) ProjectsForUser(userID string) ([]ProjectMembership, error) {
	return a.stores.Projects.ProjectsForUser(userID)
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 14: type ProjectChanges struct {

```go
// ProjectChanges is a partial update to a project. A nil field is left
// unchanged; a non-nil field is applied (an empty Icon clears it).
type ProjectChanges struct {
	Name       *string
	Icon       *string
	Purpose    *string
	Visibility *string
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 15: func (a *Access) UpdateProject(userID, projectID string, ch ProjectChanges) (Project, Role, error) {

```go
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

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 16: func (a *Access) DeleteProject(userID, projectID string) error {

```go
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

```

Deleting a project cascades: after the owner check it removes the memberships, then
the share links (so no dangling link can outlive the project or, worse, be redeemed
against a recycled id), and only then deletes the project itself.

### Source block 17: func (a *Access) LeaveProject(userID, projectID string) error {

```go
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

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### requireOwner

```go
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

```

`requireOwner` is the one owner-gate the mutating project operations share:
`UpdateProject`, `DeleteProject`, and all three member-management methods call it,
so the "non-member and non-owner both become `ErrForbidden`" rule lives in exactly
one place.

### MembershipRole — expose a caller's role to other capabilities

```go
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

```

`MembershipRole` is `requireOwner`'s read-oriented sibling, exported so other
capabilities' handlers (the name manager among them) can authorize their own
routes without duplicating the membership lookup. It applies the same
non-member-vs-non-owner collapse as `requireOwner`, but returns the actual `Role`
on success instead of just a pass/fail, so a caller can distinguish read from
edit from owner and gate mutation endpoints on anything short of `RoleRead`.

### validRole and the membership helpers

```go
// validRole reports whether r is one of the three assignable roles.
func validRole(r Role) bool {
	return r == RoleOwner || r == RoleEdit || r == RoleRead
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 20: func validVisibility(v Visibility) bool {

```go
// validVisibility reports whether v is one of the two visibility modes.
func validVisibility(v Visibility) bool {
	return v == VisibilityPrivate || v == VisibilityLink
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### roleRank — order roles for upgrade-only joins

```go
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

```

`roleRank` gives the three roles a total order (owner > edit > read, unknown last)
so `JoinByLink` can compare a member's current role against a link's role and only
ever raise access, never lower it.

### validLinkRole — read or edit only

```go
// validLinkRole reports whether r is a role a share link may grant — read or
// edit only, never owner.
func validLinkRole(r Role) bool {
	return r == RoleEdit || r == RoleRead
}

```

`validLinkRole` is the narrower cousin of `validRole`: a share link may grant read or
edit but never owner, so the link-management methods reject an owner (or unknown) role
with `ErrInvalidLinkRole` before touching the store.

### Source block 21: func ownerCount(members []ProjectMember) int {

```go
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

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 22: func findMember(members []ProjectMember, userID string) (ProjectMember, bool) {

```go
// findMember returns the member with the given user id, if present.
func findMember(members []ProjectMember, userID string) (ProjectMember, bool) {
	for _, m := range members {
		if m.UserID == userID {
			return m, true
		}
	}
	return ProjectMember{}, false
}

```

`validRole` and `validVisibility` guard the role-taking and visibility-taking
calls against an unknown string. `ownerCount` and `findMember` are the small
readers over a `[]ProjectMember` list that let the last-owner guard ask "is this
the only owner, and is the target actually a member?" without extra store
round-trips.

### Source block 23: func (a *Access) ProjectMembers(actorID, projectID string) ([]ProjectMember, error) {

```go
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

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 24: func (a *Access) AddProjectMember(actorID, projectID, email string, role Role) (ProjectMember, er...

```go
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

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 25: func (a *Access) SetMemberRole(actorID, projectID, targetID string, role Role) error {

```go
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

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 26: func (a *Access) RemoveMember(actorID, projectID, targetID string) error {

```go
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

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 27: func (a *Access) SelectProject(sessionID, projectID string) (Session, error) {

```go
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

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### CreateOrRotateProjectLink — mint or rotate a role's share link

```go
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

```

`CreateOrRotateProjectLink` is the create-and-rotate entry point: because
`PutProjectLink` replaces the `(project, role)` link with a fresh `newToken()`, the
same call both mints a link that did not exist and rotates one that did (invalidating
the old token). It is owner-gated and rejects any role a link may not grant.

### ProjectLinks — list a project's active share links

```go
// ProjectLinks lists a project's active share links. Owner only.
func (a *Access) ProjectLinks(actorID, projectID string) ([]ProjectLink, error) {
	if err := a.requireOwner(actorID, projectID); err != nil {
		return nil, err
	}
	return a.stores.Links.ProjectLinksForProject(projectID)
}

```

`ProjectLinks` lets an owner see which links are live (at most one per role) so they
can decide what to rotate or turn off. It shares the same owner gate as the other
management methods.

### DeleteProjectLink — turn off a role's share link

```go
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

```

`DeleteProjectLink` is the per-role off switch: it removes the link for one role,
immediately invalidating its token. Deleting an absent link is not an error, so the
call is idempotent.

### JoinByLink — upgrade-only join by token

```go
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
```

`JoinByLink` is the redemption path. It resolves the token to a link, then enforces
the visibility master switch: if the project is not `link`-visible its tokens all read
as `ErrNotFound`, so turning sharing off is indistinguishable from a bad token. Joining
is upgrade-only — a caller already at or above the link's role (by `roleRank`) is left
untouched, so redeeming a read link can never demote an editor or owner — otherwise the
membership upsert raises them to the link's role.
