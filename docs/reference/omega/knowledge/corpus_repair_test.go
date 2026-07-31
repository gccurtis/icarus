package knowledge_test

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

// memoryLogger records what the capability narrates, so a test can assert
// WHICH path a rebuild took — repair and consolidation produce identical
// corpora by design, and the log line is the only observable difference.
type memoryLogger struct {
	mu    sync.Mutex
	lines []string
}

func (l *memoryLogger) log(format string, args ...any) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.lines = append(l.lines, fmt.Sprintf(format, args...))
}
func (l *memoryLogger) Infof(format string, args ...any)  { l.log(format, args...) }
func (l *memoryLogger) Warnf(format string, args ...any)  { l.log(format, args...) }
func (l *memoryLogger) Errorf(format string, args ...any) { l.log(format, args...) }

func (l *memoryLogger) contains(sub string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	for _, line := range l.lines {
		if strings.Contains(line, sub) {
			return true
		}
	}
	return false
}

// topicDoc builds a small one-window document dominated by its topic's
// vocabulary, with one word of its own so no two docs are byte-identical.
func topicDoc(topic, doc int) string {
	vocab := []string{
		"sparrow finch heron plumage migration nest",
		"piston crankshaft torque camshaft combustion valve",
		"sonata cadenza arpeggio crescendo overture chord",
		"glacier moraine crevasse icefall serac firn",
	}[topic]
	return strings.Repeat(vocab+" ", 6) + fmt.Sprintf("docword%d.", doc)
}

// The end-to-end gate for the local-events design: a rebuild that REPAIRS the
// stored index must produce the identical corpus tier a full CONSOLIDATION
// over the same frontier produces — same content-addressed node ids, not just
// the same shape. Both runs share one store, so window and root ids are
// identical and the comparison is exact.
func TestRepairedRebuildMatchesConsolidation(t *testing.T) {
	store := knowledge.NewMemoryStore()
	logRec := &memoryLogger{}
	opts := smallWindows
	opts.MaxClusterPool = 8 // far under the frontier, so the corpus level runs sparse
	opts.NeighborsK = 8
	opts.NeighborsPCADims = -1 // tiny pool; score candidates at full dimension
	opts.Logger = logRec
	k := knowledge.New(store, fakeEmbedder{dim: 128}, opts)
	ctx := context.Background()

	// Twelve docs across four topics, then a full build.
	for d := 0; d < 12; d++ {
		if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, fmt.Sprintf("d%d", d), "",
			topicDoc(d%4, d), nil, 0); err != nil {
			t.Fatal(err)
		}
	}
	if err := k.RebuildCorpus(ctx, "p"); err != nil {
		t.Fatal(err)
	}
	indexes, err := store.CorpusIndexes("p")
	if err != nil {
		t.Fatal(err)
	}
	if len(indexes) == 0 {
		t.Fatal("a sparse rebuild stored no level index")
	}
	if len(corpusNodeIDs(t, store)) == 0 {
		t.Fatal("no corpus clusters formed; everything after would be vacuous")
	}

	// One more doc lands: the next rebuild must REPAIR, and say so.
	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "d12", "", topicDoc(0, 12), nil, 0); err != nil {
		t.Fatal(err)
	}
	if err := k.RebuildCorpus(ctx, "p"); err != nil {
		t.Fatal(err)
	}
	if !logRec.contains("repaired (+") {
		t.Fatal("the one-doc rebuild did not take the repair path")
	}
	repaired := corpusNodeIDs(t, store)

	// Force a consolidation over the SAME frontier: a second capability over
	// the same store with repair disabled, dirtied by an add+remove that nets
	// out to nothing.
	full := smallWindows
	full.MaxClusterPool = 8
	full.NeighborsK = 8
	full.NeighborsPCADims = -1
	full.NeighborsRepairMaxFraction = -1 // never repair
	kFull := knowledge.New(store, fakeEmbedder{dim: 128}, full)
	if _, err := kFull.Add(ctx, "p", knowledge.SourceTypeDocument, "scratch", "", topicDoc(1, 99), nil, 0); err != nil {
		t.Fatal(err)
	}
	if _, err := kFull.Remove(ctx, "p", knowledge.SourceTypeDocument, "scratch"); err != nil {
		t.Fatal(err)
	}
	if err := kFull.RebuildCorpus(ctx, "p"); err != nil {
		t.Fatal(err)
	}
	consolidated := corpusNodeIDs(t, store)

	if len(repaired) != len(consolidated) {
		t.Fatalf("repair produced %d corpus nodes, consolidation %d", len(repaired), len(consolidated))
	}
	for id := range repaired {
		if !consolidated[id] {
			t.Errorf("corpus node %s exists after repair but not after consolidation", id)
		}
	}
}

// corpusNodeIDs collects the ids of every corpus-tier node in project "p".
func corpusNodeIDs(t *testing.T, store *knowledge.MemoryStore) map[string]bool {
	t.Helper()
	nodes, _ := loadLattice(t, store, "p")
	out := map[string]bool{}
	for _, n := range nodes {
		if n.LocalRefID == "" {
			out[n.ID] = true
		}
	}
	return out
}
