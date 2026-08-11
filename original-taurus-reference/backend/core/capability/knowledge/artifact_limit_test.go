package knowledge_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/platform/limit"
)

// bounded builds a lattice with an artifact ceiling and nothing else worth
// configuring: the check under test reads only the ceiling and its arguments.
func bounded(max int) *knowledge.Knowledge {
	return knowledge.New(knowledge.NewMemoryStore(), fakeEmbedder{dim: 16}, knowledge.Options{MaxArtifacts: max})
}

func TestCapacityAdmitsUpToTheCeiling(t *testing.T) {
	k := bounded(100)
	cases := []struct{ current, adding int }{
		{0, 0}, {0, 100}, {99, 1}, {100, 0}, {40, 60},
	}
	for _, tc := range cases {
		// Landing exactly on the ceiling is admitted. A bound that refused the
		// artifact it names would make the configured number a lie by one.
		if err := k.CheckArtifactCapacity("p1", tc.current, tc.adding); err != nil {
			t.Errorf("CheckArtifactCapacity(%d, %d) = %v, want admitted", tc.current, tc.adding, err)
		}
	}
}

func TestCapacityRefusalCarriesBothIdentities(t *testing.T) {
	err := bounded(100).CheckArtifactCapacity("proj-7", 90, 20)
	if err == nil {
		t.Fatal("90 + 20 against a ceiling of 100 was admitted; want a refusal")
	}

	// Two identities, and neither implies the other. The sentinel is what a
	// caller inside the ingest path branches on; limit.From is what a handler
	// needs in order to report the numbers. Record 0154: embedding
	// *limit.Exceeded promotes Error() and Body(), so a value with no Unwrap
	// still PRINTS like a limit while errors.As fails on it — which is exactly
	// the bug that ships looking correct.
	if !errors.Is(err, knowledge.ErrArtifactLimit) {
		t.Errorf("errors.Is(err, ErrArtifactLimit) = false: err = %v (%T)", err, err)
	}
	e, ok := limit.From(err)
	if !ok {
		t.Fatalf("err = %v (%T), want a limit a handler can report", err, err)
	}
	if e.Code != knowledge.CodeArtifactLimit {
		t.Errorf("code = %q, want %q", e.Code, knowledge.CodeArtifactLimit)
	}
	if e.Limit != 100 || e.Actual != 110 {
		t.Errorf("limit/actual = %d/%d, want 100/110", e.Limit, e.Actual)
	}
	// The subject is the project, because the ceiling is the project's: a
	// response about one sync has to say which project ran out of room.
	if e.Subject != "proj-7" {
		t.Errorf("subject = %q, want proj-7", e.Subject)
	}
	// The body is what reaches the client, and it has to be actionable — this
	// is the "ask your administrator" signal, not an internal number.
	body := e.Body()
	if body["code"] != knowledge.CodeArtifactLimit || body["limit"] != int64(100) || body["actual"] != int64(110) {
		t.Errorf("body = %v, want the code and the arithmetic", body)
	}
	if msg, _ := body["error"].(string); !strings.Contains(strings.ToLower(msg), "administrator") {
		t.Errorf("message = %q, want it to say who can raise the ceiling", msg)
	}
}

func TestCapacityIsUnboundedWithoutACeiling(t *testing.T) {
	// A zero ceiling is the shape a test (or any caller that did not resolve a
	// budget) constructs; a negative one is the operator's explicit opt-out,
	// matching connectors.max_file_bytes. Neither may refuse anything.
	for _, max := range []int{0, -1} {
		if err := bounded(max).CheckArtifactCapacity("p1", 1<<30, 1<<20); err != nil {
			t.Errorf("MaxArtifacts=%d refused %v, want unbounded", max, err)
		}
	}
}

func TestProjectedWindowsOverEstimates(t *testing.T) {
	// The projection is what makes the check pre-flight: it turns a snapshot's
	// byte total into the windows that snapshot will produce, before a single
	// token is spent. Each window advances target−overlap runes, and one byte per
	// rune is the floor — so multibyte text produces FEWER windows than
	// projected, never more. Over-estimating is the safe direction: it refuses a
	// sync that would have just fitted, rather than admitting one that will not.
	k := knowledge.New(knowledge.NewMemoryStore(), fakeEmbedder{dim: 16}, knowledge.Options{
		WindowTargetRunes: 4000, WindowOverlapRunes: 400,
	})
	cases := []struct{ bytes, want int }{
		{0, 0},
		{-1, 0},
		{1, 1},          // an empty-ish source still costs one window
		{3600, 1},       // exactly one stride
		{3601, 2},       // a byte past it opens another
		{36000, 10},     //
		{5 << 20, 1457}, // the textbook: ~5MB, well inside a derived ceiling
	}
	for _, tc := range cases {
		if got := k.ProjectedWindows(tc.bytes); got != tc.want {
			t.Errorf("ProjectedWindows(%d) = %d, want %d", tc.bytes, got, tc.want)
		}
	}
}

// A re-sync of content that already fits must not be refused.
//
// The ceiling is checked against the batch's NET effect, and the first version of
// this check got that wrong in a way five independent review lenses each found: it
// added a projection for every item on top of a project total that already counted
// those same sources' artifacts. So the same content was counted twice, and any
// project holding more than half the ceiling could never sync again — refused with
// a message naming a limit it was nowhere near.
//
// The two shapes that matter are a byte-identical re-sync, which must contribute
// nothing at all, and a re-sync that grows, which must contribute only the growth.
func TestARepeatedSyncIsNotRefusedByTheCeiling(t *testing.T) {
	store := knowledge.NewMemoryStore()
	ctx := context.Background()
	text := strings.Repeat("A paragraph of ordinary length for windowing. ", 40)

	// First, learn what this content actually costs, unbounded.
	probe := knowledge.New(store, fakeEmbedder{dim: 32}, smallWindows)
	if _, err := probe.Add(ctx, "p", knowledge.SourceTypeDocument, "d1", "", text, nil, 0); err != nil {
		t.Fatal(err)
	}
	counts, err := store.ArtifactCounts("p")
	if err != nil {
		t.Fatal(err)
	}
	held := 0
	for _, n := range counts {
		held += n
	}
	if held == 0 {
		t.Fatal("fixture stored nothing")
	}

	// A ceiling comfortably above what is held, but below twice it — the band the
	// double-count made unusable.
	opts := smallWindows
	opts.MaxArtifacts = held + held/2
	k := knowledge.New(store, fakeEmbedder{dim: 32}, opts)

	// Byte-identical: skipped before the ceiling is consulted at all.
	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "d1", "", text, nil, 0); err != nil {
		t.Errorf("an unchanged re-sync was refused: %v", err)
	}
	// Changed, and still the same size: replaces what is there rather than adding.
	edited := strings.Repeat("A paragraph of different length for windowing! ", 40)
	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "d1", "", edited, nil, 0); err != nil {
		t.Errorf("a re-sync of changed content that replaces itself was refused: %v", err)
	}
}

// And the ceiling still bites when a project genuinely grows past it — the fix
// must not have turned the guard off.
func TestTheCeilingStillRefusesRealGrowth(t *testing.T) {
	store := knowledge.NewMemoryStore()
	ctx := context.Background()
	text := strings.Repeat("A paragraph of ordinary length for windowing. ", 40)

	probe := knowledge.New(store, fakeEmbedder{dim: 32}, smallWindows)
	if _, err := probe.Add(ctx, "p", knowledge.SourceTypeDocument, "d1", "", text, nil, 0); err != nil {
		t.Fatal(err)
	}
	counts, _ := store.ArtifactCounts("p")
	held := 0
	for _, n := range counts {
		held += n
	}

	opts := smallWindows
	opts.MaxArtifacts = held + 1
	k := knowledge.New(store, fakeEmbedder{dim: 32}, opts)

	// A second, different source is pure growth and must be refused.
	_, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "d2", "",
		strings.Repeat("Entirely separate content that adds artifacts. ", 40), nil, 0)
	if err == nil {
		t.Fatal("want a refusal when a new source pushes the project past the ceiling")
	}
	got, ok := limit.From(err)
	if !ok {
		t.Errorf("error is not a reportable limit: %v", err)
	} else if got.Code != knowledge.CodeArtifactLimit {
		t.Errorf("code = %q, want %q", got.Code, knowledge.CodeArtifactLimit)
	}
}
