package limit

import (
	"errors"
	"fmt"
	"testing"
)

// The body is the contract a client codes against, so its keys are pinned. `error`
// carries the message so a limit reads like every other error body in the system,
// and `code` is beside it so nothing has to branch on prose.
func TestBodyCarriesCodeAndArithmetic(t *testing.T) {
	e := &Exceeded{
		Code: "file_too_large", Message: "file content exceeds the maximum size",
		Limit: 26214400, Actual: 31000000, Subject: "notes/textbook.md",
	}
	body := e.Body()
	for key, want := range map[string]any{
		"error":   "file content exceeds the maximum size",
		"code":    "file_too_large",
		"limit":   int64(26214400),
		"actual":  int64(31000000),
		"subject": "notes/textbook.md",
	} {
		if body[key] != want {
			t.Errorf("body[%q] = %v, want %v", key, body[key], want)
		}
	}
}

// The optional fields are omitted rather than sent as zero. A client showing "the
// limit is 0" would be worse than a client showing nothing.
func TestBodyOmitsUnsetFields(t *testing.T) {
	body := (&Exceeded{Code: "some_limit", Message: "no"}).Body()
	if len(body) != 2 {
		t.Fatalf("body = %v, want only error and code", body)
	}
	for _, key := range []string{"limit", "actual", "subject"} {
		if _, present := body[key]; present {
			t.Errorf("body carries %q with nothing to report", key)
		}
	}
}

// Error() puts the numbers in the message as well as the fields, because this
// string is what reaches the request log — where nobody is destructuring a struct.
func TestErrorTextIncludesTheArithmetic(t *testing.T) {
	for _, tc := range []struct {
		name string
		e    *Exceeded
		want string
	}{
		{
			"subject and limit",
			&Exceeded{Message: "too big", Limit: 100, Actual: 250, Subject: "a.txt"},
			"a.txt: too big (250 exceeds the limit of 100)",
		},
		{
			"limit only",
			&Exceeded{Message: "too many", Limit: 256, Actual: 300},
			"too many (300 exceeds the limit of 256)",
		},
		{
			"subject only",
			&Exceeded{Message: "not allowed", Subject: "b.txt"},
			"b.txt: not allowed",
		},
		{"message only", &Exceeded{Message: "nope"}, "nope"},
	} {
		if got := tc.e.Error(); got != tc.want {
			t.Errorf("%s: Error() = %q, want %q", tc.name, got, tc.want)
		}
	}
}

// From finds a limit through a wrapping chain, which is what lets a capability add
// its own sentinel identity on top without hiding the numbers from the handler.
func TestFromReachesThroughWrapping(t *testing.T) {
	inner := &Exceeded{Code: "deep_limit", Message: "nested", Limit: 5, Actual: 9}
	wrapped := fmt.Errorf("outer context: %w", inner)

	got, ok := From(wrapped)
	if !ok {
		t.Fatalf("From(%v) found no limit", wrapped)
	}
	if got.Code != "deep_limit" || got.Actual != 9 {
		t.Errorf("From returned %+v, want the inner limit", got)
	}
	if _, ok := From(errors.New("unrelated")); ok {
		t.Error("From reported a limit for an error that carries none")
	}
	if _, ok := From(nil); ok {
		t.Error("From reported a limit for a nil error")
	}
}
