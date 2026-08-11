package transport

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/gccurtis/taurus-omega/core/capability/access"
)

// ctxKey is the Echo-context key under which the gate stashes the resolved
// access.Context for adaptScoped to read.
const ctxKey = "access.context"

// resolve reads the session cookie and turns it into an access.Context. It
// reports false when there is no valid, unexpired session (an anonymous
// request).
func (s *server) resolve(c echo.Context) (access.Context, bool) {
	cookie, err := c.Cookie(access.SessionCookieName)
	if err != nil || cookie == nil || cookie.Value == "" {
		return access.Context{}, false
	}
	ctx, err := s.access.Resolve(cookie.Value)
	if err != nil {
		return access.Context{}, false
	}
	issueCSRF(c)
	return ctx, true
}

// issueCSRF hands a signed-in request the double-submit CSRF token it will need
// on its next mutating call, unless it already carries one. Minting here — on
// every resolved request — rather than only at login means a session created
// before this defence existed self-heals on its next call, and it keeps the
// single-cookie endpoint.Response contract untouched.
//
// The cookie is deliberately NOT HttpOnly: the browser client has to read it to
// echo the value in the X-CSRF-Token header, which is what requireCSRF compares.
// It carries no session-independent authority. No MaxAge is set, so it lasts the
// browser session; if it is dropped while the session cookie survives, the next
// request simply gets a fresh one here.
func issueCSRF(c echo.Context) {
	if cookie, err := c.Cookie(access.CSRFCookieName); err == nil && cookie != nil && cookie.Value != "" {
		return
	}
	c.SetCookie(&http.Cookie{
		Name:     access.CSRFCookieName,
		Value:    access.NewCSRFToken(),
		Path:     "/",
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
}

// requireUser gates every non-public route. Without a session that resolves to a
// user, the only reachable endpoints are the public ones (health, register,
// login) — this is the "no user object → sign in / log in only" rule. On
// success it stashes the resolved context for the scoped handler.
func (s *server) requireUser(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		ctx, ok := s.resolve(c)
		if !ok {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "sign in required"})
		}
		c.Set(ctxKey, ctx)
		return next(c)
	}
}

// requireProject gates the project-scoped routes (a project's resources, such as
// its documents). It requires a signed-in user who has also selected a project;
// the resolved context then carries that project, the user's role, and the cell.
func (s *server) requireProject(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		ctx, ok := s.resolve(c)
		if !ok {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "sign in required"})
		}
		if !ctx.HasProject() {
			return c.JSON(http.StatusConflict, map[string]string{"error": "select a project first"})
		}
		c.Set(ctxKey, ctx)
		return next(c)
	}
}
