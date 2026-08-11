package wiring

import (
	"errors"
	"strings"
	"testing"
)

func TestReadinessFailsClosedForMissingRequiredPort(t *testing.T) {
	missing := errors.New("required port is absent")
	err := validateReadiness(readinessCheck{
		name:  "fixture",
		check: func() error { return missing },
	})
	if !errors.Is(err, missing) || !strings.Contains(err.Error(), "fixture") {
		t.Fatalf("readiness error = %v; want named required-port failure", err)
	}
	if err := validateReadiness(readinessCheck{name: "complete", check: func() error { return nil }}); err != nil {
		t.Fatalf("complete composition rejected: %v", err)
	}
}
