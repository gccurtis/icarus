// Package limit is the shared shape of "a bound was reached".
//
// Every capability that bounds something — an upload's size, how many files one
// request may carry, how much a project may hold — eventually has to tell someone
// so. Before this, each did it its own way: a sentinel error whose message was the
// whole story, worded differently by each handler that mapped it, carrying neither
// the bound nor the value that exceeded it. A client could report that something was
// too large and nothing else, so "your file is 31 MB and the limit is 25 MB" was not
// a sentence the system could say.
//
// One shape fixes that, and it has to be shared rather than per-capability for the
// reason the handlers were already diverging: they must all map it identically, and
// a shape defined in one capability would be mapped by imitation everywhere else.
//
// It is deliberately in platform rather than beside any capability. It depends on
// nothing but the standard library, and it names no particular limit — the codes
// belong to the capabilities that raise them, the way document owns its conflict
// codes.
package limit

import (
	"errors"
	"fmt"
)

// Exceeded is a bound the system declined to cross.
//
// Code is the stable, machine-readable identity a client branches on, and is the
// field that makes this worth having: prose gets reworded, and a front end that
// matched on prose would break the next time someone improved a message. Message is
// human-readable and safe to show. Limit and Actual are the arithmetic — what the
// bound is, and what was asked for. Subject names the thing that hit it (a file's
// path, a project's id), so a response about one item out of a batch says which.
//
// It is named for the event rather than called Error, which also means a capability
// can embed it to add its own sentinel identity without the field name colliding
// with the Error method.
//
// The JSON tags are here because this struct is serialized directly into an error
// body, the same way document.AdmissionConflict is.
type Exceeded struct {
	Code      string         `json:"code"`
	Message   string         `json:"message"`
	Limit     int64          `json:"limit,omitempty"`
	Actual    int64          `json:"actual,omitempty"`
	Subject   string         `json:"subject,omitempty"`
	Retryable *bool          `json:"retryable,omitempty"`
	Details   map[string]any `json:"details,omitempty"`
}

// Error renders the message, with the arithmetic appended when there is any. The
// numbers travel in the text as well as the fields because this string is what
// reaches the request log, where nobody is destructuring a struct.
func (e *Exceeded) Error() string {
	if e == nil {
		return ""
	}
	switch {
	case e.Subject != "" && e.Limit > 0:
		return fmt.Sprintf("%s: %s (%d exceeds the limit of %d)", e.Subject, e.Message, e.Actual, e.Limit)
	case e.Limit > 0:
		return fmt.Sprintf("%s (%d exceeds the limit of %d)", e.Message, e.Actual, e.Limit)
	case e.Subject != "":
		return e.Subject + ": " + e.Message
	}
	return e.Message
}

// Body is the response payload for a limit: the message under "error", so it reads
// like every other error body in the system, plus the fields a client acts on.
//
// It lives here rather than in each handler so the mapping cannot drift. That drift
// is not hypothetical — the same file-size limit reached a client as "file: content
// exceeds the maximum size" from one route and "file is too large" from another, and
// neither said what the limit was.
func (e *Exceeded) Body() map[string]any {
	body := map[string]any{"error": e.Message, "code": e.Code}
	if e.Limit > 0 {
		body["limit"] = e.Limit
	}
	if e.Actual > 0 {
		body["actual"] = e.Actual
	}
	if e.Subject != "" {
		body["subject"] = e.Subject
	}
	if e.Retryable != nil {
		body["retryable"] = *e.Retryable
	}
	if len(e.Details) > 0 {
		body["details"] = e.Details
	}
	return body
}

// From reports the limit an error carries, if it carries one. It is a thin wrapper
// over errors.As so call sites read as a question rather than as a declaration plus
// a call.
func From(err error) (*Exceeded, bool) {
	var e *Exceeded
	if errors.As(err, &e) {
		return e, true
	}
	return nil, false
}
