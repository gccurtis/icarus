package intelligence

import (
	"context"
	"testing"
)

// recordingTelemetry captures the events a run reports, so tests can assert on
// what an operator would actually see.
type recordingTelemetry struct{ events []CallEvent }

func (r *recordingTelemetry) RecordCall(e CallEvent) { r.events = append(r.events, e) }

func newSubjectTestIntelligence(t *testing.T, tel Telemetry) (*Intelligence, *fakeProvider) {
	t.Helper()
	provider := &fakeProvider{name: "fake", reasoning: ReasoningResponse{Content: "ok", Usage: Usage{TotalTokens: 5}}}
	cast := Cast{Purpose: "general", Strength: "medium", Speed: "medium", Cost: "medium"}
	in, err := New(Options{
		Providers: map[string]Provider{"fake": provider},
		Routes:    map[Kind][]Route{KindReasoning: {{Cast: cast, Provider: "fake", Model: "m"}}},
		Telemetry: tel,
	})
	if err != nil {
		t.Fatal(err)
	}
	return in, provider
}

func TestCallEventCarriesTheSubjectFromContext(t *testing.T) {
	tel := &recordingTelemetry{}
	in, _ := newSubjectTestIntelligence(t, tel)
	cast := Cast{Purpose: "general", Strength: "medium", Speed: "medium", Cost: "medium"}

	ctx := WithSubject(context.Background(), "task:abc123")
	if _, err := in.Reason(ctx, ReasonRequest{Cast: cast, Messages: []Message{{Role: "user", Content: "hi"}}}); err != nil {
		t.Fatal(err)
	}
	if len(tel.events) != 1 {
		t.Fatalf("expected one event, got %d", len(tel.events))
	}
	// Without this, a call can be attributed to a cast and a model but never to
	// the task that caused it, so one agent run's true cost cannot be summed.
	if tel.events[0].Subject != "task:abc123" {
		t.Errorf("Subject = %q, want task:abc123", tel.events[0].Subject)
	}
}

func TestCallEventHasNoSubjectWhenNoneWasSet(t *testing.T) {
	tel := &recordingTelemetry{}
	in, _ := newSubjectTestIntelligence(t, tel)
	cast := Cast{Purpose: "general", Strength: "medium", Speed: "medium", Cost: "medium"}

	if _, err := in.Reason(context.Background(), ReasonRequest{Cast: cast, Messages: []Message{{Role: "user", Content: "hi"}}}); err != nil {
		t.Fatal(err)
	}
	if tel.events[0].Subject != "" {
		t.Errorf("Subject = %q, want empty", tel.events[0].Subject)
	}
}

func TestWithSubjectKeepsTheOutermostAttribution(t *testing.T) {
	// A task that runs an Ask must stay attributed to the task: the inner call is
	// part of the task's cost, not a separate subject. Re-attributing it would
	// split one run's spend across two subjects and undercount both.
	ctx := WithSubject(WithSubject(context.Background(), "task:outer"), "chat:inner")
	if got := subjectFrom(ctx); got != "task:outer" {
		t.Errorf("subject = %q, want task:outer", got)
	}
}
