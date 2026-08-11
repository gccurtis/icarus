// Package logging is the application's logging port. Capabilities depend on the
// narrow Logger interface here rather than on the standard logger, so a
// capability can report an operational condition without owning the decision of
// where a line goes or how it is rendered — the composition root supplies that.
//
// It is deliberately separate from platform/telemetry. Telemetry carries
// *measurements* — typed events with fields a run is aggregated over (tokens,
// durations, the model that served a call). This carries *narration*: the
// conditions an operator needs told about, which have no natural aggregate.
// Rendering a measurement as a log line is telemetry's job; this is for
// everything that was never a measurement to begin with.
package logging

import "log"

// Logger is the leveled port a capability reports through.
//
// Three levels, because that is the distinction that changes what a reader does:
// Info records something worth knowing happened, Warn records that the system
// degraded but continued, and Error records that something failed. Nothing here
// is fatal — deciding to stop the process belongs to the composition root, never
// to a capability.
type Logger interface {
	Infof(format string, args ...any)
	Warnf(format string, args ...any)
	Errorf(format string, args ...any)
}

// New returns the default Logger, backed by the standard log package.
func New() Logger { return standard{} }

// standard prefixes each line with its level, so a log read as plain text still
// says which lines mattered.
type standard struct{}

func (standard) Infof(format string, args ...any)  { log.Printf("info: "+format, args...) }
func (standard) Warnf(format string, args ...any)  { log.Printf("warn: "+format, args...) }
func (standard) Errorf(format string, args ...any) { log.Printf("error: "+format, args...) }

// Nop discards everything.
//
// It exists so a Logger is never nil. A capability that has to guard every call
// with a nil check eventually forgets one, and the forgotten call is a panic on
// exactly the degraded path the log was added to explain — so construction
// substitutes this instead, and call sites log unconditionally.
type Nop struct{}

func (Nop) Infof(string, ...any)  {}
func (Nop) Warnf(string, ...any)  {}
func (Nop) Errorf(string, ...any) {}

// OrNop returns l, or a Nop when l is nil — the one place the nil check lives.
func OrNop(l Logger) Logger {
	if l == nil {
		return Nop{}
	}
	return l
}
