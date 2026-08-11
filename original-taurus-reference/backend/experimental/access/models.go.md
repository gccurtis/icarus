# models.go

`models.go` defines the domain vocabulary of the access layer: the plain data
types that everything else in the package — the stores, the authenticator, the
Access service — is written in terms of. It is the file to read first, because it
names the entities the rest of the package moves through its state machine.

The four types map directly onto the concepts in the layer's request lifecycle.
A `User` is a signed-up account; a `Project` is the workspace that scopes
everything past sign-in; a `Membership` is the link that grants a user access to
a project; and a `Session` is the durable, cookie-referenced record of a
signed-in user, which gains a project once one is selected. These are deliberately
inert structs — no methods, no behavior — so the domain shape stays independent of
how it is stored or transported.

## Code breakdown

### Package documentation and declaration

```go
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
```

The package doc is the charter for the whole `access` layer. It states the domain
(users, projects, sessions, cells), where the pieces are wired up (composition
layer) and where they are enforced (transport layer), and it lays out the
request's three-state progression — anonymous, authenticated, project-selected —
that the rest of the package exists to drive. The closing sentence records the
key architectural constraint: this package depends on no transport, so the domain
stays pure.

### Imports

```go
import "time"
```

A single import: `time`, used for the `CreatedAt` and `ExpiresAt` timestamps on
the entities below. The absence of anything else underlines that this file is
pure domain data with no external dependencies.

### The User type

```go
// User is a registered account.
type User struct {
	ID           string
	Email        string
	PasswordHash string
	CreatedAt    time.Time
}
```

`User` is a registered account. It carries its own identifier, the email it signed
up with, the stored secret (`PasswordHash` — the value the `Authenticator`
prepares and verifies), and when it was created. Naming the secret field
`PasswordHash` reflects the first authenticator; it is the per-user secret the
authentication seam owns.

### The Project type

```go
// Project is a workspace a user owns or belongs to. Everything beyond sign-in is
// scoped to a project.
type Project struct {
	ID        string
	OwnerID   string
	Name      string
	CreatedAt time.Time
}
```

`Project` is the workspace that scopes everything past sign-in. It records its
owner (`OwnerID`, the user who created it), a human name, and a creation time. The
comment states the central rule of the layer: beyond authentication, all work is
project-scoped, so the project is the unit of isolation.

### The Membership type

```go
// Membership records that a user may access a project. It is the basis for
// project isolation: a user may only select and reach projects they are a member
// of.
type Membership struct {
	UserID    string
	ProjectID string
}
```

`Membership` is the join between a user and a project — a pure pair of IDs. It is
the mechanism behind project isolation: selecting or reaching a project is gated
on the existence of a membership linking the two, so a user can never act on a
project they do not belong to.

### The Session type

```go
// Session is a durable record of a signed-in user, referenced by an opaque ID
// carried in a cookie. ProjectID is empty until the user selects a project.
type Session struct {
	ID        string
	UserID    string
	ProjectID string
	CreatedAt time.Time
	ExpiresAt time.Time
}
```

`Session` is the persistent handle on a signed-in user. Its `ID` is the opaque
value carried in the client's cookie, so the struct itself is never exposed — only
the ID is. `UserID` ties it to the authenticated account, and `ProjectID` embodies
the state machine directly: it is empty in the authenticated-but-not-yet-selected
state and filled once the user picks a project, moving the request to
project-selected. The two timestamps bound the session's lifetime.
