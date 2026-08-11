package architecture_test

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/architecture"
)

const exceptionCeiling = 18

func TestRepositoryImportGraphObeysPolicy(t *testing.T) {
	root := repositoryRoot(t)
	edges := repositoryEdges(t, root)
	exceptions := readExceptions(t, filepath.Join(root, "docs/completion/architecture-exceptions.tsv"))

	if len(exceptions) > exceptionCeiling {
		t.Fatalf("architecture exception count grew to %d; ceiling is %d and may only be raised by a reviewed packet", len(exceptions), exceptionCeiling)
	}
	violations, stale, err := architecture.Check(edges, exceptions)
	if err != nil {
		t.Fatal(err)
	}
	if len(violations) > 0 {
		t.Fatalf("unclassified architecture imports:\n%s", formatViolations(violations))
	}
	if len(stale) > 0 {
		t.Fatalf("stale architecture exceptions must be deleted:\n%s", formatExceptions(stale))
	}
}

func TestPolicyRejectsRequiredAdversarialFixtures(t *testing.T) {
	tests := []struct {
		name string
		edge architecture.Edge
		rule string
	}{
		{
			name: "leaf capability to leaf capability",
			edge: architecture.Edge{From: "core/capability/example", To: "core/capability/other"},
			rule: "capability imports another capability",
		},
		{
			name: "handler to store",
			edge: architecture.Edge{From: "core/handlers/example", To: "core/platform/storage/sqlite"},
			rule: "handler imports a concrete store, provider, or composition package",
		},
		{
			name: "capability to wiring",
			edge: architecture.Edge{From: "core/capability/example", To: "core/wiring"},
			rule: "capability imports an inbound or concrete adapter",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			violations, stale, err := architecture.Check([]architecture.Edge{tt.edge}, nil)
			if err != nil {
				t.Fatal(err)
			}
			if len(stale) != 0 || len(violations) != 1 || violations[0].Rule != tt.rule {
				t.Fatalf("violations = %+v, stale = %+v; want rule %q", violations, stale, tt.rule)
			}
		})
	}
}

func TestExceptionMustBeExactCompleteAndCurrent(t *testing.T) {
	edge := architecture.Edge{From: "core/capability/example", To: "core/capability/other"}
	complete := architecture.Exception{
		From:             edge.From,
		To:               edge.To,
		Owner:            "omega-999",
		Rationale:        "fixture",
		RemovalCondition: "fixture import removed",
		ExpiryPacket:     "omega-999",
	}
	violations, stale, err := architecture.Check([]architecture.Edge{edge}, []architecture.Exception{complete})
	if err != nil || len(violations) != 0 || len(stale) != 0 {
		t.Fatalf("exact exception rejected: violations=%v stale=%v err=%v", violations, stale, err)
	}

	incomplete := complete
	incomplete.Owner = ""
	if _, _, err := architecture.Check([]architecture.Edge{edge}, []architecture.Exception{incomplete}); err == nil {
		t.Fatal("incomplete exception was accepted")
	}

	if _, stale, err := architecture.Check(nil, []architecture.Exception{complete}); err != nil || len(stale) != 1 {
		t.Fatalf("unused exception: stale=%v err=%v; want one stale exception", stale, err)
	}
}

func repositoryRoot(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("cannot locate architecture test")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", ".."))
}

func repositoryEdges(t *testing.T, root string) []architecture.Edge {
	t.Helper()
	cmd := exec.Command("go", "list", "-json", "./core/...")
	cmd.Dir = root
	out, err := cmd.Output()
	if err != nil {
		t.Fatalf("go list: %v", err)
	}
	decoder := json.NewDecoder(strings.NewReader(string(out)))
	var edges []architecture.Edge
	for {
		var pkg struct {
			ImportPath string
			Imports    []string
		}
		if err := decoder.Decode(&pkg); err == io.EOF {
			break
		} else if err != nil {
			t.Fatalf("decode go list output: %v", err)
		}
		for _, imported := range pkg.Imports {
			edges = append(edges, architecture.Edge{From: pkg.ImportPath, To: imported})
		}
	}
	return edges
}

func readExceptions(t *testing.T, path string) []architecture.Exception {
	t.Helper()
	file, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	reader := csv.NewReader(file)
	reader.Comma = '\t'
	reader.FieldsPerRecord = 6
	rows, err := reader.ReadAll()
	if err != nil {
		t.Fatal(err)
	}
	wantHeader := []string{"from", "to", "owner", "rationale", "removal_condition", "expiry_packet"}
	if len(rows) == 0 || strings.Join(rows[0], "\t") != strings.Join(wantHeader, "\t") {
		t.Fatalf("architecture exception header = %v; want %v", rows[0], wantHeader)
	}
	exceptions := make([]architecture.Exception, 0, len(rows)-1)
	for _, row := range rows[1:] {
		exceptions = append(exceptions, architecture.Exception{
			From: row[0], To: row[1], Owner: row[2], Rationale: row[3],
			RemovalCondition: row[4], ExpiryPacket: row[5],
		})
	}
	return exceptions
}

func formatViolations(violations []architecture.Violation) string {
	lines := make([]string, 0, len(violations))
	for _, violation := range violations {
		lines = append(lines, fmt.Sprintf("%s -> %s (%s)", violation.From, violation.To, violation.Rule))
	}
	sort.Strings(lines)
	return strings.Join(lines, "\n")
}

func formatExceptions(exceptions []architecture.Exception) string {
	lines := make([]string, 0, len(exceptions))
	for _, exception := range exceptions {
		lines = append(lines, fmt.Sprintf("%s -> %s", exception.From, exception.To))
	}
	sort.Strings(lines)
	return strings.Join(lines, "\n")
}
