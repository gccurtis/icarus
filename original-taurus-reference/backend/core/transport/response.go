// Handler adapters and response writing.
//
// This file holds the translation between Echo and the neutral endpoint
// contract: the plain and access-scoped handler adapters, the request builder,
// and the response writer with its cookie, attachment, and filename handling.
package transport

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/endpoint"
	"github.com/gccurtis/taurus-omega/core/transport/requestlog"
)

// adapt turns a plain (context-free) application handler into an echo.HandlerFunc.
func adapt(h endpoint.Handler) echo.HandlerFunc {
	return func(c echo.Context) error {
		return writeResponse(c, h(buildRequest(c)))
	}
}

// adaptScoped turns an access-scoped application handler into an echo.HandlerFunc,
// passing the access Context that requireUser resolved onto this request.
func (s *server) adaptScoped(h access.ScopedHandler) echo.HandlerFunc {
	return func(c echo.Context) error {
		ctx, _ := c.Get(ctxKey).(access.Context)
		return writeResponse(c, h(ctx, buildRequest(c)))
	}
}

// buildRequest constructs the neutral endpoint.Request from the Echo context.
func buildRequest(c echo.Context) endpoint.Request {
	return endpoint.Request{Bind: c.Bind, Param: c.Param, Query: c.QueryParam}
}

// writeResponse hands any failure cause to the request log, applies any cookie
// the handler set, then writes the JSON body.
func writeResponse(c echo.Context, resp endpoint.Response) error {
	requestlog.AttachError(c, resp.Err)
	if sc := resp.SetCookie; sc != nil {
		path := sc.Path
		if path == "" {
			path = "/"
		}
		c.SetCookie(&http.Cookie{
			Name:     sc.Name,
			Value:    sc.Value,
			Path:     path,
			MaxAge:   sc.MaxAge,
			HttpOnly: sc.HTTPOnly,
			// Secure is forced on over HTTPS so production gets secure cookies,
			// while local HTTP dev and tests (where IsTLS is false) still work.
			Secure:   sc.Secure || c.IsTLS(),
			SameSite: toSameSite(sc.SameSite),
		})
	}
	if resp.Raw != nil {
		contentType := resp.ContentType
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		// Serve uploaded bytes as an attachment so an attacker-supplied content
		// type (e.g. text/html) can never render inline in the app's origin.
		if resp.Filename != "" {
			c.Response().Header().Set("Content-Disposition",
				fmt.Sprintf("attachment; filename=%q", sanitizeFilename(resp.Filename)))
		}
		return c.Blob(resp.Status, contentType, resp.Raw)
	}
	return c.JSON(resp.Status, resp.Body)
}

// sanitizeFilename strips characters that could break out of the quoted
// Content-Disposition filename or inject headers (quotes, backslashes, control
// characters including CR/LF), so an attacker-named upload cannot forge headers.
func sanitizeFilename(name string) string {
	cleaned := strings.Map(func(r rune) rune {
		if r < 0x20 || r == 0x7f || r == '"' || r == '\\' {
			return '_'
		}
		return r
	}, name)
	if cleaned == "" {
		return "download"
	}
	return cleaned
}

// toSameSite maps the neutral endpoint.SameSite onto net/http's enum.
func toSameSite(s endpoint.SameSite) http.SameSite {
	switch s {
	case endpoint.SameSiteLax:
		return http.SameSiteLaxMode
	case endpoint.SameSiteStrict:
		return http.SameSiteStrictMode
	case endpoint.SameSiteNone:
		return http.SameSiteNoneMode
	default:
		return http.SameSiteDefaultMode
	}
}
