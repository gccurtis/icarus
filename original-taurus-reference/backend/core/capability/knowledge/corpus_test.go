package knowledge_test

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/platform/job"
)

// recordingEnqueuer captures what a write scheduled, without running it. Only
// the job type is asserted on: the payload is an unexported struct, and reaching
// into it would couple these tests to a shape they do not care about.
type recordingEnqueuer struct {
	types []string
	err   error
}

func (r *recordingEnqueuer) Enqueue(_ context.Context, typ string, _ any) (job.Job, error) {
	if r.err != nil {
		return job.Job{}, r.err
	}
	r.types = append(r.types, typ)
	return job.Job{}, nil
}

func newLatticeWithEnqueuer(t *testing.T, enq job.Enqueuer) (*knowledge.Knowledge, *knowledge.MemoryStore) {
	t.Helper()
	store := knowledge.NewMemoryStore()
	opts := smallWindows
	opts.Enqueuer = enq
	return knowledge.New(store, fakeEmbedder{dim: 128}, opts), store
}

func longText(seed string) string { return strings.Repeat(seed+" ", 30) }

// A write does not rebuild; it schedules one. This is the whole point of the
// phase: an add must not wait on a project-scale clustering.
func TestAddSchedulesARebuildRatherThanDoingIt(t *testing.T) {
	enq := &recordingEnqueuer{}
	k, _ := newLatticeWithEnqueuer(t, enq)
	ctx := context.Background()

	if _, err := k.Add(ctx, "p1", knowledge.SourceTypeDocument, "d1", "", longText("alpha beta gamma"), nil, 0); err != nil {
		t.Fatal(err)
	}
	if len(enq.types) != 1 || enq.types[0] != knowledge.JobTypeRebuildCorpus {
		t.Fatalf("scheduled %v, want one %s", enq.types, knowledge.JobTypeRebuildCorpus)
	}
	if current, err := k.CorpusCurrent("p1"); err != nil || current {
		t.Errorf("corpus reads current immediately after a write: %v %v", current, err)
	}
}

// A removal invalidates the tier the same way — the frontier it clustered is
// gone. Removing something that was never there schedules nothing.
func TestRemoveSchedulesARebuildOnlyWhenItRemovedSomething(t *testing.T) {
	enq := &recordingEnqueuer{}
	k, _ := newLatticeWithEnqueuer(t, enq)
	ctx := context.Background()

	if _, err := k.Add(ctx, "p1", knowledge.SourceTypeDocument, "d1", "", longText("alpha beta"), nil, 0); err != nil {
		t.Fatal(err)
	}
	enq.types = nil

	if _, err := k.Remove(ctx, "p1", knowledge.SourceTypeDocument, "nope"); err != nil {
		t.Fatal(err)
	}
	if len(enq.types) != 0 {
		t.Errorf("removing an unknown origin scheduled %v", enq.types)
	}

	if _, err := k.Remove(ctx, "p1", knowledge.SourceTypeDocument, "d1"); err != nil {
		t.Fatal(err)
	}
	if len(enq.types) != 1 {
		t.Errorf("a real removal scheduled %v, want one rebuild", enq.types)
	}
}

// Retrieval works in the window between the drop and the rebuild. This is the
// property that makes deferring safe at all: with no corpus tier, descent enters
// at the source frontiers rather than finding nothing.
func TestRetrievalWorksBeforeTheRebuildRuns(t *testing.T) {
	k, _ := newLatticeWithEnqueuer(t, nil)
	ctx := context.Background()

	if _, err := k.Add(ctx, "p1", knowledge.SourceTypeDocument, "birds", "birds",
		longText("sparrow finch heron plumage migration"), nil, 0); err != nil {
		t.Fatal(err)
	}
	if _, err := k.Add(ctx, "p1", knowledge.SourceTypeDocument, "engines", "engines",
		longText("piston crankshaft torque camshaft combustion"), nil, 0); err != nil {
		t.Fatal(err)
	}
	if current, _ := k.CorpusCurrent("p1"); current {
		t.Fatal("precondition: the corpus should be stale here")
	}

	res, err := k.Retrieve(ctx, "p1", "sparrow finch heron", 3)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Regions) == 0 {
		t.Fatal("no regions with the corpus tier absent; retrieval must enter at the source frontiers")
	}
	if got := res.Regions[0].SourceID; got != "birds" {
		t.Errorf("top source = %q, want birds", got)
	}
}

// A write landing while a rebuild is computing must not be lost. The rebuild
// claims only the sequence it read, so the later write leaves the project stale
// and the next rebuild picks it up.
func TestAWriteDuringARebuildLeavesTheProjectStale(t *testing.T) {
	k, store := newLatticeWithEnqueuer(t, nil)
	ctx := context.Background()

	if _, err := k.Add(ctx, "p1", knowledge.SourceTypeDocument, "d1", "", longText("alpha beta"), nil, 0); err != nil {
		t.Fatal(err)
	}
	// Simulate the interleaving directly: read the seq a rebuild would compute
	// against, then let another write land before the result is stored.
	dirty, _, err := store.CorpusSeq("p1")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := k.Add(ctx, "p1", knowledge.SourceTypeDocument, "d2", "", longText("gamma delta"), nil, 0); err != nil {
		t.Fatal(err)
	}
	if err := store.RebuildCorpus("p1", nil, dirty, nil); err != nil {
		t.Fatal(err)
	}
	if current, err := k.CorpusCurrent("p1"); err != nil || current {
		t.Errorf("the intervening write was lost: current=%v err=%v", current, err)
	}
	// And the next rebuild clears it.
	if err := k.RebuildCorpus(ctx, "p1"); err != nil {
		t.Fatal(err)
	}
	if current, err := k.CorpusCurrent("p1"); err != nil || !current {
		t.Errorf("still stale after a full rebuild: current=%v err=%v", current, err)
	}
}

// Failing to schedule must not fail the write. The corpus tier is an
// optimization over the source frontiers, so losing it degrades retrieval rather
// than losing data.
func TestAFailedScheduleDoesNotFailTheWrite(t *testing.T) {
	enq := &recordingEnqueuer{err: errors.New("queue is down")}
	k, _ := newLatticeWithEnqueuer(t, enq)

	res, err := k.Add(context.Background(), "p1", knowledge.SourceTypeDocument, "d1", "",
		longText("alpha beta gamma"), nil, 0)
	if err != nil {
		t.Fatalf("a failed schedule failed the write: %v", err)
	}
	if res.Windows == 0 {
		t.Error("the source was not written")
	}
}

// The job handler is what the registry actually invokes, so it is tested as
// such: payload in, corpus tier out. Without this, a handler that never decoded
// its payload would look identical from the outside — retrieval degrades
// gracefully with no corpus tier, so nothing else would fail.
func TestRebuildCorpusJobDecodesAndRebuilds(t *testing.T) {
	k, _ := newLatticeWithEnqueuer(t, nil)
	ctx := context.Background()

	for _, id := range []string{"d1", "d2"} {
		if _, err := k.Add(ctx, "p1", knowledge.SourceTypeDocument, id, "",
			longText("alpha beta gamma delta epsilon"), nil, 0); err != nil {
			t.Fatal(err)
		}
	}
	if current, _ := k.CorpusCurrent("p1"); current {
		t.Fatal("precondition: the corpus should be stale after writes")
	}

	if err := k.RebuildCorpusJob(ctx, json.RawMessage(`{"projectId":"p1"}`)); err != nil {
		t.Fatalf("the registered handler failed: %v", err)
	}
	if current, err := k.CorpusCurrent("p1"); err != nil || !current {
		t.Errorf("the job did not bring the corpus current: %v %v", current, err)
	}
}

// A malformed payload is an error, not a silent success — a job that quietly
// did nothing would leave the tier stale forever with nothing to show for it.
func TestRebuildCorpusJobRejectsABadPayload(t *testing.T) {
	k, _ := newLatticeWithEnqueuer(t, nil)
	if err := k.RebuildCorpusJob(context.Background(), json.RawMessage(`not json`)); err == nil {
		t.Error("want an error for an undecodable payload")
	}
}

// The MemoryStore must mirror the SQLite store's index semantics: round trip,
// wholesale replacement, nil clears — and invalidation does NOT drop the
// index, because a stale index is exactly what the next rebuild's repair
// diffs against.
func TestMemoryStoreCorpusIndexRoundTrip(t *testing.T) {
	store := knowledge.NewMemoryStore()
	indexes := []knowledge.CorpusLevelIndex{{
		Level: 1, Threshold: 0.3, K: 4,
		Artifacts: []knowledge.CorpusIndexArtifact{{ID: "a", Cell: 0,
			Edges: []knowledge.CorpusIndexEdge{{To: "b", Sim: 0.9}}}},
	}}
	if err := store.RebuildCorpus("p1", nil, 1, indexes); err != nil {
		t.Fatal(err)
	}
	if got, err := store.CorpusIndexes("p1"); err != nil || !reflect.DeepEqual(got, indexes) {
		t.Errorf("round trip changed the index: %+v, %v", got, err)
	}

	// A source write invalidates the corpus tier but keeps the index.
	if err := store.ReplaceSources([]knowledge.SourceWrite{{Source: knowledge.Source{
		LocalRefID: "r1", ProjectID: "p1", SourceType: knowledge.SourceTypeDocument, SourceID: "d1",
	}}}); err != nil {
		t.Fatal(err)
	}
	if got, err := store.CorpusIndexes("p1"); err != nil || !reflect.DeepEqual(got, indexes) {
		t.Errorf("invalidation dropped the index: %+v, %v", got, err)
	}

	if err := store.RebuildCorpus("p1", nil, 2, nil); err != nil {
		t.Fatal(err)
	}
	if got, err := store.CorpusIndexes("p1"); err != nil || got != nil {
		t.Errorf("nil did not clear the index: %+v, %v", got, err)
	}
}
