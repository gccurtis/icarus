package dispatch_test

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/platform/dispatch"
)

// TestKeyedMutexSerializesSameKey proves that two goroutines holding the same
// key never run their critical sections at the same time: a shared "inside"
// counter is only ever 1 while a holder runs. Run under -race for teeth.
func TestKeyedMutexSerializesSameKey(t *testing.T) {
	var m dispatch.KeyedMutex
	var inside, maxInside int32

	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 50; j++ {
				unlock := m.Lock("doc-1")
				n := atomic.AddInt32(&inside, 1)
				if n > atomic.LoadInt32(&maxInside) {
					atomic.StoreInt32(&maxInside, n)
				}
				// Hold briefly so an overlap would be observable.
				time.Sleep(time.Microsecond)
				atomic.AddInt32(&inside, -1)
				unlock()
			}
		}()
	}
	wg.Wait()

	if got := atomic.LoadInt32(&maxInside); got != 1 {
		t.Fatalf("max concurrent holders of one key = %d, want 1", got)
	}
}

// TestKeyedMutexDifferentKeysRunConcurrently proves different keys do not
// contend: all N holders must be inside their critical section simultaneously,
// which can only happen if the locks are independent. A barrier both/all must
// reach forces the overlap; a global lock would deadlock the test's intent and
// trip the timeout.
func TestKeyedMutexDifferentKeysRunConcurrently(t *testing.T) {
	var m dispatch.KeyedMutex
	const n = 4

	var reached sync.WaitGroup
	reached.Add(n)
	release := make(chan struct{})
	done := make(chan struct{})

	for i := 0; i < n; i++ {
		key := string(rune('a' + i))
		go func() {
			unlock := m.Lock(key)
			reached.Done() // signal we are inside our critical section
			<-release      // hold until every key is inside
			unlock()
		}()
	}

	go func() {
		reached.Wait()
		close(done)
	}()

	select {
	case <-done:
		close(release)
	case <-time.After(2 * time.Second):
		close(release)
		t.Fatal("different keys did not run concurrently (locks are not per-key)")
	}
}

// TestKeyedMutexReleasesEntries checks the internal map does not retain an entry
// once a key has no holders, so long-lived processes do not leak memory keyed by
// document id.
func TestKeyedMutexReleasesEntries(t *testing.T) {
	var m dispatch.KeyedMutex
	unlock := m.Lock("doc-1")
	unlock()
	if got := m.Len(); got != 0 {
		t.Fatalf("keyed-mutex retained %d entries after release, want 0", got)
	}
}
