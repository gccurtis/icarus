package connector

import (
	"errors"
	"testing"
	"time"
)

// providerState is one scripted provider's behaviour, shared with the test so it
// can be flipped from failing to working mid-run.
//
// calls is the assertion that matters most here. The retry cap exists to stop
// repeated work, and the snapshot is the first expensive thing a sync does —
// everything downstream of it re-embeds every window at provider rates. A
// deferral that still snapshotted would not be a deferral.
type providerState struct {
	calls int
	err   error
	snap  Snapshot
}

type scriptedProvider struct{ state *providerState }

func (p scriptedProvider) Snapshot() (Snapshot, error) {
	p.state.calls++
	if p.state.err != nil {
		return Snapshot{}, p.state.err
	}
	return p.state.snap, nil
}

func scriptedFactory(st *providerState) ProviderFactory {
	return func(Connector) (Provider, error) { return scriptedProvider{state: st}, nil }
}

// testClock is a hand-advanced clock, so backoff can be tested at its real
// durations without a test that waits minutes to find out.
type testClock struct{ t time.Time }

func (c *testClock) now() time.Time { return c.t }

func (c *testClock) advance(d time.Duration) { c.t = c.t.Add(d) }

// exhaustAttempts drives a connector to its attempt cap through the AUTOMATIC
// path, advancing the clock past each backoff.
//
// It has to be the automatic path: an explicit Sync restarts the count by design,
// so a person cannot stop their own connector however many times they click. Only
// the detector's repetition is what the cap is defending against.
func exhaustAttempts(t *testing.T, c *Connectors, clock *testClock, rec Connector) {
	t.Helper()
	for i := range 3 {
		clock.advance(time.Hour) // well past any backoff step
		if _, err := c.SyncIfChanged(rec.ProjectID, rec.ID); err == nil {
			t.Fatalf("attempt %d: expected the sync to fail", i+1)
		}
	}
	got, err := c.Get(rec.ProjectID, rec.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if !c.NeedsAttention(got) {
		t.Fatalf("expected the connector to have stopped retrying, got %+v", got)
	}
}

// scriptedConnector wires a service over a scripted provider and a fake clock,
// with a connector already created and configured.
func scriptedConnector(t *testing.T, st *providerState) (*Connectors, *testClock, Connector) {
	t.Helper()
	clock := &testClock{t: time.Date(2026, 7, 29, 12, 0, 0, 0, time.UTC)}
	c := NewWithSync(NewMemoryStore(nil), scriptedFactory(st), newFakeLattice())
	c.now = clock.now
	c.UseSyncRetry(3, time.Second, time.Hour)
	rec, err := c.Create("p", Actor{ID: "u"}, "C", SubKindLocalFolder)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	rec, err = c.Configure("p", rec.ID, "scripted://source")
	if err != nil {
		t.Fatalf("configure: %v", err)
	}
	return c, clock, rec
}

// TestSyncStopsRetryingAfterMaxAttempts is the defect this phase exists to fix.
//
// Connector sync is reconciliation with no memory: the decision to sync comes
// from comparing the source's fingerprint to the stored one, and a failed sync
// used to record nothing at all — so the detector's next tick decided to sync
// again, re-read the whole source, and re-embedded every window. Forever, for as
// long as the failure lasted, at provider rates.
//
// The whole contract is asserted here: each failure is counted and backed off,
// the count stops at the cap, and past the cap the automatic path does not touch
// the provider again.
func TestSyncStopsRetryingAfterMaxAttempts(t *testing.T) {
	st := &providerState{err: errors.New("provider unreachable")}
	c, clock, rec := scriptedConnector(t, st)

	for attempt := 1; attempt <= 3; attempt++ {
		if _, err := c.SyncIfChanged("p", rec.ID); err == nil {
			t.Fatalf("attempt %d: expected the sync to fail", attempt)
		}
		got, err := c.Get("p", rec.ID)
		if err != nil {
			t.Fatalf("get: %v", err)
		}
		if got.FailedAttempts != attempt {
			t.Fatalf("after failure %d: FailedAttempts = %d, want %d", attempt, got.FailedAttempts, attempt)
		}
		if got.LastError == "" {
			t.Fatalf("after failure %d: LastError is empty; the cause must be recorded for anyone to act on it", attempt)
		}
		if attempt < 3 {
			// Backoff doubles: 1s, then 2s.
			want := clock.t.Add(time.Duration(1<<(attempt-1)) * time.Second)
			if !got.RetryAfter.Equal(want) {
				t.Fatalf("after failure %d: RetryAfter = %s, want %s", attempt, got.RetryAfter, want)
			}
			if c.NeedsAttention(got) {
				t.Fatalf("after failure %d of 3: needs attention already", attempt)
			}
			clock.advance(want.Sub(clock.t))
		}
	}

	final, _ := c.Get("p", rec.ID)
	if !c.NeedsAttention(final) {
		t.Fatal("after the third failure the connector must report needing attention")
	}
	// At the cap the connector is no longer waiting on a clock — it is waiting on a
	// person — so there is no retry time to hold.
	if !final.RetryAfter.IsZero() {
		t.Fatalf("RetryAfter = %s at the attempt cap, want zero", final.RetryAfter)
	}

	// Past the cap, no amount of automatic syncing reaches the provider again.
	before := st.calls
	clock.advance(24 * time.Hour)
	for range 5 {
		res, err := c.SyncIfChanged("p", rec.ID)
		if err != nil {
			t.Fatalf("a stopped connector must defer, not error: %v", err)
		}
		if !res.Deferred {
			t.Fatal("a stopped connector must report Deferred, not a clean no-change result")
		}
	}
	if st.calls != before {
		t.Fatalf("provider was snapshotted %d more times past the cap; want 0", st.calls-before)
	}
}

// TestSyncDefersInsideBackoff is the other half of the cost bound: between
// attempts, the detector's ticks cost nothing. At a two-second detect interval
// and a thirty-second backoff, that is fifteen ticks that must not read the
// source.
func TestSyncDefersInsideBackoff(t *testing.T) {
	st := &providerState{err: errors.New("provider unreachable")}
	c, clock, rec := scriptedConnector(t, st)

	if _, err := c.SyncIfChanged("p", rec.ID); err == nil {
		t.Fatal("expected the first sync to fail")
	}
	if st.calls != 1 {
		t.Fatalf("provider calls = %d after one failure, want 1", st.calls)
	}

	// Inside the backoff window: deferred, and the provider is never asked.
	for range 3 {
		clock.advance(200 * time.Millisecond)
		res, err := c.SyncIfChanged("p", rec.ID)
		if err != nil || !res.Deferred {
			t.Fatalf("inside backoff: res = %+v, err = %v; want a deferral", res, err)
		}
	}
	if st.calls != 1 {
		t.Fatalf("provider calls = %d during backoff, want 1 — the deferral must precede the snapshot", st.calls)
	}

	// Past it: tried again, and counted again.
	clock.advance(time.Second)
	if _, err := c.SyncIfChanged("p", rec.ID); err == nil {
		t.Fatal("expected the retry to fail too")
	}
	if st.calls != 2 {
		t.Fatalf("provider calls = %d after the backoff elapsed, want 2", st.calls)
	}
}

// TestExplicitSyncOverridesTheBackoff covers the case the cap must not break: a
// person has fixed the source and says "try now". Waiting out a fifteen-minute
// backoff, or refusing entirely because the connector is in its terminal state,
// would be exactly wrong at the one moment the sync is guaranteed to work.
func TestExplicitSyncOverridesTheBackoff(t *testing.T) {
	st := &providerState{err: errors.New("provider unreachable")}
	c, clock, rec := scriptedConnector(t, st)
	exhaustAttempts(t, c, clock, rec)

	// The source is fixed. An explicit sync must go through and clear everything.
	st.err = nil
	st.snap = Snapshot{Fingerprint: "f1", Files: []FileEntry{TextEntry("a.txt", "hello")}}
	res, err := c.Sync("p", rec.ID)
	if err != nil || !res.Changed {
		t.Fatalf("explicit sync after repair: res = %+v, err = %v; want a changed sync", res, err)
	}
	healed, _ := c.Get("p", rec.ID)
	if healed.FailedAttempts != 0 || healed.LastError != "" || !healed.RetryAfter.IsZero() {
		t.Fatalf("success must clear the failure state, got %+v", healed)
	}
	if c.NeedsAttention(healed) {
		t.Fatal("a connector that just synced cannot need attention")
	}
}

// TestExplicitSyncRestartsTheAttemptCount is the same override when the repair
// did not work. The manual attempt must not leave the connector stopped — that
// would make one failed retry as final as three — but it must not reset it to
// "healthy" either. It restarts the count, so the automatic path resumes at the
// first backoff step.
func TestExplicitSyncRestartsTheAttemptCount(t *testing.T) {
	st := &providerState{err: errors.New("provider unreachable")}
	c, clock, rec := scriptedConnector(t, st)
	exhaustAttempts(t, c, clock, rec)

	if _, err := c.Sync("p", rec.ID); err == nil {
		t.Fatal("expected the manual retry to fail")
	}
	got, _ := c.Get("p", rec.ID)
	if got.FailedAttempts != 1 {
		t.Fatalf("FailedAttempts = %d after a failed manual retry, want 1 (the count restarts)", got.FailedAttempts)
	}
	if c.NeedsAttention(got) {
		t.Fatal("a manual retry must hand the connector back to the automatic path, not leave it stopped")
	}
	if got.RetryAfter.IsZero() {
		t.Fatal("the automatic path needs a retry time to wait for")
	}
}

// TestUnchangedSourceClearsAFailure covers the failure that resolves itself
// without a sync happening: the snapshot succeeds, but its fingerprint matches
// what is stored, so there is nothing to apply.
//
// That happens for real when a sync fails after the snapshot — inside the
// lattice write — and the source is then reverted. Without this, the counter
// would stay armed, and the next genuine edit would start partway to the cap.
func TestUnchangedSourceClearsAFailure(t *testing.T) {
	snap := Snapshot{Fingerprint: "f1", Files: []FileEntry{TextEntry("a.txt", "hello")}}
	st := &providerState{snap: snap}
	c, _, rec := scriptedConnector(t, st)

	if _, err := c.Sync("p", rec.ID); err != nil {
		t.Fatalf("first sync: %v", err)
	}
	// Arm the counter the way a post-snapshot failure would.
	if err := c.store.SetConnectorSyncFailure("p", rec.ID, 2, "lattice write failed", time.Time{}); err != nil {
		t.Fatalf("arm failure: %v", err)
	}

	res, err := c.SyncIfChanged("p", rec.ID)
	if err != nil || res.Changed || res.Deferred {
		t.Fatalf("unchanged re-sync: res = %+v, err = %v; want a clean no-change", res, err)
	}
	got, _ := c.Get("p", rec.ID)
	if got.FailedAttempts != 0 || got.LastError != "" {
		t.Fatalf("a reachable, unchanged source has nothing left to retry, got %+v", got)
	}
}

// TestDetectChangesSeparatesDeferredFromFailed keeps the detector's log honest.
// Three situations look alike from the outside and are not: failed just now,
// waiting to retry, and stopped. Counting a deferral as a failure would report a
// storm of failures that never happened; counting a stopped connector as
// unchanged would make it silently invisible, which is the one outcome the whole
// phase is meant to prevent.
func TestDetectChangesSeparatesDeferredFromFailed(t *testing.T) {
	st := &providerState{err: errors.New("provider unreachable")}
	c, clock, rec := scriptedConnector(t, st)

	if _, err := c.SyncIfChanged("p", rec.ID); err == nil {
		t.Fatal("expected the first sync to fail")
	}

	out, err := c.DetectChanges()
	if err != nil {
		t.Fatalf("DetectChanges: %v", err)
	}
	if out.Deferred != 1 || out.Failed != 0 || out.Attention != 0 {
		t.Fatalf("inside backoff: %+v; want 1 deferred", out)
	}

	// Exhaust the attempts, then sweep again.
	for range 2 {
		clock.advance(time.Hour)
		if _, err := c.SyncIfChanged("p", rec.ID); err == nil {
			t.Fatal("expected the retry to fail")
		}
	}
	before := st.calls
	out, err = c.DetectChanges()
	if err != nil {
		t.Fatalf("DetectChanges: %v", err)
	}
	if out.Attention != 1 || out.Failed != 0 || out.Deferred != 0 {
		t.Fatalf("past the cap: %+v; want 1 needing attention", out)
	}
	if st.calls != before {
		t.Fatal("a sweep must not snapshot a connector that has stopped retrying")
	}
}

// TestSyncBackoffCurve pins the shape: base, then doubling, capped. It is the job
// pool's curve on purpose — a failing sync and a failing job are the same problem,
// and one backoff shape in the system is easier to tune than two that differ for
// no reason.
func TestSyncBackoffCurve(t *testing.T) {
	r := syncRetry{maxAttempts: 8, backoff: time.Second, maxBackoff: 8 * time.Second}
	for _, tc := range []struct {
		attempts int
		want     time.Duration
	}{
		{1, time.Second},
		{2, 2 * time.Second},
		{3, 4 * time.Second},
		{4, 8 * time.Second},
		{5, 8 * time.Second}, // capped
		{9, 8 * time.Second},
	} {
		if got := r.delay(tc.attempts); got != tc.want {
			t.Errorf("delay(%d) = %s, want %s", tc.attempts, got, tc.want)
		}
	}
}
