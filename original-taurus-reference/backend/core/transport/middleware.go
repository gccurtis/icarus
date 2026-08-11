// Middleware: the transport-local Echo middleware.
//
// This file holds the middleware that has to live in transport because it works
// on the request the gate has already resolved: the CSRF check on every gated
// mutating request, the per-document access narrowing applied to every scoped
// route, and the presence bump recorded after a successful mutating request.
package transport

import (
	"crypto/subtle"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/capability/resource"
	"github.com/gccurtis/taurus-omega/core/capability/session"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

// csrfHeader is the request header in which a client echoes back the value of
// the to_csrf cookie the gate issued it.
const csrfHeader = "X-CSRF-Token"

// requireCSRF is the second layer of cross-site request-forgery defence, applied
// to the gated and project-scoped groups. It implements the plain double-submit
// cookie pattern: a mutating request (POST, PUT, PATCH, DELETE) must carry the
// X-CSRF-Token header with a value equal to the to_csrf cookie the gate issued.
// A cross-site attacker's page can make the browser *send* our cookies, but the
// same-origin policy stops it reading them, so it cannot put the matching value
// in the header. Safe methods (GET, HEAD, OPTIONS) change no state and pass
// through untouched; the public routes (health, register, login) are not wrapped
// at all, because they have no session to protect yet. Logout is on the gated
// group and so is protected, which is deliberate — a forced logout is a real, if
// minor, forgery.
//
// The limitation, stated honestly: plain double-submit is defeated by an
// attacker who can write cookies on this site's domain — for example from a
// compromised or attacker-controlled subdomain, since cookies are not isolated
// by origin. Such an attacker can overwrite to_csrf with a value they know and
// then match it in the header. SameSite=Lax on the session cookie remains the
// primary defence; this check is defence in depth against its gaps (browsers
// without Lax-by-default, and the cross-site paths Lax still permits). Binding
// the token to the session — a signed or per-session value — would close the
// cookie-writing hole and is the natural next step if we ever serve untrusted
// subdomains.
func requireCSRF(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		switch c.Request().Method {
		case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		default:
			return next(c)
		}
		sent := c.Request().Header.Get(csrfHeader)
		cookie, err := c.Cookie(access.CSRFCookieName)
		if sent == "" || err != nil || cookie == nil || cookie.Value == "" ||
			subtle.ConstantTimeCompare([]byte(sent), []byte(cookie.Value)) != 1 {
			return c.JSON(http.StatusForbidden, map[string]string{
				"error": "missing or invalid CSRF token: send the " + access.CSRFCookieName +
					" cookie value in the " + csrfHeader + " header",
			})
		}
		return next(c)
	}
}

// documentAccessGuard enforces a document's per-resource access scope on every
// scoped route that names a :documentID. It runs after requireProject, so the
// caller is already a Project member; this adds the one narrowing check on top.
// A route without a :documentID param, or a resolver error (e.g. a not-found
// document), passes through so the handler produces the real response.
func (s *server) documentAccessGuard(resources *resource.Resources) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			id := c.Param("documentID")
			if id == "" {
				return next(c)
			}
			ctx, ok := c.Get(ctxKey).(access.Context)
			if !ok || !ctx.HasProject() {
				return next(c)
			}
			allowed, err := resources.CanAccessResource(ctx.User.ID, ctx.Project.ID, resource.KindDocument, id)
			if err != nil {
				return next(c)
			}
			if !allowed {
				return writeResponse(c, endpoint.Response{
					Status: http.StatusForbidden,
					Body:   map[string]string{"error": "you do not have access to this document"},
				})
			}
			return next(c)
		}
	}
}

// sessionActivity records presence activity on successful mutating,
// project-scoped requests. It reads the access.Context the gate resolved onto
// the request and pushes an event the session consumer turns into a
// last-activity bump, so a user stays "present" while editing without repolling
// the session endpoints. It lives in transport, not the session capability,
// because only the transport layer may read the gate's access.Context (a
// capability may not import another capability).
func sessionActivity(sessions *session.Sessions) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			err := next(c)
			if status := c.Response().Status; status < 200 || status >= 300 {
				return err
			}
			switch c.Request().Method {
			case http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodPatch:
			default:
				return err
			}
			ctx, ok := c.Get(ctxKey).(access.Context)
			if !ok || !ctx.HasProject() {
				return err
			}
			sessions.PushEvent(session.Event{
				ProjectID: ctx.Project.ID,
				UserID:    ctx.User.ID,
				UserName:  ctx.User.Name,
				Kind:      "request",
				Timestamp: time.Now(),
			})
			return err
		}
	}
}
