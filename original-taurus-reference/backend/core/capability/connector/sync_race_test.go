package connector

import (
	"os"
	"path/filepath"
	"sync"
	"testing"
)

// TestConcurrentSyncsDoNotRace pins a bug the live dev-test suites surfaced: the
// background change detector ticks every couple of seconds and calls
// SyncIfChanged, while an explicit POST /connectors/:id/sync calls Sync. Nothing
// stopped the two entering applySync for the same connector at the same moment,
// so both wrote the same lattice sources and the same connector sync state
// concurrently — surfacing to the caller as an intermittent 500 in roughly half
// of runs.
//
// A sync for one connector must be serialized against itself.
func TestConcurrentSyncsDoNotRace(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "f.txt"), []byte("a fact"), 0o644); err != nil {
		t.Fatal(err)
	}
	lat := newFakeLattice()
	c := NewWithSync(NewMemoryStore(nil), localFolderFactory, lat)
	rec, _ := c.Create("p", Actor{ID: "u"}, "Facts", SubKindLocalFolder)
	rec, _ = c.Configure("p", rec.ID, dir)

	// Drive the two entry points at each other, the way the detector and an
	// explicit sync request do.
	const rounds = 25
	var wg sync.WaitGroup
	errs := make(chan error, rounds*2)
	for range rounds {
		wg.Add(2)
		go func() {
			defer wg.Done()
			if _, err := c.Sync("p", rec.ID); err != nil {
				errs <- err
			}
		}()
		go func() {
			defer wg.Done()
			if _, err := c.SyncIfChanged("p", rec.ID); err != nil {
				errs <- err
			}
		}()
	}
	wg.Wait()
	close(errs)

	for err := range errs {
		t.Fatalf("concurrent sync failed: %v — a connector sync must be serialized against itself", err)
	}
}
