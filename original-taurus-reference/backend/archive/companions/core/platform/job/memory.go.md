# memory.go

`memory.go` is an in-memory implementation of the `Store` interface, used in
tests. It keeps jobs in a map guarded by a mutex, and its whole reason to exist is
to mirror the SQLite store's behavior — especially the atomic claim — closely
enough that tests exercising the queue and pool against it are trustworthy. If the
in-memory store claimed jobs differently from the real one, tests would validate a
concurrency model the production store does not actually have.

The one subtle method is `ClaimDue`, which must select the earliest due queued job
and mark it running as a single indivisible step. The SQLite store gets that
atomicity from a transaction; here it comes from holding the mutex across the whole
select-and-mark. Every other method is a small guarded read or update, and the
mutating ones funnel through a shared `update` helper so the lock/lookup/write
pattern lives in exactly one place.

## Code breakdown

### Package declaration and imports

`memory.go` belongs to the same `job` package as the `Store` interface it
implements, so it needs no import of its own types. It pulls in only `sync` for the
mutex that makes the store safe for concurrent use, `time` for the `RunAt`
comparison and `UpdatedAt` stamps, and `sort` for the newest-first ordering the
listing owes its callers.

### The MemoryStore type and constructor

```go
// MemoryStore is an in-memory Store, used in tests. It is safe for concurrent
// use and mirrors the SQLite store's claim semantics.
type MemoryStore struct {
	mu   sync.Mutex
	jobs map[string]Job
}

// NewMemoryStore returns an empty in-memory job store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{jobs: make(map[string]Job)}
}
```

`MemoryStore` is just a map from job id to `Job`, protected by a single
`sync.Mutex`. A plain mutex (not an `RWMutex`) is the right choice here because the
defining operation, `ClaimDue`, both reads and writes, so there is little pure-read
traffic to optimize for. The doc comment states the contract that gives the type
its value: it is safe for concurrent use and mirrors the SQLite store's claim
semantics. `NewMemoryStore` returns one with the map initialized and ready.

### Enqueue

```go
func (s *MemoryStore) Enqueue(j Job) (Job, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.jobs[j.ID] = j
	return j, nil
}
```

`Enqueue` stores the fully-formed job the `Queue` built (the queue, not the store,
assigns the id, status, and timestamps) under the lock and hands it straight back.
It never fails — an in-memory map insert has nothing to error on — so the error
return exists solely to satisfy the `Store` interface, whose SQLite implementation
genuinely can fail.

### ClaimDue

```go
// ClaimDue picks the earliest-due queued job, marks it running, and increments
// its attempts — the same atomic step the SQLite store performs in a transaction.
func (s *MemoryStore) ClaimDue(now time.Time) (Job, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var pick *Job
	for id := range s.jobs {
		j := s.jobs[id]
		if j.Status != StatusQueued || j.RunAt.After(now) {
			continue
		}
		if pick == nil || j.RunAt.Before(pick.RunAt) {
			c := j
			pick = &c
		}
	}
	if pick == nil {
		return Job{}, false, nil
	}
	pick.Status = StatusRunning
	pick.Attempts++
	pick.UpdatedAt = now
	s.jobs[pick.ID] = *pick
	return *pick, true, nil
}
```

`ClaimDue` is the heart of the store and the one method whose semantics must match
SQLite exactly. Holding the mutex for the entire select-then-mark makes the whole
operation atomic — the in-memory analogue of the SQLite store's transaction — so
two concurrent workers can never claim the same job. It scans every job for one
that is both `StatusQueued` and due (`RunAt` at or before `now`), keeping the
earliest-due candidate; iterating a map is unordered, so the explicit
earliest-`RunAt` comparison is what imposes the FIFO-by-due-time behavior rather
than relying on scan order. Note the copy taken via `c := j` before pointing at it:
`pick` refers to a local copy, never to the map's value, so the map is mutated only
by the deliberate write-back at the end. If nothing is due it returns `false` with
no error; otherwise it flips the picked job to running, increments its attempts —
the increment the pool later reads to decide retry-versus-fail — stamps
`UpdatedAt`, writes it back, and returns it.

### Complete, Retry, and Fail

```go
func (s *MemoryStore) Complete(id string) error {
	return s.update(id, func(j *Job) { j.Status = StatusDone })
}

func (s *MemoryStore) Retry(id, lastErr string, runAt time.Time) error {
	return s.update(id, func(j *Job) {
		j.Status = StatusQueued
		j.LastError = lastErr
		j.RunAt = runAt
	})
}

func (s *MemoryStore) Fail(id, lastErr string) error {
	return s.update(id, func(j *Job) {
		j.Status = StatusFailed
		j.LastError = lastErr
	})
}
```

These three record a run's outcome, and each is expressed as a single mutation
passed to the shared `update` helper. `Complete` simply moves the job to
`StatusDone`. `Retry` returns it to `StatusQueued`, records the error that caused
the retry, and sets the new `RunAt` the pool computed from its backoff — putting the
job back in contention for a future `ClaimDue`. `Fail` moves it to the terminal
`StatusFailed` and records the final error. Writing them as tiny closures keeps
each method to just the fields it changes, with all the locking and lookup handled
once in `update`.

### JobByID

```go
func (s *MemoryStore) JobByID(id string) (Job, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	j, ok := s.jobs[id]
	if !ok {
		return Job{}, ErrNotFound
	}
	return j, nil
}
```

`JobByID` is the read path — the same lookup the HTTP job-status endpoint depends
on. Under the lock it fetches the job and, on a miss, returns the package sentinel
`ErrNotFound` so callers can distinguish an unknown id from a real failure with
`errors.Is`. It returns the job by value, so the caller gets a snapshot and cannot
mutate the store's copy through the returned struct.

### JobsByStatus and JobCounts

The observability pair, mirroring the SQLite store's SQL in Go. `JobsByStatus`
walks the map under the lock, keeping jobs whose status matches (an empty status
matches everything), sorts them newest-first by `CreatedAt` with the id breaking
ties — a map walk has no order of its own, so without an explicit tiebreak two
jobs created in the same instant could swap places between calls — and then
truncates to `ClampJobsPage(limit)`, the shared bound both stores apply.
`JobCounts` is a single tally pass returning `map[Status]int`; a status with no
jobs is simply absent, matching what `GROUP BY status` yields in SQL. Keeping both
faithful to the SQLite versions is what lets handler tests run against this store
and still say something true about production.

### ReapStale

```go
// ReapStale requeues running jobs last touched before the given time, keeping
// their attempt count — the same recovery the SQLite store performs.
func (s *MemoryStore) ReapStale(before time.Time) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	n := 0
	for id, j := range s.jobs {
		if j.Status == StatusRunning && j.UpdatedAt.Before(before) {
			j.Status = StatusQueued
			j.RunAt = before
			j.UpdatedAt = before
			s.jobs[id] = j
			n++
		}
	}
	return n, nil
}
```

`ReapStale` is the in-memory crash-recovery sweep that mirrors the SQLite store:
under the lock it scans for jobs still `StatusRunning` whose `UpdatedAt` predates the
cutoff, returns each to `StatusQueued` due immediately (`RunAt` set to `before`),
and counts them. It leaves `Attempts` untouched, so a job that keeps orphaning its
worker still eventually exhausts its limit rather than looping forever.

### The update helper

```go
func (s *MemoryStore) update(id string, fn func(*Job)) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	j, ok := s.jobs[id]
	if !ok {
		return ErrNotFound
	}
	fn(&j)
	s.jobs[id] = j
	return nil
}
```

`update` factors out the read-modify-write pattern shared by `Complete`, `Retry`,
and `Fail`. It takes the lock, looks the job up (returning `ErrNotFound` if it is
gone), applies the caller's mutation function to a local copy, and writes the copy
back into the map. Centralizing the locking and the existence check here means each
outcome method only has to describe *what* changes, and the concurrency-sensitive
mechanics are guaranteed identical across all three.
