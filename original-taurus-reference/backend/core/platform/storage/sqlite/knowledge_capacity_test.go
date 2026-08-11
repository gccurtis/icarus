package sqlite

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

func capacityWrite(sourceID string) knowledge.SourceWrite {
	now := time.Now().UTC()
	ref := "ref-" + sourceID
	return knowledge.SourceWrite{
		Source: knowledge.Source{
			LocalRefID: ref, ProjectID: "p", SourceType: knowledge.SourceTypeDocument,
			SourceID: sourceID, AddedAt: now, SyncedAt: now,
		},
		Windows: []knowledge.Window{{
			ID: "window-" + sourceID, LocalRefID: ref, Ordinal: 0, End: 1,
			Embedding: []float64{1}, Text: sourceID,
		}},
	}
}

func TestKnowledgeAdmissionTransactionPreventsConcurrentOverspend(t *testing.T) {
	s := openTemp(t)
	var wg sync.WaitGroup
	errs := make(chan error, 2)
	for _, id := range []string{"left", "right"} {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			_, err := s.AdmitAndReplaceSources(1, []knowledge.SourceWrite{capacityWrite(id)})
			errs <- err
		}(id)
	}
	wg.Wait()
	close(errs)

	succeeded := 0
	for err := range errs {
		if err == nil {
			succeeded++
			continue
		}
		if !errors.Is(err, knowledge.ErrArtifactLimit) {
			t.Fatalf("concurrent admission error = %v, want capacity refusal", err)
		}
	}
	if succeeded != 1 {
		t.Fatalf("%d writers succeeded, want exactly one", succeeded)
	}
	counts, err := s.ArtifactCounts("p")
	if err != nil {
		t.Fatal(err)
	}
	total := 0
	for _, n := range counts {
		total += n
	}
	if total > 1 {
		t.Fatalf("persisted %d artifacts over the cap", total)
	}
}

func TestKnowledgeAdmissionSubtractsOnlyTheReplacedSource(t *testing.T) {
	s := openTemp(t)
	if _, err := s.AdmitAndReplaceSources(2, []knowledge.SourceWrite{capacityWrite("replace")}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.AdmitAndReplaceSources(2, []knowledge.SourceWrite{capacityWrite("other")}); err != nil {
		t.Fatal(err)
	}
	// The replacement's old one is subtracted inside the same transaction; the
	// other source remains counted, so the resulting total is still exactly two.
	if _, err := s.AdmitAndReplaceSources(2, []knowledge.SourceWrite{capacityWrite("replace")}); err != nil {
		t.Fatalf("replacement was charged as an additive write: %v", err)
	}
}
