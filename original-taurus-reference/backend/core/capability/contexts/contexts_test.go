package contexts_test

import (
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/contexts"
)

// memStore is an in-memory contexts.Store for deterministic plumbing tests.
// (A fake STORE is fine — this is not intelligence; only the model may not be stubbed.)
type memStore struct{ rows map[string]contexts.Context }

func newMem() *memStore { return &memStore{rows: map[string]contexts.Context{}} }

func key(p, id string) string { return p + "|" + id }

func (m *memStore) InsertContext(c contexts.Context) error {
	m.rows[key(c.ProjectID, c.ID)] = c
	return nil
}
func (m *memStore) ContextByID(p, id string) (contexts.Context, error) {
	c, ok := m.rows[key(p, id)]
	if !ok {
		return contexts.Context{}, contexts.ErrNotFound
	}
	return c, nil
}
func (m *memStore) ContextSummaries(p string) ([]contexts.Context, error) {
	var out []contexts.Context
	for _, c := range m.rows {
		if c.ProjectID == p {
			out = append(out, c)
		}
	}
	return out, nil
}
func (m *memStore) UpdateContext(c contexts.Context) error {
	if _, ok := m.rows[key(c.ProjectID, c.ID)]; !ok {
		return contexts.ErrNotFound
	}
	m.rows[key(c.ProjectID, c.ID)] = c
	return nil
}
func (m *memStore) DeleteContext(p, id string) error {
	if _, ok := m.rows[key(p, id)]; !ok {
		return contexts.ErrNotFound
	}
	delete(m.rows, key(p, id))
	return nil
}

func TestCreateGetListUpdateDelete(t *testing.T) {
	svc := contexts.New(newMem())
	inc := []contexts.Ref{{Kind: "document", ID: "d1", Name: "Doc 1"}}
	c, err := svc.Create("p", contexts.Actor{ID: "u1", Name: "U"}, "Design docs", inc, nil)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if c.ID == "" || c.Name != "Design docs" || len(c.Includes) != 1 || c.CreatorID != "u1" {
		t.Fatalf("unexpected created context: %+v", c)
	}

	got, err := svc.Get("p", c.ID)
	if err != nil || got.ID != c.ID {
		t.Fatalf("get: %v %+v", err, got)
	}

	list, err := svc.List("p")
	if err != nil || len(list) != 1 {
		t.Fatalf("list: %v %d", err, len(list))
	}

	upd, err := svc.Update("p", c.ID, "Design", nil, []contexts.Ref{{Kind: "document", ID: "d2"}})
	if err != nil || upd.Name != "Design" || len(upd.Includes) != 0 || len(upd.Excludes) != 1 {
		t.Fatalf("update: %v %+v", err, upd)
	}

	if err := svc.Delete("p", c.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := svc.Get("p", c.ID); err != contexts.ErrNotFound {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}

func TestCreateRejectsBlankName(t *testing.T) {
	svc := contexts.New(newMem())
	if _, err := svc.Create("p", contexts.Actor{ID: "u1"}, "  ", nil, nil); err != contexts.ErrInvalidName {
		t.Fatalf("want ErrInvalidName, got %v", err)
	}
}

// existCatalog reports existence for a fixed leaf set; unknown → false.
type existCatalog struct{ have map[string]bool } // key = kind+"|"+id

func (e existCatalog) AllResources(string) ([]contexts.Ref, error) { return nil, nil }
func (e existCatalog) Exists(_ string, kind, id string) (bool, error) {
	return e.have[kind+"|"+id], nil
}

func TestCreateRejectsUnknownMember(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	svc.UseCatalog(existCatalog{have: map[string]bool{"document|d1": true}})
	// d1 exists, d2 does not.
	if _, err := svc.Create("p", contexts.Actor{ID: "u"}, "C",
		[]contexts.Ref{{Kind: "document", ID: "d2"}}, nil); err != contexts.ErrUnknownMember {
		t.Fatalf("want ErrUnknownMember for missing d2, got %v", err)
	}
	if _, err := svc.Create("p", contexts.Actor{ID: "u"}, "C",
		[]contexts.Ref{{Kind: "document", ID: "d1"}}, nil); err != nil {
		t.Fatalf("d1 exists, want nil, got %v", err)
	}
}

func TestCreateAllowsWholeProjectMemberWithoutExistenceCheck(t *testing.T) {
	svc := contexts.New(newMem())
	svc.UseCatalog(existCatalog{have: map[string]bool{}})
	if _, err := svc.Create("p", contexts.Actor{ID: "u"}, "C",
		[]contexts.Ref{{Kind: contexts.KindContext, ID: contexts.WholeProjectID}}, nil); err != nil {
		t.Fatalf("whole-project must be a valid member, got %v", err)
	}
}

func TestContextMemberMustExistEvenWithoutCatalog(t *testing.T) {
	m := newMem()
	svc := contexts.New(m) // no catalog
	// A context-kind member that isn't stored is unknown, regardless of catalog.
	if _, err := svc.Create("p", contexts.Actor{ID: "u"}, "C",
		[]contexts.Ref{{Kind: contexts.KindContext, ID: "missing"}}, nil); err != contexts.ErrUnknownMember {
		t.Fatalf("want ErrUnknownMember for missing context member, got %v", err)
	}
}

func TestNonContextMemberSkippedWhenNoCatalog(t *testing.T) {
	svc := contexts.New(newMem()) // no catalog
	if _, err := svc.Create("p", contexts.Actor{ID: "u"}, "C",
		[]contexts.Ref{{Kind: "document", ID: "whatever"}}, nil); err != nil {
		t.Fatalf("non-context member must be permitted when no catalog, got %v", err)
	}
}

func TestUpdateRejectsCycle(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	a, _ := svc.Create("p", contexts.Actor{ID: "u"}, "A", nil, nil)
	// B includes A (A exists — valid).
	b, err := svc.Create("p", contexts.Actor{ID: "u"}, "B",
		[]contexts.Ref{{Kind: contexts.KindContext, ID: a.ID}}, nil)
	if err != nil {
		t.Fatalf("create B: %v", err)
	}
	// Updating A to include B closes the loop A→B→A.
	if _, err := svc.Update("p", a.ID, "A",
		[]contexts.Ref{{Kind: contexts.KindContext, ID: b.ID}}, nil); err != contexts.ErrCycle {
		t.Fatalf("want ErrCycle, got %v", err)
	}
}

func TestUpdateRejectsSelfReference(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	a, _ := svc.Create("p", contexts.Actor{ID: "u"}, "A", nil, nil)
	if _, err := svc.Update("p", a.ID, "A",
		[]contexts.Ref{{Kind: contexts.KindContext, ID: a.ID}}, nil); err != contexts.ErrCycle {
		t.Fatalf("want ErrCycle for self-reference, got %v", err)
	}
}

func TestCycleCheckAllowsDiamond(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	d, _ := svc.Create("p", contexts.Actor{ID: "u"}, "D", nil, nil)
	b, _ := svc.Create("p", contexts.Actor{ID: "u"}, "B", []contexts.Ref{{Kind: contexts.KindContext, ID: d.ID}}, nil)
	cc, _ := svc.Create("p", contexts.Actor{ID: "u"}, "C", []contexts.Ref{{Kind: contexts.KindContext, ID: d.ID}}, nil)
	// A includes both B and C (both reach D) — a diamond, NOT a cycle.
	if _, err := svc.Create("p", contexts.Actor{ID: "u"}, "A",
		[]contexts.Ref{{Kind: contexts.KindContext, ID: b.ID}, {Kind: contexts.KindContext, ID: cc.ID}}, nil); err != nil {
		t.Fatalf("diamond must be allowed, got %v", err)
	}
}
