// Package requestlog captures each HTTP request and its response as a structured
// Record and hands it to a Sink. Today the default sink writes records to the
// log, but the same records are the foundation for keeping a history of the
// requests the core has served — and their responses — so that agents can later
// understand the current working context.
package requestlog

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

// sensitiveKeys are JSON object keys whose values are redacted before a body is
// logged, so credentials and personal identifiers never reach the log. Matched
// case-insensitively.
var sensitiveKeys = map[string]bool{
	"password":      true,
	"token":         true,
	"secret":        true,
	"authorization": true,
	"api_key":       true,
	"apikey":        true,
	"email":         true,
	// Document style payloads are attacker-controlled and may be rejected. Keep
	// their raw values out of operator logs; the attached typed error carries the
	// stable validation code and field instead.
	"fontfamily": true,
	"fontsize":   true,
	"fg":         true,
	"bg":         true,
}

var documentStyleContainers = map[string]bool{
	"attrs":             true,
	"custom":            true,
	"customtypography":  true,
	"defaulttypography": true,
}

var documentStyleKeys = map[string]bool{
	"href":       true,
	"family":     true,
	"size":       true,
	"value":      true,
	"fontfamily": true,
	"fontsize":   true,
	"fg":         true,
	"bg":         true,
}

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

			// A handler that answered with an opaque message stashes the real cause
			// here; a handler that returned an error to Echo never got the chance, so
			// fall back to that error.
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

// redactValue walks a decoded JSON value, redacting sensitive keys in any object
// it contains. It reports whether anything was redacted.
func redactValue(v any) bool {
	changed := false
	switch t := v.(type) {
	case map[string]any:
		for k, child := range t {
			key := strings.ToLower(k)
			if sensitiveKeys[key] {
				t[k] = "[REDACTED]"
				changed = true
			} else if documentStyleContainers[key] && redactDocumentStyleValue(child) {
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

func redactDocumentStyleValue(v any) bool {
	object, ok := v.(map[string]any)
	if !ok {
		return false
	}
	changed := false
	for key, child := range object {
		if documentStyleKeys[strings.ToLower(key)] {
			object[key] = "[REDACTED]"
			changed = true
		} else if redactValue(child) {
			changed = true
		}
	}
	return changed
}
