package access

import "github.com/gccurtis/taurus-omega/core/endpoint"

// Context is the resolved access state for a single request. The transport
// middleware produces it from the session cookie and passes it to scoped
// handlers. How many fields are populated reflects how far the request's session
// has moved through the access flow:
//
//   - anonymous:         all nil
//   - authenticated:     Session and User set
//   - project-selected:  Session, User, Project, and Cell all set
type Context struct {
	Session *Session
	User    *User
	Project *Project
	Cell    *Cell
}

// Authenticated reports whether the request carries a valid signed-in user.
func (c Context) Authenticated() bool { return c.User != nil }

// HasProject reports whether a project has been selected and a cell resolved.
func (c Context) HasProject() bool { return c.Project != nil && c.Cell != nil }

// ScopedHandler is a request handler that runs within a resolved access Context.
// It is the counterpart to endpoint.Handler for routes that require a signed-in
// user (and, for project routes, a selected project and cell). The transport
// layer builds the Context and the endpoint.Request and invokes the handler,
// keeping the handler itself free of any transport dependency.
type ScopedHandler func(Context, endpoint.Request) endpoint.Response
