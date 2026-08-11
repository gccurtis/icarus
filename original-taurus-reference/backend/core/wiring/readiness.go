package wiring

import "fmt"

type readinessCheck struct {
	name  string
	check func() error
}

// validateReadiness is the final phase of composition. Constructors and
// immutable registries validate what they can immediately; this gate closes the
// deliberately late-bound cycles before workers start or transport is exposed.
func validateReadiness(checks ...readinessCheck) error {
	for _, check := range checks {
		if check.check == nil {
			return fmt.Errorf("composition: %s readiness check is missing", check.name)
		}
		if err := check.check(); err != nil {
			return fmt.Errorf("composition: %s: %w", check.name, err)
		}
	}
	return nil
}
