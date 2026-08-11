# cell.go

`cell.go` defines the **cell** — the per-(user, project) runtime scope that the
rest of the application's endpoints operate within — and the registry that holds
the live cells. A cell is what selecting a project produces: once a session has a
user and a chosen project, there is exactly one cell for that pairing, and it is
the object project-scoped services and state will hang off as the core grows.

The defining design choice here is that a cell is **not persisted**. It is a live,
in-memory object rebuilt on demand from a session's durable user and project.
This means a restart loses nothing that matters — the session is the durable
record, and the cell is simply recreated the next time the project is used. The
`CellRegistry` is the small piece of concurrency-safe machinery that makes "one
cell per selection, shared across requests" true: it hands back the existing cell
for a pairing or creates one on first use.

The registry is deliberately minimal — a guarded map keyed by user and project,
with an injectable clock. It carries no domain logic itself; the `Access` service
drives it (ensuring a cell on project selection, discarding one on logout).

## Code breakdown

### Package declaration and imports

```go
package access

import (
	"sync"
	"time"
)
```

The file is part of the `access` package. It imports only `sync`, for the mutex
that guards the registry's map, and `time`, for the cell's creation timestamp and
the injectable clock.

### The Cell type

```go
// Cell is the per-(user, project) runtime scope that the rest of the
// application's endpoints operate within. It is what a project selection
// produces, and it is where project-scoped services and state will hang as the
// core grows.
//
// A cell is not persisted: it is a live object rebuilt on demand from a
// session's user and project, so it survives a restart implicitly (the session
// is durable; the cell is recreated the next time the project is used).
type Cell struct {
	UserID    string
	ProjectID string
	CreatedAt time.Time
}
```

`Cell` is the runtime scope for one (user, project) pairing. Today it holds only
the identifying `UserID` and `ProjectID` and a `CreatedAt` timestamp, but the
comment names its intended role: the anchor point for project-scoped services and
state as the core grows. The emphasis on it not being persisted is the key
property — it is a transient projection of durable session data, so it can always
be rebuilt rather than stored.

### The CellRegistry type

```go
// CellRegistry holds the live cells, keyed by user and project, so repeated use
// of the same selection shares one cell. It is safe for concurrent use.
type CellRegistry struct {
	mu    sync.Mutex
	cells map[string]*Cell
	now   func() time.Time
}
```

`CellRegistry` is the concurrency-safe home for the live cells. The `mu` mutex
guards the `cells` map so the registry is safe to use from many requests at once,
and the map keyed by (user, project) is what guarantees repeated use of the same
selection shares a single cell rather than creating a new one each time. `now` is
an injectable clock — `time.Now` in production — that keeps creation timestamps
testable.

### Constructing a registry

```go
// NewCellRegistry returns an empty registry.
func NewCellRegistry() *CellRegistry {
	return &CellRegistry{cells: make(map[string]*Cell), now: time.Now}
}
```

`NewCellRegistry` builds an empty registry with an initialized map and the real
clock wired in. It is the entry point the composition layer uses to create the one
registry the `Access` service shares.

### Ensuring a cell exists

```go
// Ensure returns the cell for (userID, projectID), creating it if it does not
// yet exist.
func (r *CellRegistry) Ensure(userID, projectID string) *Cell {
	r.mu.Lock()
	defer r.mu.Unlock()

	key := userID + "\x00" + projectID
	c := r.cells[key]
	if c == nil {
		c = &Cell{UserID: userID, ProjectID: projectID, CreatedAt: r.now().UTC()}
		r.cells[key] = c
	}
	return c
}
```

`Ensure` is the get-or-create operation, and the heart of the registry. Under the
lock it composes a map key from the user and project IDs joined by a NUL byte —
a separator that cannot appear in the IDs, so distinct pairings never collide —
and returns the existing cell for that key. If none exists yet it creates one,
stamped with the current UTC time, stores it, and returns it. The result is
idempotent: the first call for a pairing creates the cell, every later call for
the same pairing returns that same cell. It is called both when a project is
selected and when a session is resolved into a request context.

### Discarding a cell

```go
// Discard drops the cell for (userID, projectID), e.g. when a user logs out.
func (r *CellRegistry) Discard(userID, projectID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.cells, userID+"\x00"+projectID)
}
```

`Discard` removes a pairing's cell from the registry, using the same NUL-joined
key. It is the counterpart to `Ensure`, called on logout so a signed-out user's
runtime scope is released. Because the cell is not persisted, dropping it is
harmless — a later selection simply rebuilds it.
