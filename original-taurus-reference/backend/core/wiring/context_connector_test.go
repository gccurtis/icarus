package wiring

import (
	"context"
	"reflect"
	"sort"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/contexts"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

// noopEmbedder satisfies knowledge.Embedder with a fixed zero vector per
// text. SourcesUnder (and the ReplaceSource path Add uses to get there)
// never inspects the vectors it's handed, so a real embedder isn't needed —
// only something that lets *knowledge.Knowledge construct without a nil
// dependency.
type noopEmbedder struct{ dim int }

func (e noopEmbedder) Embed(_ context.Context, texts []string) (knowledge.Embedded, error) {
	vecs := make([][]float64, len(texts))
	for i := range vecs {
		vecs[i] = make([]float64, e.dim)
	}
	return knowledge.Embedded{
		Vectors:  vecs,
		Identity: knowledge.VectorIdentity{Provider: "test", Model: "noop", Dims: e.dim},
	}, nil
}

// sourceIDs sorts a []contexts.Ref down to its bare IDs for order-independent
// comparison.
func sourceIDs(refs []contexts.Ref) []string {
	out := make([]string, len(refs))
	for i, r := range refs {
		out[i] = r.ID
	}
	sort.Strings(out)
	return out
}

// TestConnectorFilesCatalogFiltersSiblingPrefixAndCrossConnector proves the
// REAL connectorFilesCatalog.FilesUnder filter — not resolve_test.go's fake,
// which bypasses it entirely — against the two cases a future loosening of
// the filter (e.g. to a bare strings.HasPrefix(o.SourceID, connectorID)
// instead of requiring the FileSeparator-qualified prefix or an exact match)
// would break silently: a sibling file whose id happens to start with
// another file's id as a raw string ("X/a" vs "X/ab"), and a different
// connector whose id happens to start with the queried one ("X" vs "Xother").
func TestConnectorFilesCatalogFiltersSiblingPrefixAndCrossConnector(t *testing.T) {
	store := knowledge.NewMemoryStore()
	know := knowledge.New(store, noopEmbedder{dim: 8}, knowledge.Options{})
	ctx := context.Background()

	// Connector X has three files, two of which are a sibling-prefix trap:
	// "X/a" is a literal string prefix of "X/ab" even though they are
	// unrelated files at the same level. Connector "Xother" is a
	// cross-connector trap: its id has "X" as a raw string prefix.
	seed := []string{"X/a", "X/ab", "X/b", "Xother/a"}
	for _, id := range seed {
		if _, err := know.Add(ctx, "p", knowledge.SourceTypeConnector, id, "", "content for "+id, nil, 1); err != nil {
			t.Fatalf("seed %q: %v", id, err)
		}
	}

	a := connectorFilesCatalog{know: know}

	t.Run("connector root returns all its files, not itself", func(t *testing.T) {
		got, err := a.FilesUnder("p", "X")
		if err != nil {
			t.Fatal(err)
		}
		want := []string{"X/a", "X/ab", "X/b"}
		if gotIDs := sourceIDs(got); !reflect.DeepEqual(gotIDs, want) {
			t.Fatalf("FilesUnder(p, X) IDs = %+v, want %+v", gotIDs, want)
		}
		for _, r := range got {
			if r.Kind != contexts.KindConnector {
				t.Fatalf("ref %+v has wrong kind, want %q", r, contexts.KindConnector)
			}
			if r.ID == "X" {
				t.Fatalf("FilesUnder(p, X) returned the connector root itself: %+v", got)
			}
		}
	})

	t.Run("sibling prefix does not leak: X/a excludes X/ab", func(t *testing.T) {
		got, err := a.FilesUnder("p", "X/a")
		if err != nil {
			t.Fatal(err)
		}
		want := []contexts.Ref{{Kind: contexts.KindConnector, ID: "X/a"}}
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("FilesUnder(p, X/a) = %+v, want exactly %+v (must not include X/ab)", got, want)
		}
	})

	t.Run("cross-connector isolation: X does not see Xother's files", func(t *testing.T) {
		got, err := a.FilesUnder("p", "X")
		if err != nil {
			t.Fatal(err)
		}
		for _, r := range got {
			if r.ID == "Xother/a" {
				t.Fatalf("FilesUnder(p, X) leaked a different connector's file: %+v", got)
			}
		}
	})

	t.Run("connector with no files returns empty", func(t *testing.T) {
		got, err := a.FilesUnder("p", "Z")
		if err != nil {
			t.Fatal(err)
		}
		if len(got) != 0 {
			t.Fatalf("FilesUnder(p, Z) = %+v, want empty", got)
		}
	})
}
