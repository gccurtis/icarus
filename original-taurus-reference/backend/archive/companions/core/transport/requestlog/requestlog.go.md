# requestlog.go

`requestlog.go` captures each HTTP request **and its response** as a structured
`Record` and hands it to a `Sink`. It lives in the transport layer because
capturing bodies requires wrapping the HTTP response, but it is deliberately
built around a seam — the `Sink` — so that *what happens to a record* is not
fixed here.

Today the default sink writes records to the log as JSON lines. The larger intent
is that these same records are the foundation for keeping a history of the
requests the core has served and the responses it gave, so that agents can later
reconstruct the current working context (and, eventually, make calls of their own
against that history). Logging is just the first sink; persisting records or
feeding them to agents is a matter of supplying a different one.

The tricky part of the implementation is capturing the response body without
disturbing the client: Echo hands the handler a response writer, so the
middleware swaps in a writer that tees everything to a buffer while still writing
to the client. The request body is read and then restored so the handler can read
it too. Because captured bodies can contain credentials, the middleware redacts
sensitive JSON fields before a record is ever handed to a sink.

## Code breakdown

### Package documentation and declaration

```go
// Package requestlog captures each HTTP request and its response as a structured
// Record and hands it to a Sink. Today the default sink writes records to the
// log, but the same records are the foundation for keeping a history of the
// requests the core has served — and their responses — so that agents can later
// understand the current working context.
package requestlog
```

The doc comment states both what the package does now (capture and log) and what
it is setting up for (a history of requests and responses that agents can use).
Naming that intent here keeps the `Sink` seam's purpose clear to a future reader.

### Imports

```go
import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)
```

`bytes` and `io` buffer and restore the request and response bodies, `encoding/json`
renders records and inspects bodies, `time` stamps and times each exchange, `log`
backs the default sink, and `net/http` provides the `Flusher` and `ResponseWriter`
interfaces the capture writer works with. `strings` lower-cases keys for the
case-insensitive redaction match, and `echo` supplies the middleware and context
types.

### Sensitive keys to redact

```go
var sensitiveKeys = map[string]bool{
	"password":      true,
	"token":         true,
	"secret":        true,
	"authorization": true,
	"api_key":       true,
	"apikey":        true,
	"email":         true,
}
```

`sensitiveKeys` is the allowlist-in-reverse that drives redaction: any JSON object
key named here has its value scrubbed before a record leaves the middleware.
Modeling it as a set keyed by the lower-cased name makes the membership check
trivial and case-insensitive, so `password`, `Password`, and `PASSWORD` are all
caught. It is a package-level var so the policy lives in one obvious place and can
grow as more sensitive field names are recognized. Beyond `password`, it covers
the common shapes a credential takes in a body — `token`, `secret`,
`authorization`, and both spellings of an API key (`api_key`, `apikey`) — so
bearer tokens, API keys, and raw `Authorization` values are redacted too.

`email` is in the set for a different reason than the rest. It is not a
credential, but it *is* the personal identifier this system stores for every
account, and it flows through some of the busiest bodies the middleware sees:
register and login requests, member lists, invitations, the profile response. Left
alone, a log of ordinary traffic would accumulate a roster of everyone using the
system, in plain text, at whatever retention the log happens to have. Redacting it
costs the log nothing that matters for debugging — the user id is still there, and
it is the better join key anyway — so the field name joins the set and gets the
same case-insensitive, recursive treatment: `Email`, `email` nested inside a
`user` object, and an `email` on each element of a `members` array are all
scrubbed.

### The Record type

```go
// Record is a structured capture of one request/response exchange. Request and
// Response hold the raw bodies as JSON when they are valid JSON, and as a quoted
// string otherwise, so a Record always marshals cleanly.
type Record struct {
	Time     string          `json:"time"`
	Method   string          `json:"method"`
	URI      string          `json:"uri"`
	Status   int             `json:"status"`
	Latency  string          `json:"latency"`
	Request  json.RawMessage `json:"request,omitempty"`
	Response json.RawMessage `json:"response,omitempty"`
	// Error is the underlying cause of a failed request, recorded for operators
	// only. Handlers deliberately answer clients with opaque messages so internal
	// detail never leaks; without this field that detail is lost entirely and a
	// 500 is undiagnosable after the fact.
	Error string `json:"error,omitempty"`
}
```

`Record` is the structured capture of one exchange: when it happened, the method
and URI, the response status, how long it took, and both bodies. `Request` and
`Response` are `json.RawMessage` so that a JSON body is embedded as real
structured JSON in the record (rather than an escaped string), which keeps logs
readable and downstream consumption easy. The `omitempty` tag drops a body field
when there was none. The comment notes the invariant that makes this safe: bodies
that are not valid JSON are stored as quoted strings, so a `Record` always
marshals cleanly.

`Error` closes a gap that only shows up when something goes wrong. Handlers
answer clients with deliberately opaque failure messages — `chat operation
failed` — so that internal detail never leaks across the API boundary. That is
the right behavior for the client and the wrong behavior for the operator: with
the opaque message being the *only* record of the failure, a 500 in the log says
that a request failed and nothing whatsoever about why. Recording the cause
alongside the exchange, on the server side only, restores the diagnosis without
weakening the response. It is `omitempty`, so successful requests carry no such
field.

### Carrying a cause from the handler

```go
// errorKey is the echo.Context key under which a handler stashes the cause of a
// failure for the middleware to pick up. Unexported so the cause can only travel
// through AttachError.
const errorKey = "requestlog.error"

// AttachError records err as the cause of the request being handled, so the
// Record carries it even though the response body does not. Calling it more than
// once keeps the first (innermost) cause. A nil error is ignored.
func AttachError(c echo.Context, err error) {
	if err == nil || c == nil {
		return
	}
	if _, exists := c.Get(errorKey).(string); exists {
		return
	}
	c.Set(errorKey, err.Error())
}
```

The middleware runs *around* the handler, so by the time it builds the record the
handler has already returned and any error it swallowed is gone. `AttachError` is
the channel back: the handler stashes the cause on the request context, and the
middleware picks it up afterwards. Echo's per-request context is the natural
carrier — it already has request lifetime and needs no new plumbing through every
handler signature.

The key is unexported so that the only way to put a cause on a request is through
this function, which keeps the string conversion and the nil handling in one
place. First-write-wins because the innermost error is the specific one: as a
failure propagates outward it tends to get wrapped in progressively vaguer terms,
and a later, broader `AttachError` would otherwise overwrite the detail that
actually identifies the fault.

### Assembling the record

```go
			err := next(c)

			// A handler that answered with an opaque message stashes the real cause
			// here; a handler that returned an error to Echo never got the chance, so
			// fall back to that error.
			cause, _ := c.Get(errorKey).(string)
			if cause == "" && err != nil {
				cause = err.Error()
			}
```

There are two ways a request can fail, and the record needs both. A handler that
catches its own failure and turns it into a status code reports through
`AttachError`. A handler that returns an error to Echo never reaches that point,
and Echo's own error handler writes the response — so the returned `err` is the
only account of what went wrong. Taking the attached cause first and falling back
to the returned error covers both without either path having to know about the
other.

### The Sink seam and default sink

```go
// Sink receives completed records. It is the seam that lets records be logged
// today and persisted or fed to agents tomorrow.
type Sink func(Record)

// LogSink is the default Sink: it writes each record as a JSON line via the
// standard logger.
func LogSink(r Record) {
	b, err := json.Marshal(r)
	if err != nil {
		log.Printf("requestlog: marshal error: %v", err)
		return
	}
	log.Println(string(b))
}
```

`Sink` is the extension point: a function that receives each completed record.
Modeling it as a plain function type means callers can supply any behavior —
logging, persistence, forwarding to an agent context store — without this package
changing. `LogSink` is the default provided implementation: it marshals the
record and writes it as a single JSON line, degrading to an error log if
marshaling ever fails.

### The middleware

```go
// Middleware returns Echo middleware that captures each request and its response
// into a Record and hands it to sink.
func Middleware(sink Sink) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()

			// Read the request body, then restore it so the handler can read it too.
			var reqBody []byte
			if c.Request().Body != nil {
				reqBody, _ = io.ReadAll(c.Request().Body)
				c.Request().Body = io.NopCloser(bytes.NewReader(reqBody))
			}

			// Tee the response body into a buffer as the handler writes it.
			resBody := new(bytes.Buffer)
			c.Response().Writer = &captureWriter{
				ResponseWriter: c.Response().Writer,
				tee:            resBody,
			}

			err := next(c)

			cause, _ := c.Get(errorKey).(string)
			if cause == "" && err != nil {
				cause = err.Error()
			}

			sink(Record{
				Time:     start.UTC().Format(time.RFC3339Nano),
				Method:   c.Request().Method,
				URI:      c.Request().RequestURI,
				Status:   c.Response().Status,
				Latency:  time.Since(start).String(),
				Request:  toRaw(redactSecrets(reqBody)),
				Response: toRaw(redactSecrets(resBody.Bytes())),
				Error:    cause,
			})
			return err
		}
	}
}
```

`Middleware` is the capturing logic, returned in Echo's standard middleware shape
(a function wrapping the next handler). For each request it stamps a start time,
then handles the two bodies. A request body can only be read once, so it reads the
body fully and *puts a fresh reader back* on the request so the handler still
sees it. For the response, it replaces Echo's writer with a `captureWriter` that
copies everything into a buffer as it is written. It then calls the next handler,
and afterward assembles the `Record` — status and latency are known only at this
point — and passes it to the sink. The handler's own error is returned unchanged,
so logging never alters the request's outcome.

Both bodies pass through `redactSecrets` before `toRaw`, so credentials in a
request or response (a login `password`, say) are replaced with `[REDACTED]`
before the record is built. The redaction happens here, upstream of every sink, so
a plaintext secret never reaches the log — or any other sink — regardless of what
the client sent or the handler returned.

### The capturing response writer

```go
// captureWriter tees everything written to the response into tee while still
// writing it to the client.
type captureWriter struct {
	http.ResponseWriter
	tee *bytes.Buffer
}

func (w *captureWriter) Write(b []byte) (int, error) {
	w.tee.Write(b)
	return w.ResponseWriter.Write(b)
}

// Flush forwards to the underlying writer when it supports flushing, so
// streaming responses are not held back by the capture.
func (w *captureWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}
```

`captureWriter` is how the response body is captured without changing what the
client receives. It embeds the real `http.ResponseWriter`, so it *is* a valid
writer with all the original behavior; it only overrides `Write` to also copy the
bytes into `tee` before passing them through. `Flush` is forwarded when the
underlying writer supports it, so streaming responses still flush to the client
promptly rather than being buffered by the capture.

### Rendering a body as JSON

```go
// toRaw renders a body as a JSON value: the bytes themselves when they are valid
// JSON, or a quoted string otherwise. An empty body becomes nil (omitted).
func toRaw(b []byte) json.RawMessage {
	if len(b) == 0 {
		return nil
	}
	if json.Valid(b) {
		return json.RawMessage(b)
	}
	quoted, err := json.Marshal(string(b))
	if err != nil {
		return nil
	}
	return quoted
}
```

`toRaw` enforces the `Record` invariant. An empty body becomes `nil`, which the
`omitempty` tag then drops from the output. A body that is already valid JSON is
used verbatim, so it embeds as structured JSON in the record. Anything else is
marshaled as a JSON string, guaranteeing the record is always well-formed no
matter what a client or handler sent.

### Redacting sensitive values

```go
// redactSecrets replaces the values of sensitive keys (e.g. password) anywhere in
// a JSON body with "[REDACTED]", so credentials are never written to the log. A
// body that is not a JSON object is returned unchanged.
func redactSecrets(b []byte) []byte {
	if len(b) == 0 || !json.Valid(b) {
		return b
	}
	var v any
	if err := json.Unmarshal(b, &v); err != nil {
		return b
	}
	if !redactValue(v) {
		return b
	}
	out, err := json.Marshal(v)
	if err != nil {
		return b
	}
	return out
}
```

`redactSecrets` is the entry point for scrubbing a body. It short-circuits on
anything it cannot safely rewrite — an empty body or non-JSON bytes are returned
untouched, so a plain-text or malformed body flows straight through to `toRaw`
unchanged. Otherwise it decodes the JSON into a generic value, walks it with
`redactValue`, and only re-marshals when something actually changed; if nothing
was sensitive (or re-marshaling fails) it returns the original bytes, preserving
the exact input rather than a round-tripped copy. The result is that only bodies
that truly contained a sensitive field are altered, and only their values are
touched.

### Walking the decoded value

```go
// redactValue walks a decoded JSON value, redacting sensitive keys in any object
// it contains. It reports whether anything was redacted.
func redactValue(v any) bool {
	changed := false
	switch t := v.(type) {
	case map[string]any:
		for k, child := range t {
			if sensitiveKeys[strings.ToLower(k)] {
				t[k] = "[REDACTED]"
				changed = true
			} else if redactValue(child) {
				changed = true
			}
		}
	case []any:
		for _, child := range t {
			if redactValue(child) {
				changed = true
			}
		}
	}
	return changed
}
```

`redactValue` is the recursive walk that does the actual redaction. On an object
it checks each key against `sensitiveKeys` (lower-cased for the case-insensitive
match) and overwrites matching values with `[REDACTED]`; non-matching values are
descended into, so a `password` nested deep inside the body is still caught. On an
array it recurses into every element. Scalars and other types are left alone. The
boolean return threads back up whether any redaction happened anywhere in the
tree, which is what lets `redactSecrets` avoid re-marshaling an untouched body.
