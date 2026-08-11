# endpoint.go

This companion describes the current implementation of `core/endpoint/endpoint.go`. Its source blocks are presented in order and reproduce the Go file verbatim.

## Code breakdown

### Source block 1: package endpoint

```go
// Package endpoint defines the transport-agnostic contract that application
// handlers implement. It keeps the application layer free of any dependency on
// the HTTP transport: application handlers speak only in terms of these types,
// and the transport layer adapts them to Echo.
package endpoint

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 2: type Request struct {

```go
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

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 3: type Response struct {

```go
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

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

`Err` exists because the two audiences for a failure want opposite things. The
client should learn as little as possible: a handler that hit an internal fault
answers with a fixed, opaque `Body` so that database errors, provider messages,
and internal identifiers never cross the API boundary. The operator needs exactly
that detail. Keeping the cause in a field the transport reads but never
serializes lets a handler serve both at once, instead of choosing between a
leaky response and an undiagnosable one.

It sits on `Response` rather than being logged at the point of failure so that it
stays part of the one value a handler returns — the cause travels with the status
and body it belongs to, and reaches the request log already joined to the
request that produced it.

### Source block 4: type SameSite int

```go
// SameSite controls a cookie's SameSite attribute. It is mirrored to net/http by
// the transport layer, so the application layer need not import net/http.
type SameSite int

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 5: const (

```go
const (
	SameSiteDefault SameSite = iota
	SameSiteLax
	SameSiteStrict
	SameSiteNone
)

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 6: type Cookie struct {

```go
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

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 7: type Handler func(Request) Response

```go
// Handler is the function an application endpoint implements for routes that
// need no user context. Routes that require a signed-in user use
// access.ScopedHandler instead.
type Handler func(Request) Response
```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### `Fail` — an opaque body and a recorded cause

```go
func Fail(status int, msg string, cause error) Response {
	return Response{Status: status, Body: map[string]any{"error": msg}, Err: cause}
}
```

Two audiences, one call. The body says only what the caller is entitled to know, so
internal detail cannot leak; `Err` says why it actually happened, and the transport
hands it to `requestlog.AttachError`.

That second half is what it exists to fix. `Err` had been on `Response` since this
file was written, and `transport/response.go` had always forwarded it — and exactly
**one** handler in the system ever set it (`chatErr`, from record 0130, whose comment
gets the reason exactly right: "a 500 with no recorded reason cannot be diagnosed
afterwards"). The practice never spread, so most failures answered opaquely and
recorded nothing, and record 0121's connector race hid behind
`{"error":"connector error"}` until someone reproduced it.

It lives here rather than in each handler package because the body shape it writes
was **already** the universal convention: seventeen handler packages each carried a
private, identical `errResp`. Adding the cause to all seventeen separately would have
deepened that duplication instead of resolving it. Same reasoning that folded the
per-package `canWrite` copies into `access.Role.CanWrite`.

`map[string]any` rather than `map[string]string` so a caller can extend the body;
both serialize identically for string values, so no response shape changed.

The per-package `errResp` helpers remain for the genuinely causeless failures — a
403 for a read-only role, a 501 for an unconfigured service — where there is no error
to attach and inventing one would be noise.
