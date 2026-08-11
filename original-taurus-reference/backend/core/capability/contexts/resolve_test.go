package contexts_test

import (
	"reflect"
	"strconv"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/contexts"
)

func itoa(i int) string { return strconv.Itoa(i) }

// countingStore wraps a Store and counts ContextByID calls per id.
type countingStore struct {
	inner  contexts.Store
	counts map[string]int
}

func (s *countingStore) InsertContext(c contexts.Context) error { return s.inner.InsertContext(c) }
func (s *countingStore) ContextByID(p, id string) (contexts.Context, error) {
	s.counts[id]++
	return s.inner.ContextByID(p, id)
}
func (s *countingStore) ContextSummaries(p string) ([]contexts.Context, error) {
	return s.inner.ContextSummaries(p)
}
func (s *countingStore) UpdateContext(c contexts.Context) error { return s.inner.UpdateContext(c) }
func (s *countingStore) DeleteContext(p, id string) error       { return s.inner.DeleteContext(p, id) }

// fakeCatalog returns a fixed leaf-resource set for whole-project expansion.
type fakeCatalog struct{ refs []contexts.Ref }

func (f fakeCatalog) AllResources(string) ([]contexts.Ref, error) { return f.refs, nil }

func (f fakeCatalog) Exists(_ string, kind, id string) (bool, error) {
	for _, r := range f.refs {
		if r.Kind == kind && r.ID == id {
			return true, nil
		}
	}
	return false, nil
}

func ref(kind, id string) contexts.Ref { return contexts.Ref{Kind: kind, ID: id} }
func ctxRef(id string) contexts.Ref    { return contexts.Ref{Kind: contexts.KindContext, ID: id} }
func connRef(id string) contexts.Ref   { return contexts.Ref{Kind: contexts.KindConnector, ID: id} }

// fakeConnectorFiles returns a fixed file-origin set for one connector id,
// keyed the way the wiring adapter would key them (connectorID + "\x1f" +
// relpath), without depending on the connector package's separator constant.
// Excludes flow through the very same connector case in expand as Includes
// do (both carry contexts.KindConnector), so an Excludes entry naming one
// file directly — e.g. {connector, "X\x1fa"} — is itself looked up via
// FilesUnder too. FilesUnder falls back to an exact match across every
// connector's known files when the queried id isn't a connector root, so
// that ref still resolves to itself, mirroring the fallback the real wiring
// adapter needs for leaf-level exclusion of one file inside a connector.
type fakeConnectorFiles struct {
	byConnector map[string][]contexts.Ref
}

func (f fakeConnectorFiles) FilesUnder(_, connectorID string) ([]contexts.Ref, error) {
	if files, ok := f.byConnector[connectorID]; ok {
		return files, nil
	}
	for _, files := range f.byConnector {
		for _, r := range files {
			if r.ID == connectorID {
				return []contexts.Ref{r}, nil
			}
		}
	}
	return nil, nil
}

func TestResolveFlatIncludesAndLeafExclude(t *testing.T) {
	svc := contexts.New(newMem())
	def := contexts.Definition{
		Includes: []contexts.Ref{ref("document", "d1"), ref("document", "d2")},
		Excludes: []contexts.Ref{ref("document", "d1")},
	}
	got, err := svc.Resolve("p", def)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, []contexts.Ref{ref("document", "d2")}) {
		t.Fatalf("got %+v", got)
	}
}

func TestResolveNestedContextThenExcludeLeafInside(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	// Stored context C = {d1, d2}.
	_ = m.InsertContext(contexts.Context{ProjectID: "p", ID: "C",
		Includes: []contexts.Ref{ref("document", "d1"), ref("document", "d2")}})
	// Anonymous def: include C, exclude the leaf d1 that lives INSIDE C.
	def := contexts.Definition{Includes: []contexts.Ref{ctxRef("C")}, Excludes: []contexts.Ref{ref("document", "d1")}}
	got, err := svc.Resolve("p", def)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, []contexts.Ref{ref("document", "d2")}) {
		t.Fatalf("include-context-exclude-inner-leaf failed: %+v", got)
	}
}

func TestResolveExcludeWholeContext(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	_ = m.InsertContext(contexts.Context{ProjectID: "p", ID: "C",
		Includes: []contexts.Ref{ref("document", "d1"), ref("document", "d2")}})
	def := contexts.Definition{
		Includes: []contexts.Ref{ref("document", "d1"), ref("document", "d2"), ref("document", "d3")},
		Excludes: []contexts.Ref{ctxRef("C")}, // subtract everything C represents
	}
	got, err := svc.Resolve("p", def)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, []contexts.Ref{ref("document", "d3")}) {
		t.Fatalf("exclude-whole-context failed: %+v", got)
	}
}

func TestResolveCycleTerminates(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	_ = m.InsertContext(contexts.Context{ProjectID: "p", ID: "A", Includes: []contexts.Ref{ctxRef("B"), ref("document", "da")}})
	_ = m.InsertContext(contexts.Context{ProjectID: "p", ID: "B", Includes: []contexts.Ref{ctxRef("A"), ref("document", "db")}})
	got, err := svc.Resolve("p", contexts.Definition{Includes: []contexts.Ref{ctxRef("A")}})
	if err != nil {
		t.Fatal(err)
	}
	// da and db, in first-seen order; the A->B->A cycle is cut.
	if !reflect.DeepEqual(got, []contexts.Ref{ref("document", "db"), ref("document", "da")}) {
		t.Fatalf("cycle resolve failed: %+v", got)
	}
}

func TestResolveWholeProjectMinusOne(t *testing.T) {
	svc := contexts.New(newMem())
	svc.UseCatalog(fakeCatalog{refs: []contexts.Ref{ref("document", "d1"), ref("connector", "k1")}})
	def := contexts.Definition{
		Includes: []contexts.Ref{ctxRef(contexts.WholeProjectID)},
		Excludes: []contexts.Ref{ref("document", "d1")},
	}
	got, err := svc.Resolve("p", def)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, []contexts.Ref{ref("connector", "k1")}) {
		t.Fatalf("whole-project minus one failed: %+v", got)
	}
}

func TestResolveDanglingContextRefContributesNothing(t *testing.T) {
	svc := contexts.New(newMem())
	got, err := svc.Resolve("p", contexts.Definition{Includes: []contexts.Ref{ctxRef("missing"), ref("document", "d1")}})
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, []contexts.Ref{ref("document", "d1")}) {
		t.Fatalf("dangling ref not ignored: %+v", got)
	}
}

func TestResolveNestedExcludeCollisionInsideRow(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	_ = m.InsertContext(contexts.Context{ProjectID: "p", ID: "X",
		Includes: []contexts.Ref{ref("document", "x1"), ref("document", "x2")}})
	// C includes X and ALSO excludes X — the same context id appears on both
	// sides of one row's definition, at depth 2 from the top-level Resolve call.
	_ = m.InsertContext(contexts.Context{ProjectID: "p", ID: "C",
		Includes: []contexts.Ref{ctxRef("X")}, Excludes: []contexts.Ref{ctxRef("X")}})
	got, err := svc.Resolve("p", contexts.Definition{Includes: []contexts.Ref{ctxRef("C")}})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 0 {
		t.Fatalf("want empty (X - X), got %+v", got)
	}
}

func TestResolveIDResolvesStoredContext(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	_ = m.InsertContext(contexts.Context{ProjectID: "p", ID: "C",
		Includes: []contexts.Ref{ref("document", "d1"), ref("document", "d2")}})
	got, err := svc.ResolveID("p", "C")
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, []contexts.Ref{ref("document", "d1"), ref("document", "d2")}) {
		t.Fatalf("ResolveID failed: %+v", got)
	}
}

func TestResolveMemoizesDiamondFanOut(t *testing.T) {
	mem := newMem()
	cs := &countingStore{inner: mem, counts: map[string]int{}}
	// Chain where each context includes the NEXT one twice: naive expansion is
	// 2^depth ContextByID calls; memoized is one per context.
	depth := 12
	for i := depth; i >= 0; i-- {
		id := "C" + itoa(i)
		var inc []contexts.Ref
		if i == depth {
			inc = []contexts.Ref{{Kind: "document", ID: "leaf"}}
		} else {
			next := contexts.Ref{Kind: contexts.KindContext, ID: "C" + itoa(i+1)}
			inc = []contexts.Ref{next, next} // twice → naive doubles per level
		}
		_ = mem.InsertContext(contexts.Context{ProjectID: "p", ID: id, Includes: inc})
	}
	svc := contexts.New(cs)
	got, err := svc.ResolveID("p", "C0")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].ID != "leaf" {
		t.Fatalf("resolve = %+v, want single leaf", got)
	}
	for i := 0; i <= depth; i++ {
		if n := cs.counts["C"+itoa(i)]; n > 1 {
			t.Fatalf("C%d read %d times; memoization failed (expected 1)", i, n)
		}
	}
}

func TestResolveConnectorExpandsToFileOrigins(t *testing.T) {
	svc := contexts.New(newMem())
	svc.UseConnectorFiles(fakeConnectorFiles{byConnector: map[string][]contexts.Ref{
		"X": {connRef("X\x1fa"), connRef("X\x1fb")},
	}})
	got, err := svc.Resolve("p", contexts.Definition{Includes: []contexts.Ref{connRef("X")}})
	if err != nil {
		t.Fatal(err)
	}
	want := []contexts.Ref{connRef("X\x1fa"), connRef("X\x1fb")}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("connector expansion failed: got %+v, want %+v", got, want)
	}
}

func TestResolveConnectorExcludeOneFileInside(t *testing.T) {
	svc := contexts.New(newMem())
	svc.UseConnectorFiles(fakeConnectorFiles{byConnector: map[string][]contexts.Ref{
		"X": {connRef("X\x1fa"), connRef("X\x1fb")},
	}})
	def := contexts.Definition{
		Includes: []contexts.Ref{connRef("X")},
		Excludes: []contexts.Ref{connRef("X\x1fa")},
	}
	got, err := svc.Resolve("p", def)
	if err != nil {
		t.Fatal(err)
	}
	want := []contexts.Ref{connRef("X\x1fb")}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("leaf exclusion inside connector failed: got %+v, want %+v", got, want)
	}
}

func TestResolveConnectorNestedInsideContextExpands(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	svc.UseConnectorFiles(fakeConnectorFiles{byConnector: map[string][]contexts.Ref{
		"X": {connRef("X\x1fa"), connRef("X\x1fb")},
	}})
	_ = m.InsertContext(contexts.Context{ProjectID: "p", ID: "C",
		Includes: []contexts.Ref{connRef("X")}})
	got, err := svc.ResolveID("p", "C")
	if err != nil {
		t.Fatal(err)
	}
	want := []contexts.Ref{connRef("X\x1fa"), connRef("X\x1fb")}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("nested connector expansion failed: got %+v, want %+v", got, want)
	}
}

func TestResolveConnectorWithoutPortPassesThroughUnchanged(t *testing.T) {
	svc := contexts.New(newMem())
	got, err := svc.Resolve("p", contexts.Definition{Includes: []contexts.Ref{connRef("X")}})
	if err != nil {
		t.Fatal(err)
	}
	want := []contexts.Ref{connRef("X")}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("no-port passthrough failed: got %+v, want %+v", got, want)
	}
}

func TestReferencesDirectMember(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	_ = m.InsertContext(contexts.Context{ProjectID: "p", ID: "C",
		Includes: []contexts.Ref{connRef("X")}})
	ok, err := svc.References("p", "C", "connector", "X")
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatalf("want C to reference direct member connector/X")
	}
}

func TestReferencesTransitiveThroughNestedContext(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	_ = m.InsertContext(contexts.Context{ProjectID: "p", ID: "Inner",
		Includes: []contexts.Ref{connRef("X")}})
	_ = m.InsertContext(contexts.Context{ProjectID: "p", ID: "Outer",
		Includes: []contexts.Ref{ctxRef("Inner")}})
	ok, err := svc.References("p", "Outer", "connector", "X")
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatalf("want Outer to transitively reference connector/X through Inner")
	}
}

func TestReferencesTrueThroughExcludes(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	_ = m.InsertContext(contexts.Context{ProjectID: "p", ID: "C",
		Includes: []contexts.Ref{connRef("Y")},
		Excludes: []contexts.Ref{connRef("X")}})
	ok, err := svc.References("p", "C", "connector", "X")
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatalf("want C to reference an excluded member connector/X — a prompt that excludes a context still depends on that context's membership")
	}
}

func TestReferencesFalseForNonMember(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	_ = m.InsertContext(contexts.Context{ProjectID: "p", ID: "C",
		Includes: []contexts.Ref{connRef("Y")}})
	ok, err := svc.References("p", "C", "connector", "X")
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatalf("want C to NOT reference non-member connector/X")
	}
}

func TestReferencesCycleSafe(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	_ = m.InsertContext(contexts.Context{ProjectID: "p", ID: "A", Includes: []contexts.Ref{ctxRef("B")}})
	_ = m.InsertContext(contexts.Context{ProjectID: "p", ID: "B", Includes: []contexts.Ref{ctxRef("A")}})
	ok, err := svc.References("p", "A", "connector", "X")
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatalf("want A->B->A cycle to terminate without matching connector/X")
	}
}

func TestReferencesWholeProjectDoesNotCountAsReferencingArbitraryOrigin(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	_ = m.InsertContext(contexts.Context{ProjectID: "p", ID: "C",
		Includes: []contexts.Ref{ctxRef(contexts.WholeProjectID)}})
	ok, err := svc.References("p", "C", "connector", "X")
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatalf("whole-project member must NOT count as referencing an arbitrary origin (would refresh every prompt on every change)")
	}
}

func TestReferencesMissingContextContributesNothing(t *testing.T) {
	svc := contexts.New(newMem())
	ok, err := svc.References("p", "missing", "connector", "X")
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatalf("want missing context to contribute nothing")
	}
}
