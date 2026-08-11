// Package endpoint defines the transport-agnostic contract that application
// handlers implement. It keeps the application layer free of any dependency on
// the HTTP transport: application handlers speak only in terms of these types,
// and the transport layer adapts them to Echo.
package endpoint

// Request is the transport-agnostic view of an incoming request handed to an
// application handler.
type Request struct {
	// Bind decodes the request body into v.
	Bind func(v any) error
	// Param returns the named path parameter (empty if absent).
	Param func(name string) string
	// Query returns the named query parameter (empty if absent).
	Query func(name string) string
}

// Response is the transport-agnostic result an application handler returns: an
// HTTP status code, a body to be serialized as JSON, and an optional cookie to
// set on the response. When Raw is non-nil the transport writes those bytes
// verbatim under ContentType instead of JSON-encoding Body — for serving file
// downloads and other binary content.
type Response struct {
	Status      int
	Body        any
	SetCookie   *Cookie
	Raw         []byte
	ContentType string
	// Filename, when set on a Raw response, makes the transport send the bytes as
	// a download (Content-Disposition: attachment) rather than letting the browser
	// render them inline — so an uploaded text/html file can never execute in the
	// app's origin.
	Filename string
	// Err is the underlying cause of a failure response. It is never serialized to
	// the client — handlers answer with an opaque Body so internal detail does not
	// leak — but the transport hands it to the request log, so an operator can see
	// why a request failed instead of only that it did.
	Err error
}

// SameSite controls a cookie's SameSite attribute. It is mirrored to net/http by
// the transport layer, so the application layer need not import net/http.
type SameSite int

const (
	SameSiteDefault SameSite = iota
	SameSiteLax
	SameSiteStrict
	SameSiteNone
)

// Cookie describes a cookie to set on a response. A negative MaxAge deletes the
// cookie; a zero MaxAge leaves it a session cookie. Secure marks the cookie
// HTTPS-only (the transport also enables it automatically over TLS).
type Cookie struct {
	Name     string
	Value    string
	Path     string
	MaxAge   int
	HTTPOnly bool
	Secure   bool
	SameSite SameSite
}

// Handler is the function an application endpoint implements for routes that
// need no user context. Routes that require a signed-in user use
// access.ScopedHandler instead.
type Handler func(Request) Response

// Fail builds a failure response: an opaque body a client can read, and the cause
// attached for the request log.
//
// The two halves are the whole point, and they answer to different audiences. The
// body says only what the caller is entitled to know, so internal detail cannot
// leak; Err says why it actually happened, and the transport hands it to
// requestlog.AttachError. Before this, handlers had the first half and dropped the
// second on the floor: Err had existed since this file was written and nothing in
// the system set it, so an unexplained 500 stayed unexplained and a failure had to
// be reproduced in order to be seen.
//
// It lives here because the body shape it writes was already the universal
// convention — seventeen handler packages each carried a private, identical
// errResp — and adding the cause to all of them separately would have made that
// duplication worse. Same reasoning that folded the per-package canWrite copies
// into access.Role.CanWrite.
//
// The body is map[string]any rather than map[string]string so a caller can extend
// it; both serialize identically for string values.
func Fail(status int, msg string, cause error) Response {
	return Response{Status: status, Body: map[string]any{"error": msg}, Err: cause}
}
