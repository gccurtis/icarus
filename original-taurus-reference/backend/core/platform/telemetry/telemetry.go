// Package telemetry is the central sink for cost/usage events from model-backed
// operations, so every place that spends provider tokens reports through one
// contract and the price of a run is surfaced in one place rather than hidden.
package telemetry

import (
	"fmt"
	"log"
	"strings"
	"time"
)

// Usage is a token-cost measurement from a model-backed operation.
type Usage struct {
	PromptTokens     int
	CompletionTokens int
	// ReasoningTokens is the share of CompletionTokens spent thinking. It is part
	// of the completion count, not additional to it, and bills at the completion
	// rate — so it is reported, never priced separately.
	ReasoningTokens int
	TotalTokens     int
}

// Call is one provider call, measured. It carries what a run costs (Usage), what
// it costs in time (Duration), which model actually served it, and — for a tool
// loop — how much work the model did to get there.
//
// The distinction from a cost event is that a Call is recorded whether or not it
// succeeded. A failed call spends wall-clock and often triggers a fallback, so it
// is the single most informative event there is; dropping it is how a run that
// burned thirty seconds on two rate-limited attempts looks identical to one that
// answered immediately.
type Call struct {
	// Operation names what was attempted: "reason", "infer", "embed", or
	// "reason.tools" for a bounded tool loop.
	Operation string
	// Subject attributes the call to the unit of work that caused it, as
	// "kind:id" (for example "task:9f2c"). Empty when the call was made outside
	// any attributed unit — a direct API request belongs to no task.
	Subject string
	// Cast is the requested (purpose, strength, speed, cost) tuple, so a slow or
	// costly cast can be found without reading the config.
	Cast string
	// Provider and Model are the route that actually served the call — which, on a
	// fallback, is not the route the cast names first.
	Provider string
	Model    string
	Effort   string
	Duration time.Duration
	// ToolDuration is the share of Duration spent inside tool handlers rather than
	// waiting on the provider. Set only for a tool loop.
	ToolDuration time.Duration
	Usage        Usage
	// Attempt is the 1-based position in the cast's candidate list. Anything above
	// 1 means a fallback absorbed a failure, which is invisible in a successful
	// response but says the primary route is unhealthy.
	Attempt int
	// Rounds and Calls describe a tool loop's shape: how many model turns it took
	// and how many tool calls it issued. They separate an agent that worked once
	// from one that repeated itself.
	Rounds int
	Calls  int
	// Err is the provider or validation failure, empty on success.
	Err string
}

// Recorder receives measurement events. RecordCost reports tokens spent by a
// named subject; RecordCall reports one measured provider call. Implementations
// log and/or aggregate.
type Recorder interface {
	RecordCost(operation, subject string, usage Usage)
	RecordCall(Call)
}

// Logger is the default Recorder: it logs each non-zero cost event through Logf
// (defaults to the standard logger). A zero-cost event is dropped so no-op work
// stays quiet.
type Logger struct {
	Logf func(format string, args ...any)
}

// NewLogger returns a Logger backed by the standard log package.
func NewLogger() Logger { return Logger{Logf: log.Printf} }

func (l Logger) RecordCost(operation, subject string, usage Usage) {
	if usage.TotalTokens == 0 {
		return
	}
	logf := l.Logf
	if logf == nil {
		logf = log.Printf
	}
	logf("cost: %s %s — %d tokens (%d prompt)", operation, subject, usage.TotalTokens, usage.PromptTokens)
}

// RecordCall logs one measured provider call. Unlike RecordCost it never drops an
// event: a call that spent no tokens still spent time, and a call that failed is
// exactly the one an operator needs to see.
func (l Logger) RecordCall(c Call) {
	logf := l.Logf
	if logf == nil {
		logf = log.Printf
	}

	var b strings.Builder
	fmt.Fprintf(&b, "call: %s", c.Operation)
	if c.Subject != "" {
		// Immediately after the operation, because it is the field a reader groups
		// by: "what did this task cost" is answered by filtering on it.
		fmt.Fprintf(&b, " [%s]", c.Subject)
	}
	fmt.Fprintf(&b, " %s", c.Model)
	if c.Effort != "" {
		fmt.Fprintf(&b, " effort=%s", c.Effort)
	}
	// Rounded to milliseconds: sub-millisecond precision is noise here, and the
	// rounding keeps the field readable at a glance across a whole run.
	fmt.Fprintf(&b, " — %s", c.Duration.Round(time.Millisecond))
	if c.ToolDuration > 0 {
		// Printed beside the total so a slow loop is immediately attributable to the
		// model or to our own handlers, without subtracting two numbers by hand.
		fmt.Fprintf(&b, " (tools %s)", c.ToolDuration.Round(time.Millisecond))
	}
	if c.Usage.TotalTokens != 0 || c.Usage.PromptTokens != 0 {
		fmt.Fprintf(&b, ", %d tokens (%d prompt, %d completion",
			c.Usage.TotalTokens, c.Usage.PromptTokens, c.Usage.CompletionTokens)
		if c.Usage.ReasoningTokens > 0 {
			// Reported inside the completion count, because that is what it is: a
			// share of it, billed at the same rate, not a third category.
			fmt.Fprintf(&b, " of which %d reasoning", c.Usage.ReasoningTokens)
		}
		b.WriteString(")")
	}
	if c.Rounds != 0 || c.Calls != 0 {
		fmt.Fprintf(&b, ", %d round(s), %d tool call(s)", c.Rounds, c.Calls)
	}
	if c.Attempt > 1 {
		// Only worth saying when it is not the primary: attempt 1 is the norm and
		// printing it on every line would bury the times it is not.
		fmt.Fprintf(&b, ", attempt %d", c.Attempt)
	}
	if c.Cast != "" {
		fmt.Fprintf(&b, ", cast %s", c.Cast)
	}
	if c.Err != "" {
		fmt.Fprintf(&b, " — FAILED: %s", c.Err)
	}
	logf("%s", b.String())
}
