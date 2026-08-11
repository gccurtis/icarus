package access

import (
	"sync"
	"time"
)

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

// CellRegistry holds the live cells, keyed by user and project, so repeated use
// of the same selection shares one cell. It is safe for concurrent use.
type CellRegistry struct {
	mu    sync.Mutex
	cells map[string]*Cell
	now   func() time.Time
}

// NewCellRegistry returns an empty registry.
func NewCellRegistry() *CellRegistry {
	return &CellRegistry{cells: make(map[string]*Cell), now: time.Now}
}

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

// Discard drops the cell for (userID, projectID), e.g. when a user logs out.
func (r *CellRegistry) Discard(userID, projectID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.cells, userID+"\x00"+projectID)
}
