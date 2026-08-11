package name_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/capability/formula"
	"github.com/gccurtis/taurus-omega/core/capability/formula/names"
	"github.com/gccurtis/taurus-omega/core/endpoint"
	namehandler "github.com/gccurtis/taurus-omega/core/handlers/name"
)

// fixture wires an access.Access and a names.Manager over in-memory stores,
// with an owner and a read-only member of one project — enough to exercise
// every authorization branch the handlers gate on.
type fixture struct {
	handlers  namehandler.Handlers
	owner     access.Context
	reader    access.Context
	stranger  access.Context
	projectID string
}

func newFixture(t *testing.T) fixture {
	t.Helper()
	store := access.NewMemoryStore()
	a := access.New(access.Stores{Users: store, Sessions: store, Projects: store, Memberships: store}, access.Options{})

	owner, err := a.Register("owner@b.com", "password123", "")
	if err != nil {
		t.Fatalf("register owner: %v", err)
	}
	reader, err := a.Register("reader@b.com", "password123", "")
	if err != nil {
		t.Fatalf("register reader: %v", err)
	}
	stranger, err := a.Register("stranger@b.com", "password123", "")
	if err != nil {
		t.Fatalf("register stranger: %v", err)
	}
	p, err := a.CreateProject(owner.ID, "Alpha")
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	if _, err := a.AddProjectMember(owner.ID, p.ID, "reader@b.com", access.RoleRead); err != nil {
		t.Fatalf("add reader: %v", err)
	}

	m := names.New(names.NewMemoryStore(), formula.NewService())
	h := namehandler.NewHandlers(a, m)

	return fixture{
		handlers:  h,
		owner:     access.Context{User: owner},
		reader:    access.Context{User: reader},
		stranger:  access.Context{User: stranger},
		projectID: p.ID,
	}
}

// req builds an endpoint.Request whose Bind decodes body (nil for no body) and
// whose Param answers "projectID" and "name" from the fixture and the given
// entry name.
func (f fixture) req(t *testing.T, name string, body any) endpoint.Request {
	t.Helper()
	var raw []byte
	if body != nil {
		var err error
		raw, err = json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal request body: %v", err)
		}
	}
	return endpoint.Request{
		Bind: func(v any) error {
			if raw == nil {
				return nil
			}
			return json.Unmarshal(raw, v)
		},
		Param: func(p string) string {
			switch p {
			case "projectID":
				return f.projectID
			case "name":
				return name
			default:
				return ""
			}
		},
	}
}

func TestListGetDeleteRoundTrip(t *testing.T) {
	f := newFixture(t)

	// A stranger (non-member) cannot even read.
	resp := f.handlers.List(f.stranger, f.req(t, "", nil))
	if resp.Status != http.StatusForbidden {
		t.Fatalf("stranger List status = %d, want 403", resp.Status)
	}

	// Owner sets a scalar.
	price, err := formula.NumberValue("42")
	if err != nil {
		t.Fatal(err)
	}
	resp = f.handlers.SetValue(f.owner, f.req(t, "price", price))
	if resp.Status != http.StatusOK {
		t.Fatalf("owner SetValue status = %d, body %+v", resp.Status, resp.Body)
	}

	// A read-only member cannot write.
	other, err := formula.NumberValue("1")
	if err != nil {
		t.Fatal(err)
	}
	resp = f.handlers.SetValue(f.reader, f.req(t, "price", other))
	if resp.Status != http.StatusForbidden {
		t.Fatalf("reader SetValue status = %d, want 403", resp.Status)
	}

	// A read-only member can still read.
	resp = f.handlers.Get(f.reader, f.req(t, "price", nil))
	if resp.Status != http.StatusOK {
		t.Fatalf("reader Get status = %d", resp.Status)
	}

	// A missing name is 404.
	resp = f.handlers.Get(f.owner, f.req(t, "no-such-name", nil))
	if resp.Status != http.StatusNotFound {
		t.Fatalf("Get missing status = %d, want 404", resp.Status)
	}

	// List includes the one entry. resp.Body carries a concrete []entryView
	// (unexported outside the package), so round-trip it through JSON to
	// inspect its shape generically, the way an actual HTTP client would see it.
	resp = f.handlers.List(f.owner, f.req(t, "", nil))
	if resp.Status != http.StatusOK {
		t.Fatalf("List status = %d", resp.Status)
	}
	raw, err := json.Marshal(resp.Body)
	if err != nil {
		t.Fatalf("marshal List body: %v", err)
	}
	var decoded struct {
		Names []map[string]any `json:"names"`
	}
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("unmarshal List body: %v", err)
	}
	if len(decoded.Names) != 1 || decoded.Names[0]["name"] != "price" {
		t.Fatalf("List names = %#v, want 1 entry named price", decoded.Names)
	}

	// Reader cannot delete; owner can.
	resp = f.handlers.Delete(f.reader, f.req(t, "price", nil))
	if resp.Status != http.StatusForbidden {
		t.Fatalf("reader Delete status = %d, want 403", resp.Status)
	}
	resp = f.handlers.Delete(f.owner, f.req(t, "price", nil))
	if resp.Status != http.StatusOK {
		t.Fatalf("owner Delete status = %d", resp.Status)
	}
	resp = f.handlers.Get(f.owner, f.req(t, "price", nil))
	if resp.Status != http.StatusNotFound {
		t.Fatalf("Get after delete status = %d, want 404", resp.Status)
	}
}

func TestSetTableAddColumnAppendRows(t *testing.T) {
	f := newFixture(t)

	type column struct {
		Name string `json:"name"`
		Type string `json:"type"`
	}
	label, err := formula.TextValue("widget")
	if err != nil {
		t.Fatal(err)
	}
	body := struct {
		Columns []column          `json:"columns"`
		Rows    [][]formula.Value `json:"rows"`
	}{
		Columns: []column{{Name: "label", Type: "text"}},
		Rows:    [][]formula.Value{{label}},
	}
	resp := f.handlers.SetTable(f.owner, f.req(t, "items", body))
	if resp.Status != http.StatusOK {
		t.Fatalf("SetTable status = %d, body %+v", resp.Status, resp.Body)
	}

	// AddColumn on the table succeeds.
	resp = f.handlers.AddColumn(f.owner, f.req(t, "items", column{Name: "qty", Type: "number"}))
	if resp.Status != http.StatusOK {
		t.Fatalf("AddColumn status = %d, body %+v", resp.Status, resp.Body)
	}

	// AppendRows appends a matching row (label, qty).
	qty, err := formula.NumberValue("3")
	if err != nil {
		t.Fatal(err)
	}
	rowsBody := struct {
		Rows [][]formula.Value `json:"rows"`
	}{Rows: [][]formula.Value{{label, qty}}}
	resp = f.handlers.AppendRows(f.owner, f.req(t, "items", rowsBody))
	if resp.Status != http.StatusOK {
		t.Fatalf("AppendRows status = %d, body %+v", resp.Status, resp.Body)
	}

	// AddColumn against a non-table name is a conflict.
	price, err := formula.NumberValue("1")
	if err != nil {
		t.Fatal(err)
	}
	f.handlers.SetValue(f.owner, f.req(t, "price", price))
	resp = f.handlers.AddColumn(f.owner, f.req(t, "price", column{Name: "x", Type: "number"}))
	if resp.Status != http.StatusConflict {
		t.Fatalf("AddColumn on scalar status = %d, want 409", resp.Status)
	}
}

func TestSetFunctionAndEvaluate(t *testing.T) {
	f := newFixture(t)

	// A valid function definition is stored.
	resp := f.handlers.SetFunction(f.owner, f.req(t, "double", struct {
		Source string `json:"source"`
	}{Source: "FUNCTION(x, x * 2)"}))
	if resp.Status != http.StatusOK {
		t.Fatalf("SetFunction status = %d, body %+v", resp.Status, resp.Body)
	}

	// Evaluate is a read operation: the read-only member may call it.
	resp = f.handlers.Evaluate(f.reader, f.req(t, "", struct {
		Source string `json:"source"`
	}{Source: "double(21)"}))
	if resp.Status != http.StatusOK {
		t.Fatalf("Evaluate status = %d, body %+v", resp.Status, resp.Body)
	}

	// Source that is not a function definition is a 400 validation error.
	resp = f.handlers.SetFunction(f.owner, f.req(t, "notafn", struct {
		Source string `json:"source"`
	}{Source: "1 + 1"}))
	if resp.Status != http.StatusBadRequest {
		t.Fatalf("SetFunction(not a function) status = %d, want 400", resp.Status)
	}

	// A parse failure surfaces as a structured FormulaError body.
	resp = f.handlers.Evaluate(f.owner, f.req(t, "", struct {
		Source string `json:"source"`
	}{Source: "1 +"}))
	if resp.Status != http.StatusBadRequest {
		t.Fatalf("Evaluate(parse error) status = %d, want 400", resp.Status)
	}
	body, ok := resp.Body.(map[string]any)
	if !ok {
		t.Fatalf("Evaluate error body = %#v, want map[string]any", resp.Body)
	}
	if _, ok := body["kind"]; !ok {
		t.Fatalf("Evaluate error body missing kind: %#v", body)
	}
}
