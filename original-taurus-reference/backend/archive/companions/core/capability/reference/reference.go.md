# reference.go

The reference capability: the project-scoped graph of directed references between resources — a document's outgoing links and the backlinks that answer "what points here?". Edges are stored by id and kind; display names resolve at read time through an injected Resolver, so this capability imports neither document nor resource. See repo conventions (AGENTS.md).

## Code breakdown

```go
// Package reference maintains the project-scoped graph of directed references
// between resources — today the inline links a document points at, and the
// backlinks that answer "what points at this?". It stores edges by id and kind
// and resolves current display names at read time through an injected Resolver,
// so it imports neither the document nor the resource capability.
package reference

import (
	"errors"
	"sort"
	"strings"
	"sync"
	"time"
)

// Scope is trusted application context set after access selects a Project.
type Scope struct{ ProjectID string }

// Edge kinds and the resource kinds referenced today.
const (
	KindDocument = "document"
	EdgeLink     = "link" // an inline hyperlink; mention/embed await a mention atom
)

var ErrInvalidScope = errors.New("reference: Project scope is required")

// Ref identifies one resource endpoint of an edge; Name is resolved at read.
type Ref struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
	Name string `json:"name,omitempty"`
}

// Edge is one directed reference from one resource to another.
type Edge struct {
	From   Ref    `json:"fromResource"`
	To     Ref    `json:"toResource"`
	Kind   string `json:"kind"`
	Anchor string `json:"anchor,omitempty"`
}

// LinkRef is one raw outgoing link a document emits: an href plus an optional
// content anchor. The service resolves the href to an in-project resource.
type LinkRef struct {
	Href   string
	Anchor string
}

// StoredEdge is the persisted edge — ids and kinds only, names resolved on read.
type StoredEdge struct {
	FromKind, FromID string
	ToKind, ToID     string
	Kind             string
	Anchor           string
	UpdatedAt        time.Time
}

// Resolver maps a link href to an in-project resource and resolves current
// names. The composition root supplies it over the resource/document catalog.
type Resolver interface {
	Resolve(projectID, href string) (kind, id, name string, ok bool)
	Name(projectID, kind, id string) (string, bool)
}

// Store persists directed edges, keyed by project and by each endpoint.
type Store interface {
	ReplaceOutgoing(projectID, fromKind, fromID string, edges []StoredEdge) error
	Outgoing(projectID, kind, id string) ([]StoredEdge, error)
	Incoming(projectID, kind, id string) ([]StoredEdge, error)
}

// References is the reference-graph service.
type References struct {
	store    Store
	resolver Resolver
	now      func() time.Time
}

// New constructs the service.
func New(store Store, resolver Resolver) (*References, error) {
	if store == nil || resolver == nil {
		return nil, errors.New("reference: store and resolver are required")
	}
	return &References{store: store, resolver: resolver, now: time.Now}, nil
}

// ReindexDocument replaces a document's outgoing edges from its current links.
// Hrefs that do not resolve to an in-project resource (external URLs, dangling
// links) and self-links are dropped.
func (r *References) ReindexDocument(scope Scope, documentID string, links []LinkRef) error {
	if strings.TrimSpace(scope.ProjectID) == "" {
		return ErrInvalidScope
	}
	now := r.now().UTC()
	seen := map[string]bool{}
	var edges []StoredEdge
	for _, link := range links {
		kind, id, _, ok := r.resolver.Resolve(scope.ProjectID, link.Href)
		if !ok || (kind == KindDocument && id == documentID) {
			continue
		}
		key := kind + "\x00" + id + "\x00" + link.Anchor
		if seen[key] {
			continue
		}
		seen[key] = true
		edges = append(edges, StoredEdge{
			FromKind: KindDocument, FromID: documentID,
			ToKind: kind, ToID: id, Kind: EdgeLink, Anchor: link.Anchor, UpdatedAt: now,
		})
	}
	return r.store.ReplaceOutgoing(scope.ProjectID, KindDocument, documentID, edges)
}

// References returns the resource's outgoing edges with resolved current names.
func (r *References) References(scope Scope, kind, id string) ([]Edge, error) {
	if strings.TrimSpace(scope.ProjectID) == "" {
		return nil, ErrInvalidScope
	}
	stored, err := r.store.Outgoing(scope.ProjectID, kind, id)
	if err != nil {
		return nil, err
	}
	return r.resolveNames(scope.ProjectID, stored), nil
}

// Backlinks returns the resource's incoming edges with resolved current names.
func (r *References) Backlinks(scope Scope, kind, id string) ([]Edge, error) {
	if strings.TrimSpace(scope.ProjectID) == "" {
		return nil, ErrInvalidScope
	}
	stored, err := r.store.Incoming(scope.ProjectID, kind, id)
	if err != nil {
		return nil, err
	}
	return r.resolveNames(scope.ProjectID, stored), nil
}

func (r *References) resolveNames(projectID string, stored []StoredEdge) []Edge {
	edges := make([]Edge, 0, len(stored))
	for _, s := range stored {
		from := Ref{Kind: s.FromKind, ID: s.FromID}
		if name, ok := r.resolver.Name(projectID, s.FromKind, s.FromID); ok {
			from.Name = name
		}
		to := Ref{Kind: s.ToKind, ID: s.ToID}
		if name, ok := r.resolver.Name(projectID, s.ToKind, s.ToID); ok {
			to.Name = name
		}
		edges = append(edges, Edge{From: from, To: to, Kind: s.Kind, Anchor: s.Anchor})
	}
	sort.Slice(edges, func(i, j int) bool {
		if edges[i].From.ID != edges[j].From.ID {
			return edges[i].From.ID < edges[j].From.ID
		}
		return edges[i].To.ID < edges[j].To.ID
	})
	return edges
}

// MemoryStore is an in-memory Store for unit tests.
type MemoryStore struct {
	mu    sync.Mutex
	edges map[string][]StoredEdge // keyed by projectID
}

// NewMemoryStore returns an empty in-memory Store.
func NewMemoryStore() *MemoryStore { return &MemoryStore{edges: map[string][]StoredEdge{}} }

func (s *MemoryStore) ReplaceOutgoing(projectID, fromKind, fromID string, edges []StoredEdge) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	kept := s.edges[projectID][:0:0]
	for _, e := range s.edges[projectID] {
		if e.FromKind == fromKind && e.FromID == fromID {
			continue
		}
		kept = append(kept, e)
	}
	s.edges[projectID] = append(kept, edges...)
	return nil
}

func (s *MemoryStore) Outgoing(projectID, kind, id string) ([]StoredEdge, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []StoredEdge
	for _, e := range s.edges[projectID] {
		if e.FromKind == kind && e.FromID == id {
			out = append(out, e)
		}
	}
	return out, nil
}

func (s *MemoryStore) Incoming(projectID, kind, id string) ([]StoredEdge, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []StoredEdge
	for _, e := range s.edges[projectID] {
		if e.ToKind == kind && e.ToID == id {
			out = append(out, e)
		}
	}
	return out, nil
}
```
