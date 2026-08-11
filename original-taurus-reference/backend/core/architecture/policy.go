// Package architecture defines the executable import policy for the modular
// monolith. It operates on package edges rather than source text so the same
// rules can check the real repository graph and small adversarial fixtures.
package architecture

import (
	"fmt"
	"strings"
)

const modulePath = "github.com/gccurtis/taurus-omega/"

// Edge is one direct import from a package to another package.
type Edge struct {
	From string
	To   string
}

// Exception is one reviewed departure from the default import policy.
type Exception struct {
	From             string
	To               string
	Owner            string
	Rationale        string
	RemovalCondition string
	ExpiryPacket     string
}

// Violation is an import edge rejected by a named policy rule.
type Violation struct {
	Edge
	Rule string
}

// Check rejects every governed edge that is not covered by one exact,
// fully-described exception. It also returns stale exceptions so removing an
// import necessarily removes its waiver.
func Check(edges []Edge, exceptions []Exception) (violations []Violation, stale []Exception, err error) {
	allowed := make(map[Edge]Exception, len(exceptions))
	for _, exception := range exceptions {
		if strings.TrimSpace(exception.From) == "" ||
			strings.TrimSpace(exception.To) == "" ||
			strings.TrimSpace(exception.Owner) == "" ||
			strings.TrimSpace(exception.Rationale) == "" ||
			strings.TrimSpace(exception.RemovalCondition) == "" ||
			strings.TrimSpace(exception.ExpiryPacket) == "" {
			return nil, nil, fmt.Errorf("architecture: incomplete exception %q -> %q", exception.From, exception.To)
		}
		edge := Edge{From: normalize(exception.From), To: normalize(exception.To)}
		if _, exists := allowed[edge]; exists {
			return nil, nil, fmt.Errorf("architecture: duplicate exception %s -> %s", edge.From, edge.To)
		}
		allowed[edge] = exception
	}

	used := make(map[Edge]bool, len(allowed))
	for _, edge := range edges {
		edge.From = normalize(edge.From)
		edge.To = normalize(edge.To)
		rule, governed := deniedBy(edge)
		if !governed {
			continue
		}
		if _, ok := allowed[edge]; ok {
			used[edge] = true
			continue
		}
		violations = append(violations, Violation{Edge: edge, Rule: rule})
	}
	for edge, exception := range allowed {
		if !used[edge] {
			stale = append(stale, exception)
		}
	}
	return violations, stale, nil
}

func normalize(path string) string {
	return strings.TrimPrefix(strings.TrimSpace(path), modulePath)
}

func deniedBy(edge Edge) (string, bool) {
	from, to := edge.From, edge.To

	if forbiddenDesignPath(to) {
		return "runtime package imports archived or experimental implementation", true
	}

	if isCapability(from) {
		switch {
		case isCapability(to):
			return "capability imports another capability", true
		case hasAnyPrefix(to, "core/handlers", "core/transport", "core/wiring", "core/integration"):
			return "capability imports an inbound or concrete adapter", true
		case hasAnyPrefix(to, "core/platform/storage", "core/platform/memory"):
			return "capability imports a concrete platform adapter", true
		case hasAnyPrefix(to, "core/platform/job", "core/platform/logging", "core/platform/dispatch"):
			return "capability imports a process coordination mechanism", true
		case hasAnyPrefix(to, "net/http", "os", "path/filepath", "io/fs"):
			return "capability contains a concrete HTTP or filesystem adapter", true
		}
	}

	if isHandler(from) && hasAnyPrefix(to, "core/platform/storage", "core/platform/memory", "core/integration", "core/wiring") {
		return "handler imports a concrete store, provider, or composition package", true
	}

	if isSharedPlatform(from) && hasAnyPrefix(to, "core/capability", "core/handlers", "core/transport", "core/wiring") {
		return "shared infrastructure imports product behavior", true
	}

	if hasAnyPrefix(to, "core/wiring") && !hasAnyPrefix(from, "core/wiring") && from != "core" {
		return "package reaches into the composition root", true
	}

	return "", false
}

func isCapability(path string) bool {
	return hasAnyPrefix(path, "core/capability/")
}

func isHandler(path string) bool {
	return hasAnyPrefix(path, "core/handlers/")
}

func isSharedPlatform(path string) bool {
	return hasAnyPrefix(path, "core/platform/") &&
		!hasAnyPrefix(path, "core/platform/storage/", "core/platform/memory")
}

func forbiddenDesignPath(path string) bool {
	return path == "experimental" ||
		strings.HasPrefix(path, "experimental/") ||
		path == "archive" ||
		strings.HasPrefix(path, "archive/") ||
		strings.Contains(path, "/archive/") ||
		strings.Contains(path, "/experimental/")
}

func hasAnyPrefix(path string, prefixes ...string) bool {
	for _, prefix := range prefixes {
		if path == strings.TrimSuffix(prefix, "/") || strings.HasPrefix(path, prefix) {
			return true
		}
	}
	return false
}
