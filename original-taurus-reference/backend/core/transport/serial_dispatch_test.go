package transport

import (
	"net/http/httptest"
	"os"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

// serialCtx builds an echo.Context carrying a single path param, so a serial
// adapter can derive its key from the request the way a real route would.
func serialCtx(e *echo.Echo, paramName, paramValue string) echo.Context {
	req := httptest.NewRequest("POST", "/", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames(paramName)
	c.SetParamValues(paramValue)
	c.Set(ctxKey, access.Context{})
	return c
}

// TestDocumentWritesAreSerialByDocumentID pins the migration: the three
// document-write operations are dispatched in the serial execution mode, keyed
// by the documentID path param, so concurrent edits to one document within a
// process serialize while edits to different documents run in parallel.
func TestDocumentWritesAreSerialByDocumentID(t *testing.T) {
	writeOps := []string{"documents.append_changes", "documents.undo", "documents.redo"}
	for _, op := range writeOps {
		if operationMode[op] != dispatchSerial {
			t.Errorf("%s: execution mode = %d, want dispatchSerial (%d)", op, operationMode[op], dispatchSerial)
		}
		keyFn, ok := operationSerialKey[op]
		if !ok {
			t.Errorf("%s: no serial key function registered", op)
			continue
		}
		req := endpoint.Request{Param: func(name string) string {
			if name == "documentID" {
				return "doc-42"
			}
			return ""
		}}
		if got := keyFn(req); got != "doc-42" {
			t.Errorf("%s: serial key = %q, want the documentID %q", op, got, "doc-42")
		}
	}
}

// TestAdaptSerialScopedSerializesSameKey proves a serial op keyed by a path
// param never runs two requests with the same key at once, while a handler that
// merely counts overlap would trip if the lock were absent. Run under -race.
func TestAdaptSerialScopedSerializesSameKey(t *testing.T) {
	e := echo.New()
	s := &server{}
	var inside, maxInside int32
	h := func(access.Context, endpoint.Request) endpoint.Response {
		n := atomic.AddInt32(&inside, 1)
		for {
			old := atomic.LoadInt32(&maxInside)
			if n <= old || atomic.CompareAndSwapInt32(&maxInside, old, n) {
				break
			}
		}
		time.Sleep(time.Microsecond)
		atomic.AddInt32(&inside, -1)
		return endpoint.Response{Status: 200}
	}
	handler := s.adaptSerialScoped(h, serialKeyByParam("documentID"))

	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 25; j++ {
				_ = handler(serialCtx(e, "documentID", "doc-1"))
			}
		}()
	}
	wg.Wait()

	if got := atomic.LoadInt32(&maxInside); got != 1 {
		t.Fatalf("max concurrent same-key handlers = %d, want 1", got)
	}
}

// TestAdaptSerialScopedDifferentKeysConcurrent proves different keys do not
// serialize: N requests with distinct document ids must all be inside the
// handler at once, forced by a barrier they must all reach.
func TestAdaptSerialScopedDifferentKeysConcurrent(t *testing.T) {
	e := echo.New()
	s := &server{}
	const n = 4
	var reached sync.WaitGroup
	reached.Add(n)
	release := make(chan struct{})
	h := func(access.Context, endpoint.Request) endpoint.Response {
		reached.Done()
		<-release
		return endpoint.Response{Status: 200}
	}
	handler := s.adaptSerialScoped(h, serialKeyByParam("documentID"))

	for i := 0; i < n; i++ {
		id := "doc-" + string(rune('a'+i))
		go func() { _ = handler(serialCtx(e, "documentID", id)) }()
	}

	done := make(chan struct{})
	go func() { reached.Wait(); close(done) }()
	select {
	case <-done:
		close(release)
	case <-time.After(2 * time.Second):
		close(release)
		t.Fatal("different-key serial handlers did not run concurrently")
	}
}

// dispatchScopedOps returns every operation name routes.go installs, in the
// order it installs them. The route table is read as source because that is the
// only place the mapping route → operation exists, and JOB-2 is exactly the
// claim that operationMode and the route table are the same set.
func dispatchScopedOps(t *testing.T) []string {
	t.Helper()
	src, err := os.ReadFile("routes.go")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(src), "s.adaptScoped(") {
		t.Error("routes.go still installs a scoped route with a bare s.adaptScoped call; " +
			"every scoped route must go through dispatchScoped so operationMode stays the complete inventory")
	}
	var ops []string
	for _, m := range regexp.MustCompile(`s\.dispatchScoped\("([^"]+)"`).FindAllStringSubmatch(string(src), -1) {
		ops = append(ops, m[1])
	}
	return ops
}

// TestDispatchTableIsExhaustive pins JOB-2: operationMode and the scoped route
// table are the same set, one entry per route. So "which operations are
// concurrent, serial, or deferred?" is answered by the table alone.
func TestDispatchTableIsExhaustive(t *testing.T) {
	installed := make(map[string]int)
	for _, op := range dispatchScopedOps(t) {
		installed[op]++
	}
	if len(installed) == 0 {
		t.Fatal("no dispatchScoped routes found in routes.go")
	}
	for op, n := range installed {
		if _, ok := operationMode[op]; !ok {
			t.Errorf("route operation %q is not classified in operationMode", op)
		}
		if n > 1 {
			t.Errorf("operation %q is installed on %d routes, want 1", op, n)
		}
	}
	for op := range operationMode {
		if installed[op] == 0 {
			t.Errorf("operationMode classifies %q but no route installs it", op)
		}
	}
}

// TestOperationNamesFollowOneConvention keeps the inventory readable: every name
// is <capability>.<verb> in lower snake_case, optionally sub-namespaced.
func TestOperationNamesFollowOneConvention(t *testing.T) {
	shape := regexp.MustCompile(`^[a-z]+(\.[a-z][a-z_]*)+$`)
	for op := range operationMode {
		if !shape.MatchString(op) {
			t.Errorf("operation %q does not match <capability>.<verb> in snake_case", op)
		}
	}
}

// mustPanic asserts fn panics, and returns the panic value for inspection.
func mustPanic(t *testing.T, what string, fn func()) any {
	t.Helper()
	var got any
	func() {
		defer func() { got = recover() }()
		fn()
	}()
	if got == nil {
		t.Fatalf("%s did not panic", what)
	}
	return got
}

// TestDispatchScopedRejectsAnUnclassifiedOperation is the guard that makes the
// table enforced rather than advisory: a route naming an operation the table
// does not classify fails loudly at startup instead of silently defaulting to a
// concurrent handler.
func TestDispatchScopedRejectsAnUnclassifiedOperation(t *testing.T) {
	s := &server{}
	h := func(access.Context, endpoint.Request) endpoint.Response { return endpoint.Response{Status: 200} }
	got := mustPanic(t, "installing an unclassified operation", func() {
		s.dispatchScoped("documents.not_a_real_operation", h, nil)
	})
	if msg, _ := got.(string); !strings.Contains(msg, "not classified") {
		t.Errorf("panic = %v, want it to name the missing classification", got)
	}
}

// TestDispatchScopedRejectsADuplicateOperation keeps one name meaning one route,
// so the table can be read as an inventory.
func TestDispatchScopedRejectsADuplicateOperation(t *testing.T) {
	s := &server{}
	h := func(access.Context, endpoint.Request) endpoint.Response { return endpoint.Response{Status: 200} }
	s.dispatchScoped("documents.list", h, nil)
	got := mustPanic(t, "installing the same operation twice", func() {
		s.dispatchScoped("documents.list", h, nil)
	})
	if msg, _ := got.(string); !strings.Contains(msg, "more than one route") {
		t.Errorf("panic = %v, want it to name the duplicate route", got)
	}
}
