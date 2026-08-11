package transport

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/gccurtis/taurus-omega/core/access"
)

// ctxKey is the Echo-context key under which the resolved access.Context is
// stashed by the gate middleware for adaptScoped to read.
const ctxKey = "access.context"

// resolve reads the session cookie and turns it into an access.Context. A
// missing, invalid, or expired session yields the zero Context (anonymous).
func (s *server) resolve(c echo.Context) access.Context {
	cookie, err := c.Cookie(access.SessionCookieName)
	if err != nil || cookie == nil || cookie.Value == "" {
		return access.Context{}
	}
	ctx, err := s.access.Resolve(cookie.Value)
	if err != nil {
		return access.Context{}
	}
	return ctx
}

// requireAuth admits only requests that carry a valid session (a signed-in
// user), stashing the resolved context for the handler. This is the gate that
// enforces "no routes until the user object is set", except the public routes
// that are registered outside this group.
func (s *server) requireAuth(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		ctx := s.resolve(c)
		if !ctx.Authenticated() {
			return c.JSON(http.StatusUnauthorized, errorBody("sign in required"))
		}
		c.Set(ctxKey, ctx)
		return next(c)
	}
}

// requireProject admits only requests from a session that has selected a project,
// and only when the :projectID in the path matches the selected project. This is
// where project isolation is enforced: a session may only reach the project it
// has selected.
func (s *server) requireProject(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		ctx := s.resolve(c)
		if !ctx.Authenticated() {
			return c.JSON(http.StatusUnauthorized, errorBody("sign in required"))
		}
		if !ctx.HasProject() {
			return c.JSON(http.StatusConflict, errorBody("select a project first"))
		}
		if c.Param("projectID") != ctx.Project.ID {
			return c.JSON(http.StatusForbidden, errorBody("project not selected for this session"))
		}
		c.Set(ctxKey, ctx)
		return next(c)
	}
}

func errorBody(msg string) map[string]string {
	return map[string]string{"error": msg}
}
