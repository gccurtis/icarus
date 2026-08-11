package workspace_test

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/workspace"
	"github.com/gccurtis/taurus-omega/core/platform/limit"
)

func newWorkspaces() *workspace.Workspaces {
	return workspace.New(workspace.NewMemoryStore())
}

func TestSetThenGet(t *testing.T) {
	w := newWorkspaces()
	now := time.Unix(1000, 0).UTC()
	state := json.RawMessage(`{"tabs":["a","b"],"activeTabId":"a"}`)
	saved, err := w.Set("u1", "p1", state, now)
	if err != nil {
		t.Fatalf("set: %v", err)
	}
	if !saved.UpdatedAt.Equal(now) {
		t.Fatalf("updatedAt = %v, want %v", saved.UpdatedAt, now)
	}
	got, err := w.Get("u1", "p1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if string(got.State) != string(state) {
		t.Fatalf("state = %s, want %s", got.State, state)
	}
}

func TestGetUnsetIsNotFound(t *testing.T) {
	w := newWorkspaces()
	if _, err := w.Get("u1", "p1"); !errors.Is(err, workspace.ErrNotFound) {
		t.Fatalf("get unset = %v, want ErrNotFound", err)
	}
}

func TestIsolatedPerUserAndProject(t *testing.T) {
	w := newWorkspaces()
	now := time.Unix(1, 0)
	if _, err := w.Set("u1", "p1", json.RawMessage(`{"x":1}`), now); err != nil {
		t.Fatal(err)
	}
	// A second user in the same project sees nothing.
	if _, err := w.Get("u2", "p1"); !errors.Is(err, workspace.ErrNotFound) {
		t.Fatalf("other user = %v, want ErrNotFound", err)
	}
	// The same user in another project sees nothing.
	if _, err := w.Get("u1", "p2"); !errors.Is(err, workspace.ErrNotFound) {
		t.Fatalf("other project = %v, want ErrNotFound", err)
	}
}

func TestScopedFacadeCanBeDiscardedAndRehydratedOnAnotherReplica(t *testing.T) {
	canonical := workspace.NewMemoryStore()
	replicaA := workspace.New(canonical)
	if _, err := replicaA.Set("alice", "helios", json.RawMessage(`{"tab":"plan"}`), time.Unix(1, 0)); err != nil {
		t.Fatal(err)
	}
	if _, err := replicaA.Set("bob", "helios", json.RawMessage(`{"tab":"notes"}`), time.Unix(2, 0)); err != nil {
		t.Fatal(err)
	}

	// A new service incarnation has no state copied from replica A. It rehydrates
	// both distinct User×Project scopes through the canonical Store port.
	replicaB := workspace.New(canonical)
	alice, err := replicaB.Get("alice", "helios")
	if err != nil || string(alice.State) != `{"tab":"plan"}` {
		t.Fatalf("rehydrated Alice = %+v, %v", alice, err)
	}
	bob, err := replicaB.Get("bob", "helios")
	if err != nil || string(bob.State) != `{"tab":"notes"}` {
		t.Fatalf("rehydrated Bob = %+v, %v", bob, err)
	}
}

func TestLastWriteWins(t *testing.T) {
	w := newWorkspaces()
	_, _ = w.Set("u1", "p1", json.RawMessage(`{"v":1}`), time.Unix(1, 0))
	_, _ = w.Set("u1", "p1", json.RawMessage(`{"v":2}`), time.Unix(2, 0))
	got, _ := w.Get("u1", "p1")
	if string(got.State) != `{"v":2}` {
		t.Fatalf("state = %s, want the second write", got.State)
	}
}

func TestRejectsOversized(t *testing.T) {
	w := newWorkspaces()
	big := json.RawMessage(`{"x":"` + strings.Repeat("a", workspace.MaxStateBytes) + `"}`)
	_, err := w.Set("u1", "p1", big, time.Unix(1, 0))
	if !errors.Is(err, workspace.ErrTooLarge) {
		t.Fatalf("oversized = %v, want ErrTooLarge", err)
	}
	// Both identities, asserted together. The sentinel is what existing callers ask
	// for; the limit is what lets a cockpit see it is 70KB against a 64KB cap and shed
	// state rather than retrying the same payload forever.
	e, ok := limit.From(err)
	if !ok {
		t.Fatalf("err = %v (%T), want a limit a handler can report", err, err)
	}
	if e.Code != workspace.CodeStateTooLarge {
		t.Errorf("code = %q, want %q", e.Code, workspace.CodeStateTooLarge)
	}
	if e.Limit != workspace.MaxStateBytes || e.Actual != int64(len(big)) {
		t.Errorf("limit/actual = %d/%d, want %d/%d", e.Limit, e.Actual, workspace.MaxStateBytes, len(big))
	}
}

func TestRejectsNonObject(t *testing.T) {
	w := newWorkspaces()
	for _, bad := range []string{`[1,2,3]`, `"a string"`, `42`, `not json`, ``} {
		if _, err := w.Set("u1", "p1", json.RawMessage(bad), time.Unix(1, 0)); !errors.Is(err, workspace.ErrInvalid) {
			t.Fatalf("state %q = %v, want ErrInvalid", bad, err)
		}
	}
}
