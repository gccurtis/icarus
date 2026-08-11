// Package dispatch holds small, capability-agnostic primitives the transport
// layer uses to route work — how a request executes once it is past the gate.
// It is a leaf: it imports no capability and no other platform package, so any
// layer may depend on it.
package dispatch

import "sync"

// KeyedMutex is a set of mutexes addressed by string key: holders of the same
// key are serialized, while different keys never contend. It is the primitive
// behind the dispatcher's "serial" execution mode (serialize writes to one
// document without serializing writes to unrelated documents).
//
// Entries are reference-counted and dropped when a key's last holder releases,
// so a long-lived process does not accumulate an entry per key it has ever seen.
// The zero value is ready to use.
type KeyedMutex struct {
	mu    sync.Mutex
	locks map[string]*keyedLock
}

type keyedLock struct {
	mu   sync.Mutex
	refs int
}

// Lock acquires the mutex for key, blocking while another holder of the same key
// runs, and returns a function that releases it. Each Lock call must be paired
// with exactly one call to the returned unlock function.
func (m *KeyedMutex) Lock(key string) (unlock func()) {
	m.mu.Lock()
	if m.locks == nil {
		m.locks = make(map[string]*keyedLock)
	}
	kl, ok := m.locks[key]
	if !ok {
		kl = &keyedLock{}
		m.locks[key] = kl
	}
	kl.refs++
	m.mu.Unlock()

	kl.mu.Lock()

	return func() {
		kl.mu.Unlock()
		m.mu.Lock()
		kl.refs--
		if kl.refs == 0 {
			delete(m.locks, key)
		}
		m.mu.Unlock()
	}
}

// Len reports how many keys currently have an entry (holders or waiters). It is
// zero when nothing is in flight; used by tests to assert entries are released.
func (m *KeyedMutex) Len() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.locks)
}
