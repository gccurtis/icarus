// Package access is the access layer: the domain of users, projects, sessions,
// and the per-(user, project) cells that scope the rest of the application.
//
// The access objects are created in the composition layer and enforced in the
// transport layer. A request moves through a small state machine — anonymous,
// then authenticated (a user), then project-selected (a user, a project, and a
// cell) — and only then may it reach project-scoped routes. This package holds
// the domain types, the storage and authentication seams, the runtime cells, and
// the Access service that ties them together; it depends on no transport.
package access

import "time"

// User is a registered account.
type User struct {
	ID           string
	Email        string
	PasswordHash string
	CreatedAt    time.Time
}

// Project is a workspace a user owns or belongs to. Everything beyond sign-in is
// scoped to a project.
type Project struct {
	ID        string
	OwnerID   string
	Name      string
	CreatedAt time.Time
}

// Membership records that a user may access a project. It is the basis for
// project isolation: a user may only select and reach projects they are a member
// of.
type Membership struct {
	UserID    string
	ProjectID string
}

// Session is a durable record of a signed-in user, referenced by an opaque ID
// carried in a cookie. ProjectID is empty until the user selects a project.
type Session struct {
	ID        string
	UserID    string
	ProjectID string
	CreatedAt time.Time
	ExpiresAt time.Time
}
