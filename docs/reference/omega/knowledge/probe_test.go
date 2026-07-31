package knowledge_test

import (
	"context"
	"fmt"
	"reflect"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

// probeOpts is the sparse-corpus fixture with descent on. The probe itself has
// no switch: it runs whenever a corpus index is stored, which the tiny
// MaxClusterPool crossover guarantees here.
func probeOpts() knowledge.Options {
	opts := smallWindows
	opts.MaxClusterPool = 8
	opts.NeighborsK = 8
	opts.NeighborsPCADims = -1
	return opts
}

// The probe must not change what retrieval finds — only what it loads to find
// it. Clustered topics retrieve through corpus roots (which the index never
// covers, so the probe always loads them), and a lone orphan retrieves
// through its cell: the query lands in the same region of the projection its
// vector did, so the probed cells contain it.
func TestProbedRetrievalStillFindsTheRegions(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 128}, probeOpts())
	ctx := context.Background()

	for d := 0; d < 12; d++ {
		if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, fmt.Sprintf("d%d", d), "",
			topicDoc(d%4, d), nil, 0); err != nil {
			t.Fatal(err)
		}
	}
	// One orphan: vocabulary no other doc shares, so it clusters with nothing
	// and stays in the entry frontier as an index-covered window.
	orphanText := "quasar pulsar nebula parallax redshift occultation. "
	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "lone", "", orphanText, nil, 0); err != nil {
		t.Fatal(err)
	}
	if err := k.RebuildCorpus(ctx, "p"); err != nil {
		t.Fatal(err)
	}
	if ix, err := store.CorpusIndexes("p"); err != nil || len(ix) == 0 {
		t.Fatalf("no stored index (%v); the probe would silently test the fallback", err)
	}

	// A clustered topic, found through its corpus root.
	res, err := k.Retrieve(ctx, "p", "sparrow finch heron plumage", 3)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Regions) == 0 {
		t.Fatal("probed retrieval found nothing for a clustered topic")
	}
	if got := res.Regions[0].SourceID; got != "d0" && got != "d4" && got != "d8" {
		t.Errorf("top source = %q, want a topic-0 doc", got)
	}

	// The orphan, found through its probed cell.
	res, err = k.Retrieve(ctx, "p", "quasar pulsar nebula", 3)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Regions) == 0 || res.Regions[0].SourceID != "lone" {
		t.Fatalf("probed retrieval lost the orphan: %+v", res.Regions)
	}

	// And probed descent changed nothing about the answer: RetrieveExact — the
	// reference algorithm, a separate named function rather than a production
	// flag — returns the same top source for every query.
	for _, q := range []string{"sparrow finch heron plumage", "quasar pulsar nebula", "sonata cadenza arpeggio"} {
		a, err := k.Retrieve(ctx, "p", q, 1)
		if err != nil {
			t.Fatal(err)
		}
		b, err := k.RetrieveExact(ctx, "p", q, 1)
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(regionSources(a), regionSources(b)) {
			t.Errorf("query %q: probed descent %v, exact scan %v — the probe changed the answer", q, regionSources(a), regionSources(b))
		}
	}
}

// With no stored index — an exact-tier project — the probe must fall back to
// the full entry scan rather than failing or returning less.
func TestProbeFallsBackWithoutAnIndex(t *testing.T) {
	opts := smallWindows
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 128}, opts)
	ctx := context.Background()

	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "birds", "",
		longText("sparrow finch heron plumage migration"), nil, 0); err != nil {
		t.Fatal(err)
	}
	if err := k.RebuildCorpus(ctx, "p"); err != nil {
		t.Fatal(err)
	}
	if ix, _ := store.CorpusIndexes("p"); len(ix) != 0 {
		t.Fatal("precondition: an exact-tier project should store no index")
	}
	res, err := k.Retrieve(ctx, "p", "sparrow finch heron", 3)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Regions) == 0 || res.Regions[0].SourceID != "birds" {
		t.Fatalf("the fallback lost retrieval: %+v", res.Regions)
	}
}

func regionSources(r knowledge.RetrieveResult) []string {
	out := make([]string, len(r.Regions))
	for i, reg := range r.Regions {
		out[i] = reg.SourceID
	}
	return out
}
