package telemetry

import (
	"fmt"
	"testing"
	"time"
)

func TestLoggerRecordsNonZeroCostOnly(t *testing.T) {
	var lines []string
	rec := Logger{Logf: func(format string, args ...any) { lines = append(lines, fmt.Sprintf(format, args...)) }}

	rec.RecordCost("connector.sync", "conn-1", Usage{PromptTokens: 10, TotalTokens: 42})
	if len(lines) != 1 {
		t.Fatalf("expected one log line, got %d: %v", len(lines), lines)
	}
	if want := "connector.sync"; !contains(lines[0], want) || !contains(lines[0], "42") || !contains(lines[0], "conn-1") {
		t.Fatalf("log line missing detail: %q", lines[0])
	}

	// Zero-cost events are not logged (a no-op sync should stay quiet).
	rec.RecordCost("connector.sync", "conn-1", Usage{})
	if len(lines) != 1 {
		t.Fatalf("zero-cost event was logged: %v", lines)
	}
}

func TestLoggerRecordsEveryCallIncludingFailures(t *testing.T) {
	var lines []string
	rec := Logger{Logf: func(format string, args ...any) { lines = append(lines, fmt.Sprintf(format, args...)) }}

	rec.RecordCall(Call{
		Operation: "reason", Cast: "general/medium/medium/medium",
		Provider: "openrouter", Model: "openai/gpt-5.6-luna", Effort: "medium",
		Duration: 1500 * time.Millisecond, Usage: Usage{PromptTokens: 900, TotalTokens: 1200},
		Attempt: 1,
	})
	if len(lines) != 1 {
		t.Fatalf("expected one log line, got %d: %v", len(lines), lines)
	}
	for _, want := range []string{"reason", "openai/gpt-5.6-luna", "1.5s", "1200", "900"} {
		if !contains(lines[0], want) {
			t.Errorf("call line missing %q: %q", want, lines[0])
		}
	}

	// A failed call spends wall-clock even when it spends no tokens, and it is the
	// most important call to see — so unlike a cost event it is never dropped.
	rec.RecordCall(Call{
		Operation: "reason", Provider: "openrouter", Model: "openai/gpt-oss-120b",
		Duration: 800 * time.Millisecond, Attempt: 2, Err: "429 rate limited",
	})
	if len(lines) != 2 {
		t.Fatalf("failed call was dropped: %v", lines)
	}
	for _, want := range []string{"429 rate limited", "attempt 2", "openai/gpt-oss-120b"} {
		if !contains(lines[1], want) {
			t.Errorf("failure line missing %q: %q", want, lines[1])
		}
	}
}

func TestLoggerReportsToolLoopShape(t *testing.T) {
	var lines []string
	rec := Logger{Logf: func(format string, args ...any) { lines = append(lines, fmt.Sprintf(format, args...)) }}

	rec.RecordCall(Call{
		Operation: "reason.tools", Provider: "openrouter", Model: "m",
		Duration: 2 * time.Second, Usage: Usage{TotalTokens: 5000},
		Rounds: 3, Calls: 7,
	})
	if len(lines) != 1 {
		t.Fatalf("expected one log line: %v", lines)
	}
	// Rounds and tool calls are what distinguish an agent that worked once from
	// one that looped; without them a slow task is indistinguishable from a
	// repeating one.
	for _, want := range []string{"3 round", "7 tool call"} {
		if !contains(lines[0], want) {
			t.Errorf("tool-loop line missing %q: %q", want, lines[0])
		}
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
