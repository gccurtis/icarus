// Package contexts owns project-scoped "context" resources: named, nestable sets
// of resource references that resolve down to the concrete leaf resources they
// represent. A context is a definition value ({includes, excludes}); the same
// value resolves whether it is stored (named) or anonymous (built per refresh and
// never persisted). The store is deliberately dumb — it only holds the refs the
// user typed. Resolution (see resolve.go) is always computed live.
package contexts

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"
)

const maxName = 200

// KindContext is the resource kind of a context, both as a member's kind (a
// member of this kind nests another context) and as the wire kind a document
// variable binds to. KindConnector is the resource kind of a connector member
// — contexts refers to it by this string alone and never imports the
// connector capability. WholeProjectID is the reserved virtual context id
// that resolves to every leaf resource in the project.
const (
	KindContext    = "context"
	KindConnector  = "connector"
	WholeProjectID = "whole-project"
)

var (
	ErrNotFound      = errors.New("context not found")
	ErrInvalidName   = errors.New("context name must not be empty")
	ErrUnknownMember = errors.New("context member does not exist")
	ErrCycle         = errors.New("context membership would create a cycle")
)

// Ref names a resource by its catalog identity. Name is an optional display
// label only — resolution uses Kind+ID and never trusts Name, which may go stale.
type Ref struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
	Name string `json:"name,omitempty"`
}

// Definition is a context value: the sets built up (Includes) and removed
// (Excludes). Stored contexts persist a definition plus a name; anonymous
// contexts are a bare definition passed straight to Resolve.
type Definition struct {
	Includes []Ref
	Excludes []Ref
}

// Context is a stored, named definition, project-scoped.
type Context struct {
	ID        string
	ProjectID string
	Name      string
	CreatorID string
	Includes  []Ref
	Excludes  []Ref
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Definition projects the stored membership as a resolvable value.
func (c Context) Definition() Definition {
	return Definition{Includes: c.Includes, Excludes: c.Excludes}
}

// Actor is trusted request identity.
type Actor struct {
	ID   string
	Name string
}

// Store persists context records within a project.
type Store interface {
	InsertContext(c Context) error
	ContextByID(projectID, id string) (Context, error)
	ContextSummaries(projectID string) ([]Context, error)
	UpdateContext(c Context) error
	DeleteContext(projectID, id string) error
}

// Contexts is the context service over an injected Store.
type Contexts struct {
	store          Store
	catalog        Catalog
	connectorFiles ConnectorFiles
	now            func() time.Time
}

// New constructs the service.
func New(store Store) *Contexts { return &Contexts{store: store, now: time.Now} }

// Create makes a new context with the given membership.
func (c *Contexts) Create(projectID string, a Actor, name string, includes, excludes []Ref) (Context, error) {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > maxName {
		return Context{}, ErrInvalidName
	}
	inc, exc := normalizeRefs(includes), normalizeRefs(excludes)
	if err := c.validateMembersExist(projectID, inc, exc); err != nil {
		return Context{}, err
	}
	id := newID()
	if cyclic, err := c.wouldCycle(projectID, id, inc, exc); err != nil {
		return Context{}, err
	} else if cyclic {
		return Context{}, ErrCycle
	}
	at := c.clock()
	rec := Context{
		ID: id, ProjectID: projectID, Name: name, CreatorID: a.ID,
		Includes: inc, Excludes: exc,
		CreatedAt: at, UpdatedAt: at,
	}
	if err := c.store.InsertContext(rec); err != nil {
		return Context{}, err
	}
	return rec, nil
}

// Get returns one context scoped to its project.
func (c *Contexts) Get(projectID, id string) (Context, error) {
	return c.store.ContextByID(projectID, id)
}

// List returns a project's contexts (unordered).
func (c *Contexts) List(projectID string) ([]Context, error) {
	return c.store.ContextSummaries(projectID)
}

// Update replaces a context's name and membership (set-style).
func (c *Contexts) Update(projectID, id, name string, includes, excludes []Ref) (Context, error) {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > maxName {
		return Context{}, ErrInvalidName
	}
	rec, err := c.store.ContextByID(projectID, id)
	if err != nil {
		return Context{}, err
	}
	inc, exc := normalizeRefs(includes), normalizeRefs(excludes)
	if err := c.validateMembersExist(projectID, inc, exc); err != nil {
		return Context{}, err
	}
	if cyclic, err := c.wouldCycle(projectID, id, inc, exc); err != nil {
		return Context{}, err
	} else if cyclic {
		return Context{}, ErrCycle
	}
	rec.Name = name
	rec.Includes = inc
	rec.Excludes = exc
	rec.UpdatedAt = c.clock()
	if err := c.store.UpdateContext(rec); err != nil {
		return Context{}, err
	}
	return rec, nil
}

// Delete removes a context.
func (c *Contexts) Delete(projectID, id string) error { return c.store.DeleteContext(projectID, id) }

// validateMembersExist checks every include/exclude member references something
// real: a context-kind member (other than whole-project) must be a stored
// context; any other kind must exist in the catalog when one is wired.
func (c *Contexts) validateMembersExist(projectID string, refs ...[]Ref) error {
	for _, list := range refs {
		for _, r := range list {
			if r.Kind == KindContext {
				if r.ID == WholeProjectID {
					continue
				}
				if _, err := c.store.ContextByID(projectID, r.ID); err != nil {
					if errors.Is(err, ErrNotFound) {
						return ErrUnknownMember
					}
					return err
				}
				continue
			}
			if c.catalog == nil {
				continue
			}
			ok, err := c.catalog.Exists(projectID, r.Kind, r.ID)
			if err != nil {
				return err
			}
			if !ok {
				return ErrUnknownMember
			}
		}
	}
	return nil
}

// wouldCycle reports whether giving context selfID the given membership would
// create a cycle: true iff any context-kind member (other than whole-project)
// can already reach selfID through the stored context graph. The stored graph is
// kept acyclic by this very check, so the walk terminates; a visited set guards
// against corrupt data.
func (c *Contexts) wouldCycle(projectID, selfID string, members ...[]Ref) (bool, error) {
	visited := map[string]bool{}
	var reaches func(id string) (bool, error)
	reaches = func(id string) (bool, error) {
		if id == selfID {
			return true, nil
		}
		if visited[id] {
			return false, nil
		}
		visited[id] = true
		row, err := c.store.ContextByID(projectID, id)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				return false, nil
			}
			return false, err
		}
		for _, list := range [][]Ref{row.Includes, row.Excludes} {
			for _, r := range list {
				if r.Kind != KindContext || r.ID == WholeProjectID {
					continue
				}
				ok, err := reaches(r.ID)
				if err != nil {
					return false, err
				}
				if ok {
					return true, nil
				}
			}
		}
		return false, nil
	}
	for _, list := range members {
		for _, r := range list {
			if r.Kind != KindContext || r.ID == WholeProjectID {
				continue
			}
			ok, err := reaches(r.ID)
			if err != nil {
				return false, err
			}
			if ok {
				return true, nil
			}
		}
	}
	return false, nil
}

// normalizeRefs trims each ref and drops any with a blank kind or id.
func normalizeRefs(refs []Ref) []Ref {
	var out []Ref
	for _, r := range refs {
		r.Kind = strings.TrimSpace(r.Kind)
		r.ID = strings.TrimSpace(r.ID)
		r.Name = strings.TrimSpace(r.Name)
		if r.Kind == "" || r.ID == "" {
			continue
		}
		out = append(out, r)
	}
	return out
}

func (c *Contexts) clock() time.Time {
	if c.now == nil {
		return time.Now().UTC()
	}
	return c.now().UTC()
}

func newID() string {
	buf := make([]byte, 16)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}
