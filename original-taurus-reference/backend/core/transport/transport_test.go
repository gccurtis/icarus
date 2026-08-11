package transport

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/capability/activity"
	"github.com/gccurtis/taurus-omega/core/capability/agent"
	"github.com/gccurtis/taurus-omega/core/capability/chat"
	"github.com/gccurtis/taurus-omega/core/capability/connector"
	"github.com/gccurtis/taurus-omega/core/capability/contexts"
	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/capability/persona"
	"github.com/gccurtis/taurus-omega/core/capability/resource"
	"github.com/gccurtis/taurus-omega/core/capability/session"
	"github.com/gccurtis/taurus-omega/core/platform/job"
	"github.com/gccurtis/taurus-omega/core/platform/storage/sqlite"
)

func newTestServer() *echo.Echo {
	e, _ := newTestServerWithStore()
	return e
}

func wireTextHash(text string) string {
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])
}

// newTestServerWithStore also returns the access store, so a test can seed state
// (e.g. a membership) that no endpoint yet exposes.
func newTestServerWithStore() (*echo.Echo, *access.MemoryStore) {
	store := access.NewMemoryStore()
	acc := access.New(
		access.Stores{Users: store, Sessions: store, Projects: store, Memberships: store, Links: store},
		access.Options{},
	)
	jobStore := job.NewMemoryStore()
	queue := job.NewQueue(jobStore, 0)
	docs := document.New(document.NewMemoryStore(), document.Options{Enqueuer: queue})
	activityFeed := activity.New(activity.NewMemoryStore())
	resources, _ := resource.New(testDocumentFamily{documents: docs})
	connectors := connector.NewWithSync(connector.NewMemoryStore(nil),
		func(c connector.Connector) (connector.Provider, error) {
			return connector.NewLocalFolderProvider(c.Path), nil
		},
		noopLattice{})
	contextsSvc := contexts.New(contexts.NewMemoryStore())
	return New(Options{Access: acc, Documents: docs, Activity: activityFeed, Resources: resources, Connectors: connectors, Contexts: contextsSvc, Enqueuer: queue, Jobs: jobStore}), store
}

type noopLattice struct{}

func (noopLattice) AddSources(projectID string, files []connector.LatticeFileWrite) (connector.Usage, []connector.SkippedFile, error) {
	return connector.Usage{}, nil, nil
}
func (noopLattice) RemoveSource(projectID, sourceID string) error { return nil }
func (noopLattice) SourcesUnder(projectID, sourceIDPrefix string) ([]connector.LatticeFile, error) {
	return nil, nil
}

func newSQLiteTestServer(t *testing.T, path string) (*echo.Echo, *sqlite.Store) {
	t.Helper()
	store, err := sqlite.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	acc := access.New(access.Stores{Users: store, Sessions: store, Projects: store, Memberships: store, Links: store}, access.Options{})
	queue := job.NewQueue(store, 0)
	docs := document.New(store, document.Options{Enqueuer: queue})
	feed := activity.New(store)
	resources, err := resource.New(testDocumentFamily{documents: docs})
	if err != nil {
		t.Fatal(err)
	}
	return New(Options{Access: acc, Documents: docs, Activity: feed, Resources: resources, Enqueuer: queue, Jobs: store}), store
}

type testDocumentFamily struct{ documents *document.Documents }

func (f testDocumentFamily) Kind() resource.Kind { return resource.KindDocument }
func (f testDocumentFamily) Get(projectID, id string) (resource.Summary, error) {
	summary, err := f.documents.Summary(projectID, id)
	if errors.Is(err, document.ErrNotFound) {
		err = resource.ErrNotFound
	}
	return resource.Summary{ID: summary.ID, Kind: resource.KindDocument, Name: summary.Name, CreatedAt: summary.CreatedAt, UpdatedAt: summary.UpdatedAt}, err
}
func (f testDocumentFamily) List(projectID string, before *resource.Boundary, limit int) ([]resource.Summary, error) {
	var boundary *document.SummaryBoundary
	if before != nil {
		boundary = &document.SummaryBoundary{UpdatedAt: before.UpdatedAt, ID: before.ID}
	}
	items, err := f.documents.Summaries(projectID, boundary, limit)
	if err != nil {
		return nil, err
	}
	out := make([]resource.Summary, len(items))
	for i, item := range items {
		out[i] = resource.Summary{ID: item.ID, Kind: resource.KindDocument, Name: item.Name, CreatedAt: item.CreatedAt, UpdatedAt: item.UpdatedAt}
	}
	return out, nil
}
func (f testDocumentFamily) Create(projectID string, actor resource.Actor, name string) (resource.Summary, error) {
	doc, err := f.documents.Create(projectID, name, document.Base{}, document.Actor{ID: actor.ID, Name: actor.Name})
	return resource.Summary{ID: doc.ID, Kind: resource.KindDocument, Name: doc.Name, CreatedAt: doc.CreatedAt, UpdatedAt: doc.UpdatedAt}, err
}
func (f testDocumentFamily) Rename(projectID string, actor resource.Actor, id, name string) (resource.Summary, error) {
	doc, err := f.documents.Rename(projectID, id, name, document.Actor{ID: actor.ID, Name: actor.Name})
	if errors.Is(err, document.ErrNotFound) {
		err = resource.ErrNotFound
	}
	return resource.Summary{ID: doc.ID, Kind: resource.KindDocument, Name: doc.Name, CreatedAt: doc.CreatedAt, UpdatedAt: doc.UpdatedAt}, err
}
func (f testDocumentFamily) Delete(projectID string, actor resource.Actor, id string) error {
	err := f.documents.Delete(projectID, id, document.Actor{ID: actor.ID, Name: actor.Name})
	if errors.Is(err, document.ErrNotFound) {
		return resource.ErrNotFound
	}
	return err
}

// selectProject registers, logs in, creates a project, and selects it, returning
// the session cookie for a request context with a project in scope.
func selectProject(t *testing.T, e *echo.Echo) *http.Cookie {
	t.Helper()
	do(t, e, http.MethodPost, "/auth/register", `{"email":"u@b.com","password":"password123"}`, nil)
	cookie := sessionCookie(do(t, e, http.MethodPost, "/auth/login", `{"email":"u@b.com","password":"password123"}`, nil))
	rec := do(t, e, http.MethodPost, "/projects", `{"name":"P"}`, cookie)
	var p struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &p); err != nil || p.ID == "" {
		t.Fatalf("create project: %s (%v)", rec.Body.String(), err)
	}
	do(t, e, http.MethodPost, "/session/project", `{"projectId":"`+p.ID+`"}`, cookie)
	return cookie
}

// testCSRFToken is the double-submit token every authenticated test request
// carries. Its value is irrelevant — the check only requires that the to_csrf
// cookie and the X-CSRF-Token header agree — so one fixed string stands in for
// the token the gate would otherwise issue.
const testCSRFToken = "test-csrf-token"

func do(t *testing.T, e *echo.Echo, method, path, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	var r io.Reader
	if body != "" {
		r = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, r)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if cookie != nil {
		req.AddCookie(cookie)
		// A signed-in caller is also a CSRF-token-carrying caller: attach the
		// matching cookie and header the way a real browser client must.
		req.AddCookie(&http.Cookie{Name: access.CSRFCookieName, Value: testCSRFToken})
		req.Header.Set("X-CSRF-Token", testCSRFToken)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func sessionCookie(rec *httptest.ResponseRecorder) *http.Cookie {
	for _, c := range rec.Result().Cookies() {
		if c.Name == access.SessionCookieName {
			return c
		}
	}
	return nil
}

func TestHealthzIsPublic(t *testing.T) {
	e := newTestServer()
	rec := do(t, e, http.MethodGet, "/healthz", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got := strings.TrimSpace(rec.Body.String()); got != `{"status":"ok"}` {
		t.Fatalf("body = %q", got)
	}
}

func TestEchoIsGated(t *testing.T) {
	e := newTestServer()
	if rec := do(t, e, http.MethodPost, "/echo", `{"hi":"x"}`, nil); rec.Code != http.StatusUnauthorized {
		t.Errorf("anonymous /echo = %d, want 401", rec.Code)
	}
}

func TestGatedFlow(t *testing.T) {
	e := newTestServer()

	// Register.
	if rec := do(t, e, http.MethodPost, "/auth/register", `{"email":"u@b.com","password":"password123"}`, nil); rec.Code != http.StatusCreated {
		t.Fatalf("register = %d (%s)", rec.Code, rec.Body.String())
	}

	// Wrong password is refused.
	if rec := do(t, e, http.MethodPost, "/auth/login", `{"email":"u@b.com","password":"nope"}`, nil); rec.Code != http.StatusUnauthorized {
		t.Errorf("bad login = %d, want 401", rec.Code)
	}

	// Login -> session cookie.
	rec := do(t, e, http.MethodPost, "/auth/login", `{"email":"u@b.com","password":"password123"}`, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("login = %d (%s)", rec.Code, rec.Body.String())
	}
	cookie := sessionCookie(rec)
	if cookie == nil {
		t.Fatal("login set no session cookie")
	}

	// With the cookie, the gated routes work.
	if rec := do(t, e, http.MethodGet, "/auth/me", "", cookie); rec.Code != http.StatusOK {
		t.Errorf("me = %d", rec.Code)
	}
	if rec := do(t, e, http.MethodPost, "/echo", `{"hi":"there"}`, cookie); rec.Code != http.StatusOK {
		t.Errorf("gated echo = %d (%s)", rec.Code, rec.Body.String())
	} else if !strings.Contains(rec.Body.String(), `"hi":"there"`) {
		t.Errorf("echo body = %s", rec.Body.String())
	}

	// Logout, and the session stops working.
	if rec := do(t, e, http.MethodPost, "/auth/logout", "", cookie); rec.Code != http.StatusOK {
		t.Errorf("logout = %d", rec.Code)
	}
	if rec := do(t, e, http.MethodPost, "/echo", `{"hi":"x"}`, cookie); rec.Code != http.StatusUnauthorized {
		t.Errorf("echo after logout = %d, want 401", rec.Code)
	}
}

func TestProjectEndpoints(t *testing.T) {
	e := newTestServer()
	do(t, e, http.MethodPost, "/auth/register", `{"email":"u@b.com","password":"password123"}`, nil)
	cookie := sessionCookie(do(t, e, http.MethodPost, "/auth/login", `{"email":"u@b.com","password":"password123"}`, nil))
	if cookie == nil {
		t.Fatal("no session cookie")
	}

	// No projects yet.
	if rec := do(t, e, http.MethodGet, "/projects", "", cookie); !strings.Contains(rec.Body.String(), `"projects":[]`) {
		t.Fatalf("initial list = %s", rec.Body.String())
	}

	// Create → 201, owner role.
	rec := do(t, e, http.MethodPost, "/projects", `{"name":"Alpha"}`, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create = %d (%s)", rec.Code, rec.Body.String())
	}
	var created struct {
		ID   string `json:"id"`
		Role string `json:"role"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil || created.ID == "" || created.Role != "owner" {
		t.Fatalf("create body = %s (%v)", rec.Body.String(), err)
	}

	// List shows it with the owner role.
	if rec := do(t, e, http.MethodGet, "/projects", "", cookie); !strings.Contains(rec.Body.String(), created.ID) || !strings.Contains(rec.Body.String(), `"role":"owner"`) {
		t.Errorf("list = %s", rec.Body.String())
	}

	// Nothing selected yet.
	if rec := do(t, e, http.MethodGet, "/session/project", "", cookie); !strings.Contains(rec.Body.String(), `"selected":false`) {
		t.Errorf("current before select = %s", rec.Body.String())
	}

	// Selecting a project you're not a member of is refused.
	if rec := do(t, e, http.MethodPost, "/session/project", `{"projectId":"nope"}`, cookie); rec.Code != http.StatusForbidden {
		t.Errorf("select non-member = %d, want 403", rec.Code)
	}

	// Select the real project, then it shows as current.
	if rec := do(t, e, http.MethodPost, "/session/project", `{"projectId":"`+created.ID+`"}`, cookie); rec.Code != http.StatusOK {
		t.Fatalf("select = %d (%s)", rec.Code, rec.Body.String())
	}
	if rec := do(t, e, http.MethodGet, "/session/project", "", cookie); !strings.Contains(rec.Body.String(), `"selected":true`) || !strings.Contains(rec.Body.String(), created.ID) {
		t.Errorf("current after select = %s", rec.Body.String())
	}

	// Delete it (owner), then it's gone from the list.
	if rec := do(t, e, http.MethodDelete, "/projects/"+created.ID, "", cookie); rec.Code != http.StatusOK {
		t.Fatalf("delete = %d (%s)", rec.Code, rec.Body.String())
	}
	if rec := do(t, e, http.MethodGet, "/projects", "", cookie); strings.Contains(rec.Body.String(), created.ID) {
		t.Errorf("still listed after delete = %s", rec.Body.String())
	}
}

func TestDocumentEndpoints(t *testing.T) {
	e := newTestServer()

	// Register + login but do NOT select a project: document routes are refused.
	do(t, e, http.MethodPost, "/auth/register", `{"email":"u@b.com","password":"password123"}`, nil)
	noProject := sessionCookie(do(t, e, http.MethodPost, "/auth/login", `{"email":"u@b.com","password":"password123"}`, nil))
	if rec := do(t, e, http.MethodGet, "/documents", "", noProject); rec.Code != http.StatusConflict {
		t.Fatalf("documents before selecting a project = %d, want 409", rec.Code)
	}

	// With a project selected, documents work.
	cookie := selectProject(t, e)

	if rec := do(t, e, http.MethodGet, "/documents", "", cookie); !strings.Contains(rec.Body.String(), `"documents":[]`) {
		t.Fatalf("initial documents = %s", rec.Body.String())
	}

	// Create a document with a block and a text atom; the response echoes it.
	rec := do(t, e, http.MethodPost, "/documents", `{"name":"Notes","rows":[{"blocks":[{"kind":"text","atoms":[{"kind":"text","text":"hello"}]}]}]}`, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create doc = %d (%s)", rec.Code, rec.Body.String())
	}
	var created struct {
		ID          string `json:"id"`
		CreatorID   string `json:"creatorId"`
		CreatorName string `json:"creatorName"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil || created.ID == "" {
		t.Fatalf("create body = %s (%v)", rec.Body.String(), err)
	}
	if created.CreatorID == "" {
		t.Fatalf("expected creatorId in create response, got %s", rec.Body.String())
	}

	// Get it back, with the atom preserved (and server-assigned ids).
	rec = do(t, e, http.MethodGet, "/documents/"+created.ID, "", cookie)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"text":"hello"`) {
		t.Errorf("get doc = %d (%s)", rec.Code, rec.Body.String())
	}
	if rec := do(t, e, http.MethodGet, "/documents/missing", "", cookie); rec.Code != http.StatusNotFound {
		t.Errorf("unknown doc = %d, want 404", rec.Code)
	}
	if rec := do(t, e, http.MethodGet, "/documents", "", cookie); !strings.Contains(rec.Body.String(), created.ID) {
		t.Errorf("list missing the document = %s", rec.Body.String())
	}

	// Delete (trash) it — the document is hidden from List but still Gettable.
	if rec := do(t, e, http.MethodDelete, "/documents/"+created.ID, "", cookie); rec.Code != http.StatusOK {
		t.Errorf("delete = %d", rec.Code)
	}
	if rec := do(t, e, http.MethodGet, "/documents", "", cookie); strings.Contains(rec.Body.String(), created.ID) {
		t.Errorf("trashed document still in list = %s", rec.Body.String())
	}
	if rec := do(t, e, http.MethodGet, "/documents/"+created.ID, "", cookie); rec.Code != http.StatusOK {
		t.Errorf("get after trash = %d, want 200", rec.Code)
	}
	// Restore brings it back.
	if rec := do(t, e, http.MethodPost, "/documents/"+created.ID+"/restore", "", cookie); rec.Code != http.StatusOK {
		t.Errorf("restore = %d", rec.Code)
	}
	if rec := do(t, e, http.MethodGet, "/documents", "", cookie); !strings.Contains(rec.Body.String(), created.ID) {
		t.Errorf("restored document missing from list = %s", rec.Body.String())
	}
}

func TestDocumentChangeEndpoints(t *testing.T) {
	e := newTestServer()
	cookie := selectProject(t, e)

	rec := do(t, e, http.MethodPost, "/documents",
		`{"name":"D","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"hello"}]}]}]}`, cookie)
	var created struct {
		ID       string `json:"id"`
		Revision int64  `json:"revision"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil || created.ID == "" {
		t.Fatalf("create doc: %s (%v)", rec.Body.String(), err)
	}
	if created.Revision != 0 {
		t.Fatalf("created revision = %d, want 0", created.Revision)
	}

	// Edit the atom's text → 201 with an authored, sequenced change set.
	firstSubmission := `{"submissionId":"transport-edit-1","expectedRevision":0,"operations":[{"op":"set_atom_text","blockId":"b1","atomId":"a1","setText":"world"}]}`
	rec = do(t, e, http.MethodPost, "/documents/"+created.ID+"/changes",
		firstSubmission, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("append changes = %d (%s)", rec.Code, rec.Body.String())
	}
	var firstChange document.ChangeSet
	if err := json.Unmarshal(rec.Body.Bytes(), &firstChange); err != nil ||
		firstChange.ID == "" || firstChange.AuthorID == "" ||
		firstChange.SubmissionID != "transport-edit-1" ||
		firstChange.PriorRevision != 0 || firstChange.Seq != 1 {
		t.Errorf("change set body = %s (%v)", rec.Body.String(), err)
	}

	// Losing the response is safe: an identical retry returns the original
	// ChangeSet and does not advance the document again.
	retryResponse := do(t, e, http.MethodPost, "/documents/"+created.ID+"/changes",
		firstSubmission, cookie)
	var retried document.ChangeSet
	if retryResponse.Code != http.StatusCreated ||
		json.Unmarshal(retryResponse.Body.Bytes(), &retried) != nil ||
		retried.ID != firstChange.ID || retried.Seq != firstChange.Seq {
		t.Fatalf("idempotent retry = %d %s", retryResponse.Code, retryResponse.Body.String())
	}

	// The resolved document now reflects the edit.
	if rec := do(t, e, http.MethodGet, "/documents/"+created.ID, "", cookie); !strings.Contains(rec.Body.String(), `"text":"world"`) || !strings.Contains(rec.Body.String(), `"revision":1`) {
		t.Errorf("resolved doc = %s", rec.Body.String())
	}

	// A new submission authored against revision zero fails closed with the
	// bounded resync revision instead of overwriting the current atom.
	staleResponse := do(t, e, http.MethodPost, "/documents/"+created.ID+"/changes",
		`{"submissionId":"transport-stale","expectedRevision":0,"operations":[{"op":"set_atom_text","blockId":"b1","atomId":"a1","setText":"stale"}]}`, cookie)
	if staleResponse.Code != http.StatusConflict ||
		!strings.Contains(staleResponse.Body.String(), `"code":"document_revision_conflict"`) ||
		!strings.Contains(staleResponse.Body.String(), `"currentRevision":1`) ||
		!strings.Contains(staleResponse.Body.String(), `"resyncRevision":1`) {
		t.Fatalf("stale submission = %d %s", staleResponse.Code, staleResponse.Body.String())
	}
	reusedResponse := do(t, e, http.MethodPost, "/documents/"+created.ID+"/changes",
		`{"submissionId":"transport-edit-1","expectedRevision":1,"operations":[{"op":"set_atom_text","blockId":"b1","atomId":"a1","setText":"different"}]}`, cookie)
	if reusedResponse.Code != http.StatusConflict ||
		!strings.Contains(reusedResponse.Body.String(), `"code":"document_submission_conflict"`) ||
		!strings.Contains(reusedResponse.Body.String(), `"currentRevision":1`) {
		t.Fatalf("reused submission id = %d %s", reusedResponse.Code, reusedResponse.Body.String())
	}

	// Add a bold mark over the atom → 201, and the mark comes back on read.
	markResponse := do(t, e, http.MethodPost, "/documents/"+created.ID+"/changes",
		`{"submissionId":"transport-mark-1","expectedRevision":1,"operations":[{"op":"add_mark","blockId":"b1","mark":{"kind":"bold","start":{"atomId":"a1","offset":0},"end":{"atomId":"a1","offset":5}}}]}`, cookie)
	if markResponse.Code != http.StatusCreated {
		t.Errorf("add mark = %d (%s)", markResponse.Code, markResponse.Body.String())
	}
	var markChange document.ChangeSet
	if err := json.Unmarshal(markResponse.Body.Bytes(), &markChange); err != nil || markChange.ID == "" {
		t.Fatalf("decode mark change: %s (%v)", markResponse.Body.String(), err)
	}
	if rec := do(t, e, http.MethodGet, "/documents/"+created.ID, "", cookie); !strings.Contains(rec.Body.String(), `"kind":"bold"`) || !strings.Contains(rec.Body.String(), `"revision":2`) {
		t.Errorf("resolved doc missing mark = %s", rec.Body.String())
	}
	undoResponse := do(t, e, http.MethodPost,
		"/documents/"+created.ID+"/changes/"+markChange.ID+"/undo", "", cookie)
	if undoResponse.Code != http.StatusCreated {
		t.Fatalf("undo mark = %d (%s)", undoResponse.Code, undoResponse.Body.String())
	}
	var undo document.ChangeSet
	if err := json.Unmarshal(undoResponse.Body.Bytes(), &undo); err != nil ||
		undo.UndoOf != markChange.ID || undo.AuthorID != markChange.AuthorID || undo.Seq != 3 {
		t.Fatalf("undo response = %s (%v)", undoResponse.Body.String(), err)
	}
	if rec := do(t, e, http.MethodGet, "/documents/"+created.ID, "", cookie); strings.Contains(rec.Body.String(), `"kind":"bold"`) || !strings.Contains(rec.Body.String(), `"revision":3`) {
		t.Errorf("resolved doc after undo = %s", rec.Body.String())
	}
	historyResponse := do(t, e, http.MethodGet,
		"/documents/"+created.ID+"/history?limit=2", "", cookie)
	if historyResponse.Code != http.StatusOK ||
		!strings.Contains(historyResponse.Body.String(), `"revision":3`) ||
		!strings.Contains(historyResponse.Body.String(), `"canRedo":true`) ||
		!strings.Contains(historyResponse.Body.String(), `"operationTypes":["remove_mark"]`) ||
		!strings.Contains(historyResponse.Body.String(), `"nextCursor":"`) {
		t.Fatalf("history page = %d %s", historyResponse.Code, historyResponse.Body.String())
	}
	var historyPage struct {
		NextCursor string `json:"nextCursor"`
	}
	if err := json.Unmarshal(historyResponse.Body.Bytes(), &historyPage); err != nil || historyPage.NextCursor == "" {
		t.Fatalf("history cursor = %q, %v", historyPage.NextCursor, err)
	}
	olderHistory := do(t, e, http.MethodGet,
		"/documents/"+created.ID+"/history?limit=2&cursor="+historyPage.NextCursor, "", cookie)
	if olderHistory.Code != http.StatusOK ||
		!strings.Contains(olderHistory.Body.String(), `"revision":1`) {
		t.Fatalf("older history = %d %s", olderHistory.Code, olderHistory.Body.String())
	}
	detailResponse := do(t, e, http.MethodGet,
		"/documents/"+created.ID+"/history/"+markChange.ID, "", cookie)
	if detailResponse.Code != http.StatusOK ||
		!strings.Contains(detailResponse.Body.String(), `"id":"`+markChange.ID+`"`) ||
		strings.Contains(detailResponse.Body.String(), "inverseOps") {
		t.Fatalf("history detail = %d %s", detailResponse.Code, detailResponse.Body.String())
	}
	if rec := do(t, e, http.MethodGet,
		"/documents/"+created.ID+"/history/missing", "", cookie); rec.Code != http.StatusNotFound {
		t.Fatalf("missing history detail = %d, want 404 (%s)", rec.Code, rec.Body.String())
	}
	if rec := do(t, e, http.MethodGet,
		"/documents/"+created.ID+"/history?limit=101", "", cookie); rec.Code != http.StatusBadRequest {
		t.Fatalf("large history limit = %d, want 400 (%s)", rec.Code, rec.Body.String())
	}
	if rec := do(t, e, http.MethodGet,
		"/documents/"+created.ID+"/history?cursor=bad", "", cookie); rec.Code != http.StatusBadRequest {
		t.Fatalf("bad history cursor = %d, want 400 (%s)", rec.Code, rec.Body.String())
	}
	if rec := do(t, e, http.MethodPost,
		"/documents/"+created.ID+"/changes/"+undo.ID+"/undo", "", cookie); rec.Code != http.StatusConflict {
		t.Fatalf("undo an undo = %d, want 409 (%s)", rec.Code, rec.Body.String())
	}
	redoResponse := do(t, e, http.MethodPost,
		"/documents/"+created.ID+"/changes/"+undo.ID+"/redo", "", cookie)
	if redoResponse.Code != http.StatusCreated {
		t.Fatalf("redo mark = %d (%s)", redoResponse.Code, redoResponse.Body.String())
	}
	var redo document.ChangeSet
	if err := json.Unmarshal(redoResponse.Body.Bytes(), &redo); err != nil ||
		redo.RedoOf != undo.ID || redo.UndoOf != "" || redo.Seq != 4 {
		t.Fatalf("redo response = %s (%v)", redoResponse.Body.String(), err)
	}
	if rec := do(t, e, http.MethodGet, "/documents/"+created.ID, "", cookie); !strings.Contains(rec.Body.String(), `"kind":"bold"`) || !strings.Contains(rec.Body.String(), `"revision":4`) {
		t.Errorf("resolved doc after redo = %s", rec.Body.String())
	}
	if rec := do(t, e, http.MethodPost,
		"/documents/"+created.ID+"/changes/"+firstChange.ID+"/undo", "", cookie); rec.Code != http.StatusConflict {
		t.Errorf("non-head undo = %d, want 409 (%s)", rec.Code, rec.Body.String())
	}

	// Row height and block alignment are ordinary undoable revisions.
	styleResponse := do(t, e, http.MethodPost, "/documents/"+created.ID+"/changes",
		`{"submissionId":"transport-style-1","expectedRevision":4,"operations":[{"op":"set_block_line_height","blockId":"b1","lineHeight":20},{"op":"set_block_alignment","blockId":"b1","horizontalAlign":"center","verticalAlign":"bottom"}]}`, cookie)
	if styleResponse.Code != http.StatusCreated {
		t.Fatalf("set layout styles = %d (%s)", styleResponse.Code, styleResponse.Body.String())
	}
	var styleChange document.ChangeSet
	if err := json.Unmarshal(styleResponse.Body.Bytes(), &styleChange); err != nil || styleChange.ID == "" {
		t.Fatalf("decode style change = %s (%v)", styleResponse.Body.String(), err)
	}
	rec = do(t, e, http.MethodGet, "/documents/"+created.ID, "", cookie)
	if !strings.Contains(rec.Body.String(), `"lineHeight":20`) ||
		!strings.Contains(rec.Body.String(), `"horizontalAlign":"center"`) ||
		!strings.Contains(rec.Body.String(), `"verticalAlign":"bottom"`) {
		t.Errorf("resolved styles = %s", rec.Body.String())
	}
	if rec := do(t, e, http.MethodPost,
		"/documents/"+created.ID+"/changes/"+styleChange.ID+"/undo", "", cookie); rec.Code != http.StatusCreated {
		t.Fatalf("undo styles = %d (%s)", rec.Code, rec.Body.String())
	}

	// Page geometry is document-level revisioned content and is undoable too.
	layoutResponse := do(t, e, http.MethodPost, "/documents/"+created.ID+"/changes",
		`{"submissionId":"transport-layout-1","expectedRevision":6,"operations":[{"op":"set_page_layout","pageLayout":{"width":500,"height":700,"marginTop":50,"marginRight":40,"marginBottom":50,"marginLeft":40}}]}`, cookie)
	if layoutResponse.Code != http.StatusCreated {
		t.Fatalf("set page layout = %d (%s)", layoutResponse.Code, layoutResponse.Body.String())
	}
	var layoutChange document.ChangeSet
	if err := json.Unmarshal(layoutResponse.Body.Bytes(), &layoutChange); err != nil || layoutChange.ID == "" {
		t.Fatalf("decode page layout change = %s (%v)", layoutResponse.Body.String(), err)
	}
	if rec := do(t, e, http.MethodGet, "/documents/"+created.ID, "", cookie); !strings.Contains(rec.Body.String(), `"width":500`) {
		t.Errorf("resolved page layout = %s", rec.Body.String())
	}
	if rec := do(t, e, http.MethodPost,
		"/documents/"+created.ID+"/changes/"+layoutChange.ID+"/undo", "", cookie); rec.Code != http.StatusCreated {
		t.Fatalf("undo page layout = %d (%s)", rec.Code, rec.Body.String())
	}

	// Empty ops → 400; unknown document → 404.
	if rec := do(t, e, http.MethodPost, "/documents/"+created.ID+"/changes", `{"submissionId":"transport-empty","expectedRevision":8,"operations":[]}`, cookie); rec.Code != http.StatusBadRequest {
		t.Errorf("empty ops = %d, want 400", rec.Code)
	}
	if rec := do(t, e, http.MethodPost, "/documents/missing/changes", `{"submissionId":"transport-missing","expectedRevision":0,"operations":[{"op":"delete_row","rowId":"x"}]}`, cookie); rec.Code != http.StatusNotFound {
		t.Errorf("unknown doc = %d, want 404", rec.Code)
	}
	// A change referencing content that no longer exists conflicts → 409.
	if rec := do(t, e, http.MethodPost, "/documents/"+created.ID+"/changes", `{"submissionId":"transport-gone","expectedRevision":8,"operations":[{"op":"set_atom_text","blockId":"b1","atomId":"gone","setText":"x"}]}`, cookie); rec.Code != http.StatusConflict {
		t.Errorf("conflicting change = %d, want 409", rec.Code)
	}
}

func TestDocumentStyleValidationTransportIsTypedAndAtomic(t *testing.T) {
	e := newTestServer()
	cookie := selectProject(t, e)
	rec := do(t, e, http.MethodPost, "/documents",
		`{"name":"Styled","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"hello"}]}]}]}`,
		cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create = %d %s", rec.Code, rec.Body.String())
	}
	var created document.Document
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		id, mark, field string
	}{
		{
			id:    "javascript",
			mark:  `{"kind":"link","attrs":{"href":"javascript:alert(1)"},"start":{"atomId":"a1","offset":0},"end":{"atomId":"a1","offset":5}}`,
			field: "link.href",
		},
		{
			id:    "control",
			mark:  `{"kind":"link","attrs":{"href":"java\tscript:alert(1)"},"start":{"atomId":"a1","offset":0},"end":{"atomId":"a1","offset":5}}`,
			field: "link.href",
		},
		{
			id:    "font-family",
			mark:  `{"kind":"font","attrs":{"family":"Arial;background:url(//evil.example)"},"start":{"atomId":"a1","offset":0},"end":{"atomId":"a1","offset":5}}`,
			field: "font.family",
		},
		{
			id:    "font-size",
			mark:  `{"kind":"font","attrs":{"size":"calc(100vw)"},"start":{"atomId":"a1","offset":0},"end":{"atomId":"a1","offset":5}}`,
			field: "font.size",
		},
	}
	for _, tc := range tests {
		body := `{"submissionId":"style-` + tc.id + `","expectedRevision":0,"operations":[{"op":"add_mark","blockId":"b1","mark":` + tc.mark + `}]}`
		got := do(t, e, http.MethodPost, "/documents/"+created.ID+"/changes", body, cookie)
		if got.Code != http.StatusBadRequest ||
			!strings.Contains(got.Body.String(), `"code":"document.invalid_style"`) ||
			!strings.Contains(got.Body.String(), `"field":"`+tc.field+`"`) {
			t.Errorf("%s rejection = %d %s", tc.id, got.Code, got.Body.String())
		}
	}

	got := do(t, e, http.MethodGet, "/documents/"+created.ID, "", cookie)
	if got.Code != http.StatusOK || !strings.Contains(got.Body.String(), `"revision":0`) ||
		strings.Contains(got.Body.String(), `"marks"`) {
		t.Fatalf("rejections changed document = %d %s", got.Code, got.Body.String())
	}
	history := do(t, e, http.MethodGet, "/documents/"+created.ID+"/history", "", cookie)
	if history.Code != http.StatusOK || !strings.Contains(history.Body.String(), `"entries":[]`) {
		t.Fatalf("rejections changed history = %d %s", history.Code, history.Body.String())
	}

	allowed := do(t, e, http.MethodPost, "/documents/"+created.ID+"/changes",
		`{"submissionId":"style-safe","expectedRevision":0,"operations":[{"op":"add_mark","blockId":"b1","mark":{"kind":"link","attrs":{"href":"https://example.com/x?y=1#z"},"start":{"atomId":"a1","offset":0},"end":{"atomId":"a1","offset":5}}}]}`,
		cookie)
	if allowed.Code != http.StatusCreated {
		t.Fatalf("safe link = %d %s", allowed.Code, allowed.Body.String())
	}
}

func TestDocumentR3EditingOperations(t *testing.T) {
	e := newTestServer()
	cookie := selectProject(t, e)
	createdResponse := do(t, e, http.MethodPost, "/documents",
		`{"name":"R3","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"hello"}]}]},{"id":"r2","blocks":[{"id":"b2","kind":"text","atoms":[{"id":"a2","kind":"text","text":"second"}]}]}]}`,
		cookie)
	var created document.Document
	if createdResponse.Code != http.StatusCreated ||
		json.Unmarshal(createdResponse.Body.Bytes(), &created) != nil {
		t.Fatalf("create R3 document = %d %s", createdResponse.Code, createdResponse.Body.String())
	}

	spliceBody := `{"submissionId":"r3-splice","expectedRevision":0,"operations":[{"op":"splice_atom_text","blockId":"b1","atomId":"a1","startOffset":2,"endOffset":3,"insertText":"L","expectedTextHash":"` + wireTextHash("hello") + `"}]}`
	spliceResponse := do(t, e, http.MethodPost,
		"/documents/"+created.ID+"/changes", spliceBody, cookie)
	if spliceResponse.Code != http.StatusCreated ||
		!strings.Contains(spliceResponse.Body.String(), `"operationTypes":["splice_atom_text"]`) {
		t.Fatalf("splice response = %d %s", spliceResponse.Code, spliceResponse.Body.String())
	}
	if got := do(t, e, http.MethodGet, "/documents/"+created.ID, "", cookie); !strings.Contains(got.Body.String(), `"text":"heLlo"`) {
		t.Fatalf("spliced document = %s", got.Body.String())
	}

	moveResponse := do(t, e, http.MethodPost, "/documents/"+created.ID+"/changes",
		`{"submissionId":"r3-move","expectedRevision":1,"operations":[{"op":"move_row","rowId":"r2","fromAfterRow":"r1","afterRow":""}]}`,
		cookie)
	if moveResponse.Code != http.StatusCreated {
		t.Fatalf("move response = %d %s", moveResponse.Code, moveResponse.Body.String())
	}
	got := do(t, e, http.MethodGet, "/documents/"+created.ID, "", cookie)
	if strings.Index(got.Body.String(), `"id":"r2"`) > strings.Index(got.Body.String(), `"id":"r1"`) {
		t.Fatalf("row move did not reorder document: %s", got.Body.String())
	}

	splitBody := `{"submissionId":"r3-split","expectedRevision":2,"operations":[{"op":"split_block","blockId":"b1","atomId":"a1","startOffset":2,"expectedTextHash":"` + wireTextHash("heLlo") + `","row":{"id":"r3","blocks":[{"id":"b3","kind":"text","atoms":[{"id":"a3","kind":"text","text":""}]}]}}]}`
	splitResponse := do(t, e, http.MethodPost,
		"/documents/"+created.ID+"/changes", splitBody, cookie)
	if splitResponse.Code != http.StatusCreated {
		t.Fatalf("split response = %d %s", splitResponse.Code, splitResponse.Body.String())
	}
	got = do(t, e, http.MethodGet, "/documents/"+created.ID, "", cookie)
	if !strings.Contains(got.Body.String(), `"text":"he"`) ||
		!strings.Contains(got.Body.String(), `"text":"Llo"`) {
		t.Fatalf("split document = %s", got.Body.String())
	}

	joinBody := `{"submissionId":"r3-join","expectedRevision":3,"operations":[{"op":"join_blocks","blockId":"b1","otherBlockId":"b3","expectedTextHash":"` + wireTextHash("he") + `","expectedOtherTextHash":"` + wireTextHash("Llo") + `"}]}`
	joinResponse := do(t, e, http.MethodPost,
		"/documents/"+created.ID+"/changes", joinBody, cookie)
	if joinResponse.Code != http.StatusCreated {
		t.Fatalf("join response = %d %s", joinResponse.Code, joinResponse.Body.String())
	}
	got = do(t, e, http.MethodGet, "/documents/"+created.ID, "", cookie)
	if !strings.Contains(got.Body.String(), `"text":"heLlo"`) ||
		strings.Contains(got.Body.String(), `"id":"r3"`) {
		t.Fatalf("joined document = %s", got.Body.String())
	}

	staleSplice := do(t, e, http.MethodPost, "/documents/"+created.ID+"/changes",
		`{"submissionId":"r3-stale","expectedRevision":4,"operations":[{"op":"splice_atom_text","blockId":"b1","atomId":"a1","startOffset":0,"endOffset":0,"insertText":"x","expectedTextHash":"`+wireTextHash("stale")+`"}]}`,
		cookie)
	if staleSplice.Code != http.StatusConflict {
		t.Fatalf("stale splice = %d, want 409 (%s)", staleSplice.Code, staleSplice.Body.String())
	}
}

func TestDocumentR4SemanticRebase(t *testing.T) {
	e := newTestServer()
	cookie := selectProject(t, e)
	createdResponse := do(t, e, http.MethodPost, "/documents",
		`{"name":"R4","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"abcdef"}]}]}]}`,
		cookie)
	var created document.Document
	if createdResponse.Code != http.StatusCreated ||
		json.Unmarshal(createdResponse.Body.Bytes(), &created) != nil {
		t.Fatalf("create R4 document = %d %s", createdResponse.Code, createdResponse.Body.String())
	}

	firstBody := `{"submissionId":"r4-first","expectedRevision":0,"operations":[{"op":"splice_atom_text","blockId":"b1","atomId":"a1","startOffset":0,"endOffset":1,"insertText":"AA","expectedTextHash":"` + wireTextHash("abcdef") + `"}]}`
	firstResponse := do(t, e, http.MethodPost,
		"/documents/"+created.ID+"/changes", firstBody, cookie)
	if firstResponse.Code != http.StatusCreated {
		t.Fatalf("first splice = %d %s", firstResponse.Code, firstResponse.Body.String())
	}

	staleDisjointBody := `{"submissionId":"r4-disjoint","expectedRevision":0,"operations":[{"op":"splice_atom_text","blockId":"b1","atomId":"a1","startOffset":4,"endOffset":5,"insertText":"","expectedTextHash":"` + wireTextHash("abcdef") + `"}]}`
	disjointResponse := do(t, e, http.MethodPost,
		"/documents/"+created.ID+"/changes", staleDisjointBody, cookie)
	var rebased document.ChangeSet
	if disjointResponse.Code != http.StatusCreated ||
		json.Unmarshal(disjointResponse.Body.Bytes(), &rebased) != nil {
		t.Fatalf("rebased splice = %d %s", disjointResponse.Code, disjointResponse.Body.String())
	}
	if rebased.AuthoredRevision != 0 || rebased.PriorRevision != 1 || rebased.Seq != 2 ||
		len(rebased.Ops) != 1 || rebased.Ops[0].StartOffset != 5 ||
		rebased.Ops[0].EndOffset != 6 ||
		rebased.Ops[0].ExpectedTextHash != wireTextHash("AAbcdef") {
		t.Fatalf("rebased change set = %+v", rebased)
	}
	got := do(t, e, http.MethodGet, "/documents/"+created.ID, "", cookie)
	if got.Code != http.StatusOK ||
		!strings.Contains(got.Body.String(), `"text":"AAbcdf"`) ||
		!strings.Contains(got.Body.String(), `"revision":2`) {
		t.Fatalf("rebased document = %d %s", got.Code, got.Body.String())
	}

	staleOverlapBody := `{"submissionId":"r4-overlap","expectedRevision":0,"operations":[{"op":"splice_atom_text","blockId":"b1","atomId":"a1","startOffset":0,"endOffset":2,"insertText":"x","expectedTextHash":"` + wireTextHash("abcdef") + `"}]}`
	overlapResponse := do(t, e, http.MethodPost,
		"/documents/"+created.ID+"/changes", staleOverlapBody, cookie)
	if overlapResponse.Code != http.StatusConflict ||
		!strings.Contains(overlapResponse.Body.String(), `"code":"document_revision_conflict"`) ||
		!strings.Contains(overlapResponse.Body.String(), `"currentRevision":2`) ||
		!strings.Contains(overlapResponse.Body.String(), `"resyncRevision":2`) {
		t.Fatalf("overlapping stale splice = %d %s", overlapResponse.Code, overlapResponse.Body.String())
	}

	historyResponse := do(t, e, http.MethodGet,
		"/documents/"+created.ID+"/history", "", cookie)
	var historyPage struct {
		Entries []document.HistoryEntry `json:"entries"`
	}
	if historyResponse.Code != http.StatusOK ||
		json.Unmarshal(historyResponse.Body.Bytes(), &historyPage) != nil ||
		len(historyPage.Entries) != 2 ||
		historyPage.Entries[0].AuthoredRevision != 0 ||
		historyPage.Entries[0].PriorRevision != 1 {
		t.Fatalf("rebased history = %d %s", historyResponse.Code, historyResponse.Body.String())
	}
}

// TestRebaseIsAsyncWithJobStatus exercises the async dispatch path: re-basing a
// document is an async operation, so the request enqueues a job and answers 202
// with a job id the client can poll at /dev/jobs/:jobID.
func TestRebaseIsAsyncWithJobStatus(t *testing.T) {
	e := newTestServer()
	cookie := selectProject(t, e)

	rec := do(t, e, http.MethodPost, "/documents",
		`{"name":"D","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"x"}]}]}]}`, cookie)
	var created struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil || created.ID == "" {
		t.Fatalf("create doc: %s (%v)", rec.Body.String(), err)
	}

	// Re-base is async → 202 Accepted with a job id.
	rec = do(t, e, http.MethodPost, "/dev/documents/"+created.ID+"/rebase", "", cookie)
	if rec.Code != http.StatusAccepted {
		t.Fatalf("rebase = %d, want 202 (%s)", rec.Code, rec.Body.String())
	}
	var acc struct {
		JobID  string `json:"jobId"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &acc); err != nil || acc.JobID == "" || acc.Status != "queued" {
		t.Fatalf("rebase body = %s (%v)", rec.Body.String(), err)
	}

	// The job id is pollable on the dev path, at /dev/jobs/:jobID.
	if rec := do(t, e, http.MethodGet, "/dev/jobs/"+acc.JobID, "", cookie); rec.Code != http.StatusOK ||
		!strings.Contains(rec.Body.String(), `"type":"document.rebase"`) {
		t.Errorf("job status = %d (%s)", rec.Code, rec.Body.String())
	}
	// An unknown job id is 404.
	if rec := do(t, e, http.MethodGet, "/dev/jobs/nope", "", cookie); rec.Code != http.StatusNotFound {
		t.Errorf("unknown job = %d, want 404", rec.Code)
	}
	// The status endpoint is gated.
	if rec := do(t, e, http.MethodGet, "/dev/jobs/"+acc.JobID, "", nil); rec.Code != http.StatusUnauthorized {
		t.Errorf("anonymous job status = %d, want 401", rec.Code)
	}
	// Jobs are not a product surface: the old top-level path is gone.
	if rec := do(t, e, http.MethodGet, "/jobs/"+acc.JobID, "", cookie); rec.Code != http.StatusNotFound {
		t.Errorf("legacy /jobs/:jobID = %d, want 404 (jobs live under /dev)", rec.Code)
	}
}

// TestJobsListingIsDevObservability pins JOB-1's read side: an operator with no
// job id can still see the queue — a listing filtered by status plus a summary
// of every status — on the gated dev path, and it never leaks a job payload.
func TestJobsListingIsDevObservability(t *testing.T) {
	e := newTestServer()
	cookie := selectProject(t, e)

	rec := do(t, e, http.MethodPost, "/documents",
		`{"name":"D","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"x"}]}]}]}`, cookie)
	var created struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil || created.ID == "" {
		t.Fatalf("create doc: %s (%v)", rec.Body.String(), err)
	}
	// Enqueue a job whose payload carries the (internal) document id.
	if rec := do(t, e, http.MethodPost, "/dev/documents/"+created.ID+"/rebase", "", cookie); rec.Code != http.StatusAccepted {
		t.Fatalf("rebase = %d, want 202", rec.Code)
	}

	rec = do(t, e, http.MethodGet, "/dev/jobs?status=queued", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("jobs listing = %d (%s)", rec.Code, rec.Body.String())
	}
	var listing struct {
		Status string         `json:"status"`
		Limit  int            `json:"limit"`
		Counts map[string]int `json:"counts"`
		Jobs   []struct {
			ID   string `json:"id"`
			Type string `json:"type"`
		} `json:"jobs"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &listing); err != nil {
		t.Fatalf("jobs listing body = %s (%v)", rec.Body.String(), err)
	}
	if len(listing.Jobs) != 1 || listing.Jobs[0].Type != "document.rebase" {
		t.Fatalf("queued jobs = %+v, want the one rebase job", listing.Jobs)
	}
	if listing.Counts["queued"] != 1 || listing.Counts["failed"] != 0 {
		t.Errorf("counts = %+v, want queued=1 and a zero failed entry", listing.Counts)
	}
	// The payload holds internal ids and must never cross the wire.
	if strings.Contains(rec.Body.String(), created.ID) || strings.Contains(rec.Body.String(), "payload") {
		t.Errorf("jobs listing leaked a payload: %s", rec.Body.String())
	}
	// A bad filter is rejected rather than silently returning everything.
	if rec := do(t, e, http.MethodGet, "/dev/jobs?status=nonsense", "", cookie); rec.Code != http.StatusBadRequest {
		t.Errorf("unknown status filter = %d, want 400", rec.Code)
	}
	// The listing is gated like the rest of the dev path.
	if rec := do(t, e, http.MethodGet, "/dev/jobs", "", nil); rec.Code != http.StatusUnauthorized {
		t.Errorf("anonymous jobs listing = %d, want 401", rec.Code)
	}
}

// TestCollaborativeEditing proves two different users, each with their own
// session, both editing the same document in a shared project, converge on the
// same resolved document — with both edits present.
func TestCollaborativeEditing(t *testing.T) {
	e, store := newTestServerWithStore()

	// User 1: register, log in, create a project (becomes owner).
	var u1 struct {
		ID string `json:"id"`
	}
	json.Unmarshal(do(t, e, http.MethodPost, "/auth/register", `{"email":"u1@b.com","password":"password123"}`, nil).Body.Bytes(), &u1)
	c1 := sessionCookie(do(t, e, http.MethodPost, "/auth/login", `{"email":"u1@b.com","password":"password123"}`, nil))
	var proj struct {
		ID string `json:"id"`
	}
	json.Unmarshal(do(t, e, http.MethodPost, "/projects", `{"name":"Shared"}`, c1).Body.Bytes(), &proj)

	// User 2: register and log in.
	var u2 struct {
		ID string `json:"id"`
	}
	json.Unmarshal(do(t, e, http.MethodPost, "/auth/register", `{"email":"u2@b.com","password":"password123"}`, nil).Body.Bytes(), &u2)
	c2 := sessionCookie(do(t, e, http.MethodPost, "/auth/login", `{"email":"u2@b.com","password":"password123"}`, nil))

	// Grant user 2 EDIT access to the project (stands in for a future invite flow).
	if err := store.AddMembership(access.Membership{UserID: u2.ID, ProjectID: proj.ID, Role: access.RoleEdit}); err != nil {
		t.Fatal(err)
	}

	// Each user selects the project into its own session.
	for _, c := range []*http.Cookie{c1, c2} {
		if rec := do(t, e, http.MethodPost, "/session/project", `{"projectId":"`+proj.ID+`"}`, c); rec.Code != http.StatusOK {
			t.Fatalf("select project = %d (%s)", rec.Code, rec.Body.String())
		}
	}

	// User 1 creates the shared document.
	var docn struct {
		ID string `json:"id"`
	}
	json.Unmarshal(do(t, e, http.MethodPost, "/documents",
		`{"name":"Doc","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"start"}]}]}]}`, c1).Body.Bytes(), &docn)

	// User 1 edits an existing atom; user 2 (edit access) adds a new row.
	edit1 := do(t, e, http.MethodPost, "/documents/"+docn.ID+"/changes",
		`{"submissionId":"collab-user-1","expectedRevision":0,"operations":[{"op":"set_atom_text","blockId":"b1","atomId":"a1","setText":"edited by user 1"}]}`, c1)
	if edit1.Code != http.StatusCreated || !strings.Contains(edit1.Body.String(), `"authorId":"`+u1.ID+`"`) {
		t.Fatalf("user 1 edit = %d (%s)", edit1.Code, edit1.Body.String())
	}
	edit2 := do(t, e, http.MethodPost, "/documents/"+docn.ID+"/changes",
		`{"submissionId":"collab-user-2","expectedRevision":1,"operations":[{"op":"insert_row","afterRow":"r1","row":{"id":"r2","blocks":[{"id":"b2","kind":"text","atoms":[{"id":"a2","kind":"text","text":"added by user 2"}]}]}}]}`, c2)
	if edit2.Code != http.StatusCreated || !strings.Contains(edit2.Body.String(), `"authorId":"`+u2.ID+`"`) {
		t.Fatalf("user 2 edit = %d (%s)", edit2.Code, edit2.Body.String())
	}
	var user2Change document.ChangeSet
	if err := json.Unmarshal(edit2.Body.Bytes(), &user2Change); err != nil || user2Change.ID == "" {
		t.Fatalf("decode user 2 change: %s (%v)", edit2.Body.String(), err)
	}
	if rec := do(t, e, http.MethodPost,
		"/documents/"+docn.ID+"/changes/"+user2Change.ID+"/undo", "", c1); rec.Code != http.StatusForbidden {
		t.Fatalf("user 1 undid user 2 revision = %d, want 403 (%s)", rec.Code, rec.Body.String())
	}

	// Both users read the document through their own session. The two resolved
	// views are byte-identical (they converge) and contain both users' edits.
	v1 := do(t, e, http.MethodGet, "/documents/"+docn.ID, "", c1).Body.String()
	v2 := do(t, e, http.MethodGet, "/documents/"+docn.ID, "", c2).Body.String()
	if v1 != v2 {
		t.Fatalf("the two users' views diverge:\n  user1: %s\n  user2: %s", v1, v2)
	}
	if !strings.Contains(v1, "edited by user 1") || !strings.Contains(v1, "added by user 2") {
		t.Errorf("merged document is missing an edit: %s", v1)
	}
}

func TestPatchProject(t *testing.T) {
	e := newTestServer()
	do(t, e, http.MethodPost, "/auth/register", `{"email":"u@b.com","password":"password123"}`, nil)
	cookie := sessionCookie(do(t, e, http.MethodPost, "/auth/login", `{"email":"u@b.com","password":"password123"}`, nil))

	rec := do(t, e, http.MethodPost, "/projects", `{"name":"Cockpit"}`, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create = %d (%s)", rec.Code, rec.Body.String())
	}
	var created struct {
		ID string `json:"id"`
	}
	json.Unmarshal(rec.Body.Bytes(), &created)

	rec = do(t, e, http.MethodPatch, "/projects/"+created.ID, `{"name":"Renamed","icon":"intel"}`, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("patch = %d (%s)", rec.Code, rec.Body.String())
	}
	var got struct {
		Name      string `json:"name"`
		Role      string `json:"role"`
		Icon      string `json:"icon"`
		CreatedAt string `json:"createdAt"`
		UpdatedAt string `json:"updatedAt"`
	}
	json.Unmarshal(rec.Body.Bytes(), &got)
	if got.Name != "Renamed" || got.Icon != "intel" || got.Role != "owner" || got.CreatedAt == "" || got.UpdatedAt == "" {
		t.Fatalf("patched view = %+v", got)
	}

	// The list reflects the change and carries the new fields.
	rec = do(t, e, http.MethodGet, "/projects", "", cookie)
	if !strings.Contains(rec.Body.String(), `"Renamed"`) || !strings.Contains(rec.Body.String(), `"intel"`) {
		t.Fatalf("list missing patched fields: %s", rec.Body.String())
	}

	// Empty name is rejected.
	if rec := do(t, e, http.MethodPatch, "/projects/"+created.ID, `{"name":"  "}`, cookie); rec.Code != http.StatusBadRequest {
		t.Fatalf("empty-name patch = %d, want 400", rec.Code)
	}

	// A non-owner (different user) is forbidden.
	do(t, e, http.MethodPost, "/auth/register", `{"email":"other@b.com","password":"password123"}`, nil)
	other := sessionCookie(do(t, e, http.MethodPost, "/auth/login", `{"email":"other@b.com","password":"password123"}`, nil))
	if rec := do(t, e, http.MethodPatch, "/projects/"+created.ID, `{"name":"Hijack"}`, other); rec.Code != http.StatusForbidden {
		t.Fatalf("non-owner patch = %d, want 403", rec.Code)
	}
}

func TestPatchProjectPurposeRoles(t *testing.T) {
	e, store := newTestServerWithStore()
	register := func(email string) (access.User, *http.Cookie) {
		t.Helper()
		rec := do(t, e, http.MethodPost, "/auth/register", `{"email":"`+email+`","password":"password123"}`, nil)
		var user access.User
		if err := json.Unmarshal(rec.Body.Bytes(), &user); err != nil {
			t.Fatal(err)
		}
		cookie := sessionCookie(do(t, e, http.MethodPost, "/auth/login", `{"email":"`+email+`","password":"password123"}`, nil))
		return user, cookie
	}
	owner, ownerCookie := register("owner@b.com")
	editor, editorCookie := register("editor@b.com")
	reader, readerCookie := register("reader@b.com")
	rec := do(t, e, http.MethodPost, "/projects", `{"name":"Purpose"}`, ownerCookie)
	var project struct {
		ID string `json:"id"`
	}
	json.Unmarshal(rec.Body.Bytes(), &project)
	if err := store.AddMembership(access.Membership{UserID: editor.ID, ProjectID: project.ID, Role: access.RoleEdit}); err != nil {
		t.Fatal(err)
	}
	if err := store.AddMembership(access.Membership{UserID: reader.ID, ProjectID: project.ID, Role: access.RoleRead}); err != nil {
		t.Fatal(err)
	}

	rec = do(t, e, http.MethodPatch, "/projects/"+project.ID, `{"purpose":"  Make work clearer.  "}`, editorCookie)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"purpose":"Make work clearer."`) || !strings.Contains(rec.Body.String(), `"role":"edit"`) {
		t.Fatalf("editor purpose = %d %s", rec.Code, rec.Body.String())
	}
	if rec := do(t, e, http.MethodPatch, "/projects/"+project.ID, `{"purpose":"no","name":"mixed"}`, editorCookie); rec.Code != http.StatusForbidden {
		t.Fatalf("mixed editor patch = %d; want 403", rec.Code)
	}
	if rec := do(t, e, http.MethodPatch, "/projects/"+project.ID, `{"purpose":"no"}`, readerCookie); rec.Code != http.StatusForbidden {
		t.Fatalf("reader purpose = %d; want 403", rec.Code)
	}
	if rec := do(t, e, http.MethodPatch, "/projects/"+project.ID, `{}`, ownerCookie); rec.Code != http.StatusBadRequest {
		t.Fatalf("empty patch = %d; want 400", rec.Code)
	}
	longBody := `{"purpose":"` + strings.Repeat("界", access.MaxProjectPurposeRunes+1) + `"}`
	if rec := do(t, e, http.MethodPatch, "/projects/"+project.ID, longBody, ownerCookie); rec.Code != http.StatusBadRequest {
		t.Fatalf("long purpose = %d; want 400", rec.Code)
	}
	_ = owner
}

func TestUnifiedResourceLifecycle(t *testing.T) {
	e, store := newTestServerWithStore()
	cookie := selectProject(t, e)
	var current struct {
		Project struct {
			ID string `json:"id"`
		} `json:"project"`
	}
	json.Unmarshal(do(t, e, http.MethodGet, "/session/project", "", cookie).Body.Bytes(), &current)
	rec := do(t, e, http.MethodPost, "/resources", `{"kind":"document","name":"Plan"}`, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("resource create = %d %s", rec.Code, rec.Body.String())
	}
	var created struct {
		ID string `json:"id"`
	}
	json.Unmarshal(rec.Body.Bytes(), &created)
	if created.ID == "" {
		t.Fatal("resource create returned no canonical id")
	}
	if rec := do(t, e, http.MethodGet, "/resources/document/"+created.ID, "", cookie); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"name":"Plan"`) {
		t.Fatalf("resource get = %d %s", rec.Code, rec.Body.String())
	}
	rec = do(t, e, http.MethodGet, "/resources", "", cookie)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), created.ID) || !strings.Contains(rec.Body.String(), `"availableKinds":["document"]`) {
		t.Fatalf("resource list = %d %s", rec.Code, rec.Body.String())
	}
	rec = do(t, e, http.MethodPatch, "/resources/document/"+created.ID, `{"name":"Launch Plan"}`, cookie)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "Launch Plan") {
		t.Fatalf("resource rename = %d %s", rec.Code, rec.Body.String())
	}
	if rec := do(t, e, http.MethodGet, "/resources/document/"+created.ID, "", cookie); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"name":"Launch Plan"`) {
		t.Fatalf("renamed resource get = %d %s", rec.Code, rec.Body.String())
	}
	if rec := do(t, e, http.MethodGet, "/documents/"+created.ID, "", cookie); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "Launch Plan") {
		t.Fatalf("canonical document not renamed: %d %s", rec.Code, rec.Body.String())
	}
	if rec := do(t, e, http.MethodPost, "/resources", `{"kind":"slides","name":"Deck"}`, cookie); rec.Code != http.StatusConflict {
		t.Fatalf("unavailable kind = %d; want 409", rec.Code)
	}
	if rec := do(t, e, http.MethodPost, "/resources", `{"kind":"unknown","name":"X"}`, cookie); rec.Code != http.StatusBadRequest {
		t.Fatalf("unknown kind = %d; want 400", rec.Code)
	}
	readerRec := do(t, e, http.MethodPost, "/auth/register", `{"email":"reader@resources.test","password":"password123"}`, nil)
	var reader access.User
	json.Unmarshal(readerRec.Body.Bytes(), &reader)
	if err := store.AddMembership(access.Membership{UserID: reader.ID, ProjectID: current.Project.ID, Role: access.RoleRead}); err != nil {
		t.Fatal(err)
	}
	if rec := do(t, e, http.MethodGet, "/users/"+reader.ID, "", cookie); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"name":""`) || !strings.Contains(rec.Body.String(), "reader@resources.test") {
		t.Fatalf("safe member profile = %d %s", rec.Code, rec.Body.String())
	}
	readerCookie := sessionCookie(do(t, e, http.MethodPost, "/auth/login", `{"email":"reader@resources.test","password":"password123"}`, nil))
	do(t, e, http.MethodPost, "/session/project", `{"projectId":"`+current.Project.ID+`"}`, readerCookie)
	if rec := do(t, e, http.MethodGet, "/resources", "", readerCookie); rec.Code != http.StatusOK {
		t.Fatalf("read role list = %d; want 200", rec.Code)
	}
	if rec := do(t, e, http.MethodGet, "/resources/document/"+created.ID, "", readerCookie); rec.Code != http.StatusOK {
		t.Fatalf("read role get = %d; want 200", rec.Code)
	}
	if rec := do(t, e, http.MethodPost, "/resources", `{"kind":"document","name":"Denied"}`, readerCookie); rec.Code != http.StatusForbidden {
		t.Fatalf("read role create = %d; want 403", rec.Code)
	}
	if rec := do(t, e, http.MethodPatch, "/resources/document/"+created.ID, `{"name":"Denied"}`, readerCookie); rec.Code != http.StatusForbidden {
		t.Fatalf("read role rename = %d; want 403", rec.Code)
	}
	if rec := do(t, e, http.MethodDelete, "/resources/document/"+created.ID, "", readerCookie); rec.Code != http.StatusForbidden {
		t.Fatalf("read role delete = %d; want 403", rec.Code)
	}
	if rec := do(t, e, http.MethodDelete, "/resources/document/"+created.ID, "", cookie); rec.Code != http.StatusOK {
		t.Fatalf("resource delete = %d %s", rec.Code, rec.Body.String())
	}
	if rec := do(t, e, http.MethodGet, "/documents/"+created.ID, "", cookie); rec.Code != http.StatusOK {
		t.Fatalf("trashed canonical document = %d; want 200", rec.Code)
	}
	if rec := do(t, e, http.MethodGet, "/resources/document/"+created.ID, "", cookie); rec.Code != http.StatusOK {
		t.Fatalf("trashed resource get = %d; want 200", rec.Code)
	}
	if rec := do(t, e, http.MethodGet, "/resources/slides/deck", "", cookie); rec.Code != http.StatusConflict {
		t.Fatalf("unavailable resource get = %d; want 409", rec.Code)
	}
	if rec := do(t, e, http.MethodGet, "/resources/unknown/item", "", cookie); rec.Code != http.StatusBadRequest {
		t.Fatalf("unknown resource get = %d; want 400", rec.Code)
	}
}

func TestSQLiteResourceActivityAndAggregateProjectTimestampSurviveRestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "app.db")
	e, store := newSQLiteTestServer(t, path)
	do(t, e, http.MethodPost, "/auth/register", `{"email":"ada@b.com","password":"password123","name":"Ada"}`, nil)
	cookie := sessionCookie(do(t, e, http.MethodPost, "/auth/login", `{"email":"ada@b.com","password":"password123"}`, nil))
	projectRec := do(t, e, http.MethodPost, "/projects", `{"name":"Alpha"}`, cookie)
	var project struct {
		ID        string `json:"id"`
		UpdatedAt string `json:"updatedAt"`
	}
	json.Unmarshal(projectRec.Body.Bytes(), &project)
	do(t, e, http.MethodPost, "/session/project", `{"projectId":"`+project.ID+`"}`, cookie)

	createRec := do(t, e, http.MethodPost, "/resources", `{"kind":"document","name":"Plan"}`, cookie)
	var created struct {
		ID        string `json:"id"`
		UpdatedAt string `json:"updatedAt"`
	}
	json.Unmarshal(createRec.Body.Bytes(), &created)
	if createRec.Code != http.StatusCreated || created.ID == "" {
		t.Fatalf("create = %d %s", createRec.Code, createRec.Body.String())
	}
	do(t, e, http.MethodPatch, "/resources/document/"+created.ID, `{"name":"Launch Plan"}`, cookie)
	do(t, e, http.MethodDelete, "/resources/document/"+created.ID, "", cookie)

	activityRec := do(t, e, http.MethodGet, "/activity?limit=10", "", cookie)
	if activityRec.Code != http.StatusOK || !strings.Contains(activityRec.Body.String(), `"action":"trashed"`) || !strings.Contains(activityRec.Body.String(), `"name":"Ada"`) || !strings.Contains(activityRec.Body.String(), `"name":"Launch Plan"`) {
		t.Fatalf("activity = %d %s", activityRec.Code, activityRec.Body.String())
	}
	projectsRec := do(t, e, http.MethodGet, "/projects", "", cookie)
	var listed struct {
		Projects []struct {
			UpdatedAt string `json:"updatedAt"`
		} `json:"projects"`
	}
	json.Unmarshal(projectsRec.Body.Bytes(), &listed)
	profileAt, _ := time.Parse(time.RFC3339Nano, project.UpdatedAt)
	aggregateAt, _ := time.Parse(time.RFC3339Nano, listed.Projects[0].UpdatedAt)
	if !aggregateAt.After(profileAt) {
		t.Fatalf("aggregate timestamp %v did not advance beyond profile %v", aggregateAt, profileAt)
	}

	if err := store.Close(); err != nil {
		t.Fatal(err)
	}
	e, reopened := newSQLiteTestServer(t, path)
	defer reopened.Close()
	activityRec = do(t, e, http.MethodGet, "/activity?limit=10", "", cookie)
	if activityRec.Code != http.StatusOK || strings.Count(activityRec.Body.String(), `"action":`) != 3 {
		t.Fatalf("restarted activity = %d %s", activityRec.Code, activityRec.Body.String())
	}
	resourcesRec := do(t, e, http.MethodGet, "/resources", "", cookie)
	if resourcesRec.Code != http.StatusOK || !strings.Contains(resourcesRec.Body.String(), `"resources":[]`) {
		t.Fatalf("restarted resources = %d %s", resourcesRec.Code, resourcesRec.Body.String())
	}
}

func TestAuthDisplayName(t *testing.T) {
	e := newTestServer()

	// Register with a name.
	if rec := do(t, e, http.MethodPost, "/auth/register", `{"email":"ada@x.com","password":"password123","name":"Ada"}`, nil); rec.Code != http.StatusCreated {
		t.Fatalf("register = %d (%s)", rec.Code, rec.Body.String())
	}
	cookie := sessionCookie(do(t, e, http.MethodPost, "/auth/login", `{"email":"ada@x.com","password":"password123"}`, nil))

	// /auth/me reflects the name.
	rec := do(t, e, http.MethodGet, "/auth/me", "", cookie)
	var me struct {
		Name string `json:"name"`
	}
	json.Unmarshal(rec.Body.Bytes(), &me)
	if me.Name != "Ada" {
		t.Fatalf("me.name = %q; want Ada", me.Name)
	}

	// PATCH updates it (and trims).
	rec = do(t, e, http.MethodPatch, "/auth/me", `{"name":"  Ada L.  "}`, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("patch = %d (%s)", rec.Code, rec.Body.String())
	}
	json.Unmarshal(rec.Body.Bytes(), &me)
	if me.Name != "Ada L." {
		t.Fatalf("patched name = %q; want \"Ada L.\"", me.Name)
	}
}

func TestProjectMembers(t *testing.T) {
	e := newTestServer()

	// Owner registers, logs in, creates a project.
	do(t, e, http.MethodPost, "/auth/register", `{"email":"owner@b.com","password":"password123","name":"Owner"}`, nil)
	owner := sessionCookie(do(t, e, http.MethodPost, "/auth/login", `{"email":"owner@b.com","password":"password123"}`, nil))
	rec := do(t, e, http.MethodPost, "/projects", `{"name":"Cockpit"}`, owner)
	var created struct {
		ID string `json:"id"`
	}
	json.Unmarshal(rec.Body.Bytes(), &created)
	pid := created.ID

	// A second user exists.
	do(t, e, http.MethodPost, "/auth/register", `{"email":"reader@b.com","password":"password123","name":"Reader"}`, nil)
	reader := sessionCookie(do(t, e, http.MethodPost, "/auth/login", `{"email":"reader@b.com","password":"password123"}`, nil))

	// Owner adds them by email.
	rec = do(t, e, http.MethodPost, "/projects/"+pid+"/members", `{"email":"reader@b.com","role":"read"}`, owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("add member = %d (%s)", rec.Code, rec.Body.String())
	}
	var added struct {
		UserID, Name, Email, Role string
	}
	json.Unmarshal(rec.Body.Bytes(), &added)
	if added.Email != "reader@b.com" || added.Name != "Reader" || added.Role != "read" || added.UserID == "" {
		t.Fatalf("added member = %+v", added)
	}

	// The list shows both, and a member (the reader) can read it.
	rec = do(t, e, http.MethodGet, "/projects/"+pid+"/members", "", reader)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "owner@b.com") || !strings.Contains(rec.Body.String(), "reader@b.com") {
		t.Fatalf("member list = %d %s", rec.Code, rec.Body.String())
	}

	// Adding an unknown email → 404; a dup → 409; a bad role → 400.
	if rec := do(t, e, http.MethodPost, "/projects/"+pid+"/members", `{"email":"ghost@b.com","role":"read"}`, owner); rec.Code != http.StatusNotFound {
		t.Errorf("unknown email = %d, want 404", rec.Code)
	}
	if rec := do(t, e, http.MethodPost, "/projects/"+pid+"/members", `{"email":"reader@b.com","role":"read"}`, owner); rec.Code != http.StatusConflict {
		t.Errorf("dup = %d, want 409", rec.Code)
	}
	if rec := do(t, e, http.MethodPost, "/projects/"+pid+"/members", `{"email":"reader@b.com","role":"boss"}`, owner); rec.Code != http.StatusBadRequest {
		t.Errorf("bad role = %d, want 400", rec.Code)
	}

	// A non-owner (the reader) cannot add members.
	if rec := do(t, e, http.MethodPost, "/projects/"+pid+"/members", `{"email":"owner@b.com","role":"read"}`, reader); rec.Code != http.StatusForbidden {
		t.Errorf("non-owner add = %d, want 403", rec.Code)
	}

	// Owner promotes the reader to edit.
	if rec := do(t, e, http.MethodPatch, "/projects/"+pid+"/members/"+added.UserID, `{"role":"edit"}`, owner); rec.Code != http.StatusOK {
		t.Fatalf("set role = %d (%s)", rec.Code, rec.Body.String())
	}

	// The reader leaves (they're not the last owner) — success.
	if rec := do(t, e, http.MethodPost, "/projects/"+pid+"/leave", "", reader); rec.Code != http.StatusOK {
		t.Fatalf("reader leave = %d", rec.Code)
	}

	// The sole owner cannot leave → 409.
	if rec := do(t, e, http.MethodPost, "/projects/"+pid+"/leave", "", owner); rec.Code != http.StatusConflict {
		t.Fatalf("sole-owner leave = %d, want 409", rec.Code)
	}
}

func TestProjectVisibility(t *testing.T) {
	e := newTestServer()

	do(t, e, http.MethodPost, "/auth/register", `{"email":"owner@b.com","password":"password123"}`, nil)
	owner := sessionCookie(do(t, e, http.MethodPost, "/auth/login", `{"email":"owner@b.com","password":"password123"}`, nil))
	rec := do(t, e, http.MethodPost, "/projects", `{"name":"Cockpit"}`, owner)
	var created struct {
		ID         string `json:"id"`
		Visibility string `json:"visibility"`
	}
	json.Unmarshal(rec.Body.Bytes(), &created)
	if created.Visibility != "private" {
		t.Fatalf("new project visibility = %q; want private", created.Visibility)
	}
	pid := created.ID

	// Owner mints a read share link (owner-only).
	var readLink struct {
		Role  string `json:"role"`
		Token string `json:"token"`
	}
	rec = do(t, e, http.MethodPut, "/projects/"+pid+"/links/read", "", owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("mint read link = %d %s", rec.Code, rec.Body.String())
	}
	json.Unmarshal(rec.Body.Bytes(), &readLink)
	if readLink.Token == "" {
		t.Fatalf("mint read link: empty token in %s", rec.Body.String())
	}

	// A second user cannot join while the project is private (master switch off) → 404.
	do(t, e, http.MethodPost, "/auth/register", `{"email":"joiner@b.com","password":"password123","name":"Joiner"}`, nil)
	joiner := sessionCookie(do(t, e, http.MethodPost, "/auth/login", `{"email":"joiner@b.com","password":"password123"}`, nil))
	if rec := do(t, e, http.MethodPost, "/join/"+readLink.Token, "", joiner); rec.Code != http.StatusNotFound {
		t.Fatalf("join while private = %d, want 404", rec.Code)
	}

	// A bad visibility value → 400.
	if rec := do(t, e, http.MethodPatch, "/projects/"+pid, `{"visibility":"public"}`, owner); rec.Code != http.StatusBadRequest {
		t.Fatalf("bad visibility = %d, want 400", rec.Code)
	}

	// Owner turns sharing on (visibility = link); the view reflects it.
	rec = do(t, e, http.MethodPatch, "/projects/"+pid, `{"visibility":"link"}`, owner)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"visibility":"link"`) {
		t.Fatalf("set link = %d %s", rec.Code, rec.Body.String())
	}

	// Now the read link grants read membership.
	rec = do(t, e, http.MethodPost, "/join/"+readLink.Token, "", joiner)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"role":"read"`) {
		t.Fatalf("join read = %d %s", rec.Code, rec.Body.String())
	}

	// The joiner is now a real member — the project appears in their list.
	if rec := do(t, e, http.MethodGet, "/projects", "", joiner); !strings.Contains(rec.Body.String(), pid) {
		t.Fatalf("joiner project list missing the project: %s", rec.Body.String())
	}

	// An edit link upgrades the same user to edit.
	var editLink struct {
		Token string `json:"token"`
	}
	rec = do(t, e, http.MethodPut, "/projects/"+pid+"/links/edit", "", owner)
	json.Unmarshal(rec.Body.Bytes(), &editLink)
	if rec := do(t, e, http.MethodPost, "/join/"+editLink.Token, "", joiner); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"role":"edit"`) {
		t.Fatalf("upgrade to edit = %d %s", rec.Code, rec.Body.String())
	}

	// An unknown token is 404.
	if rec := do(t, e, http.MethodPost, "/join/no-such-token", "", joiner); rec.Code != http.StatusNotFound {
		t.Fatalf("unknown token = %d, want 404", rec.Code)
	}
}

func TestActivityRouteIsProjectScopedAndBounded(t *testing.T) {
	e := newTestServer()
	if rec := do(t, e, http.MethodGet, "/activity", "", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("unsigned activity = %d; want 401", rec.Code)
	}
	cookie := selectProject(t, e)
	if rec := do(t, e, http.MethodGet, "/activity", "", cookie); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"events":[]`) {
		t.Fatalf("empty activity = %d %s", rec.Code, rec.Body.String())
	}
	if rec := do(t, e, http.MethodGet, "/activity?limit=101", "", cookie); rec.Code != http.StatusBadRequest {
		t.Fatalf("large limit = %d; want 400", rec.Code)
	}
	if rec := do(t, e, http.MethodGet, "/activity?cursor=bad", "", cookie); rec.Code != http.StatusBadRequest {
		t.Fatalf("bad cursor = %d; want 400", rec.Code)
	}
}

func newTestServerWithSessions() *echo.Echo {
	store := access.NewMemoryStore()
	acc := access.New(
		access.Stores{Users: store, Sessions: store, Projects: store, Memberships: store, Links: store},
		access.Options{},
	)
	jobStore := job.NewMemoryStore()
	queue := job.NewQueue(jobStore, 0)
	docs := document.New(document.NewMemoryStore(), document.Options{Enqueuer: queue})
	activityFeed := activity.New(activity.NewMemoryStore())
	resources, _ := resource.New(testDocumentFamily{documents: docs})
	sessions := session.New(session.NewMemoryStore(), session.Options{
		StaleTimeout: 15 * time.Minute, SweepInterval: 10 * time.Minute, QueueSize: 8,
	})
	return New(Options{
		Access:    acc,
		Documents: docs,
		Activity:  activityFeed,
		Resources: resources,
		Enqueuer:  queue,
		Jobs:      jobStore,
		Sessions:  sessions,
	})
}

func TestSessionEndpoints(t *testing.T) {
	e := newTestServerWithSessions()
	cookie := selectProject(t, e)

	rec := do(t, e, http.MethodPost, "/sessions", `{"sessionId":"test-sess"}`, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("start session: %d %s", rec.Code, rec.Body.String())
	}
	var started session.Session
	json.Unmarshal(rec.Body.Bytes(), &started)
	if started.SessionID != "test-sess" {
		t.Fatalf("session ID mismatch: got %q", started.SessionID)
	}
	if started.UserEmail != "u@b.com" {
		t.Fatalf("expected userEmail u@b.com, got %q", started.UserEmail)
	}

	rec = do(t, e, http.MethodGet, "/sessions", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("list sessions: %d %s", rec.Code, rec.Body.String())
	}
	var listBody struct {
		Sessions []session.Session `json:"sessions"`
	}
	json.Unmarshal(rec.Body.Bytes(), &listBody)
	if len(listBody.Sessions) != 1 {
		t.Fatalf("expected 1 active session, got %d", len(listBody.Sessions))
	}

	rec = do(t, e, http.MethodPut, "/sessions/current",
		`{"currentDocumentId":"doc-1","caretAtomId":"a3","caretOffset":42}`, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("update session: %d %s", rec.Code, rec.Body.String())
	}

	rec = do(t, e, http.MethodGet, "/sessions", "", cookie)
	json.Unmarshal(rec.Body.Bytes(), &listBody)
	if len(listBody.Sessions) != 1 {
		t.Fatalf("session disappeared after update: %d", len(listBody.Sessions))
	}
	s := listBody.Sessions[0]
	if s.CurrentDocumentID != "doc-1" || s.CaretAtomID != "a3" || s.CaretOffset != 42 {
		t.Fatalf("caret update not persisted: %+v", s)
	}

	rec = do(t, e, http.MethodDelete, "/sessions/current", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("close session: %d %s", rec.Code, rec.Body.String())
	}

	rec = do(t, e, http.MethodGet, "/sessions", "", cookie)
	json.Unmarshal(rec.Body.Bytes(), &listBody)
	if len(listBody.Sessions) != 0 {
		t.Fatalf("expected 0 sessions after close, got %d", len(listBody.Sessions))
	}
}

func TestSessionActivityMiddleware(t *testing.T) {
	e := newTestServerWithSessions()
	cookie := selectProject(t, e)

	rec := do(t, e, http.MethodPost, "/sessions", `{}`, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("start session: %d", rec.Code)
	}

	// Capture the activity time established when the session started.
	rec = do(t, e, http.MethodGet, "/sessions", "", cookie)
	var before struct {
		Sessions []session.Session `json:"sessions"`
	}
	json.Unmarshal(rec.Body.Bytes(), &before)
	if len(before.Sessions) != 1 {
		t.Fatalf("expected 1 session after start, got %d", len(before.Sessions))
	}
	started := before.Sessions[0].LastActivityAt

	// A successful mutating, project-scoped request must bump presence through
	// the activity middleware — not only the explicit /sessions calls.
	time.Sleep(5 * time.Millisecond)
	if rec = do(t, e, http.MethodPost, "/documents",
		`{"name":"ActivityTest","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"hi"}]}]}]}`, cookie); rec.Code != http.StatusCreated {
		t.Fatalf("create document: %d %s", rec.Code, rec.Body.String())
	}

	// Let the asynchronous session consumer apply the pushed event.
	time.Sleep(20 * time.Millisecond)

	rec = do(t, e, http.MethodGet, "/sessions", "", cookie)
	var after struct {
		Sessions []session.Session `json:"sessions"`
	}
	json.Unmarshal(rec.Body.Bytes(), &after)
	if len(after.Sessions) != 1 {
		t.Fatalf("session disappeared: %d", len(after.Sessions))
	}
	if !after.Sessions[0].LastActivityAt.After(started) {
		t.Fatalf("expected last_activity_at to advance past %v after a mutating request, got %v",
			started, after.Sessions[0].LastActivityAt)
	}
}

func TestRevisionHints(t *testing.T) {
	e := newTestServerWithSessions()
	cookie := selectProject(t, e)

	rec := do(t, e, http.MethodGet, "/documents/revision-hints", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("revision hints: %d %s", rec.Code, rec.Body.String())
	}
	var hints map[string]int64
	json.Unmarshal(rec.Body.Bytes(), &hints)
	if len(hints) != 0 {
		t.Fatalf("expected 0 hints with no documents, got %d", len(hints))
	}

	rec = do(t, e, http.MethodPost, "/documents",
		`{"name":"HintDoc","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"hi"}]}]}]}`, cookie)
	var created struct {
		ID       string `json:"id"`
		Revision int64  `json:"revision"`
	}
	json.Unmarshal(rec.Body.Bytes(), &created)

	rec = do(t, e, http.MethodGet, "/documents/revision-hints", "", cookie)
	json.Unmarshal(rec.Body.Bytes(), &hints)
	rev, ok := hints[created.ID]
	if !ok {
		t.Fatalf("document %s missing from revision hints", created.ID)
	}
	if rev != created.Revision {
		t.Fatalf("expected revision %d for %s, got %d", created.Revision, created.ID, rev)
	}
}

func TestSessionWithoutAuth(t *testing.T) {
	e := newTestServerWithSessions()

	if rec := do(t, e, http.MethodGet, "/sessions", "", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("unsigned sessions = %d; want 401", rec.Code)
	}
	if rec := do(t, e, http.MethodPost, "/sessions", `{}`, nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("unsigned session start = %d; want 401", rec.Code)
	}
}

func TestDocumentDuplicate(t *testing.T) {
	e := newTestServer()
	cookie := selectProject(t, e)

	rec := do(t, e, http.MethodPost, "/documents",
		`{"name":"Report","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"original"}]}]}]}`, cookie)
	var created struct {
		ID       string `json:"id"`
		Revision int64  `json:"revision"`
		Name     string `json:"name"`
	}
	json.Unmarshal(rec.Body.Bytes(), &created)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", rec.Code, rec.Body.String())
	}

	rec = do(t, e, http.MethodPost, "/documents/"+created.ID+"/duplicate", "", cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("duplicate: %d %s", rec.Code, rec.Body.String())
	}
	var dup document.Document
	json.Unmarshal(rec.Body.Bytes(), &dup)
	if dup.ID == created.ID {
		t.Fatal("duplicate document ID matches source")
	}
	if dup.Name != "Report (1)" {
		t.Fatalf("duplicate name: got %q, want %q", dup.Name, "Report (1)")
	}
	if dup.CreatorID == "" {
		t.Fatalf("duplicate creatorId absent: %s", rec.Body.String())
	}
	if dup.Lifecycle != document.LifecycleActive {
		t.Fatalf("duplicate lifecycle: got %q", dup.Lifecycle)
	}
	if len(dup.Base.Rows) != 1 || dup.Base.Rows[0].Blocks[0].Atoms[0].Text != "original" {
		t.Fatal("duplicate content not preserved")
	}

	// Second duplicate increments the suffix.
	rec = do(t, e, http.MethodPost, "/documents/"+created.ID+"/duplicate", "", cookie)
	json.Unmarshal(rec.Body.Bytes(), &dup)
	if dup.Name != "Report (2)" {
		t.Fatalf("second duplicate name: got %q", dup.Name)
	}

	// Cross-project duplicate returns 404.
	otherCookie := otherProjectCookie(t, e)
	if rec := do(t, e, http.MethodPost, "/documents/"+created.ID+"/duplicate", "", otherCookie); rec.Code != http.StatusNotFound {
		t.Fatalf("cross-project duplicate = %d; want 404", rec.Code)
	}
}

func otherProjectCookie(t *testing.T, e *echo.Echo) *http.Cookie {
	t.Helper()
	do(t, e, http.MethodPost, "/auth/register", `{"email":"other@proj.test","password":"password123"}`, nil)
	otherCookie := sessionCookie(do(t, e, http.MethodPost, "/auth/login", `{"email":"other@proj.test","password":"password123"}`, nil))
	project := do(t, e, http.MethodPost, "/projects", `{"name":"Other Project"}`, otherCookie)
	var p struct{ ID string }
	json.Unmarshal(project.Body.Bytes(), &p)
	selectRec := do(t, e, http.MethodPost, "/session/project", `{"projectId":"`+p.ID+`"}`, otherCookie)
	if selectRec.Code != http.StatusOK {
		t.Fatalf("select other project: %d %s", selectRec.Code, selectRec.Body.String())
	}
	return otherCookie
}

func TestDocumentAnchors(t *testing.T) {
	e := newTestServer()
	cookie := selectProject(t, e)

	rec := do(t, e, http.MethodPost, "/documents",
		`{"name":"Anchored","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"hello"}]}]}]}`, cookie)
	var created struct{ ID string }
	json.Unmarshal(rec.Body.Bytes(), &created)

	rec = do(t, e, http.MethodPost, "/documents/"+created.ID+"/anchors",
		`{"rowId":"r1","blockId":"b1","atomId":"a1","start":0,"end":5}`, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create anchor: %d %s", rec.Code, rec.Body.String())
	}
	var anchor document.DocumentAnchor
	json.Unmarshal(rec.Body.Bytes(), &anchor)
	if anchor.State != document.AnchorValid || anchor.RowID != "r1" {
		t.Fatalf("anchor: %+v", anchor)
	}

	rec = do(t, e, http.MethodGet, "/documents/"+created.ID+"/anchors", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("list anchors: %d", rec.Code)
	}
	var listBody struct {
		Anchors []document.DocumentAnchor `json:"anchors"`
	}
	json.Unmarshal(rec.Body.Bytes(), &listBody)
	if len(listBody.Anchors) != 1 {
		t.Fatalf("anchors: %d", len(listBody.Anchors))
	}

	rec = do(t, e, http.MethodPost, "/documents/"+created.ID+"/anchors/"+anchor.ID+"/validate", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("validate anchor: %d %s", rec.Code, rec.Body.String())
	}

	rec = do(t, e, http.MethodDelete, "/documents/"+created.ID+"/anchors/"+anchor.ID, "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("delete anchor: %d", rec.Code)
	}

	rec = do(t, e, http.MethodGet, "/documents/"+created.ID+"/anchors", "", cookie)
	json.Unmarshal(rec.Body.Bytes(), &listBody)
	if len(listBody.Anchors) != 0 {
		t.Fatalf("anchors after delete: %d", len(listBody.Anchors))
	}
}

func newTestServerWithAgents() *echo.Echo {
	store := access.NewMemoryStore()
	acc := access.New(
		access.Stores{Users: store, Sessions: store, Projects: store, Memberships: store, Links: store},
		access.Options{},
	)
	jobStore := job.NewMemoryStore()
	queue := job.NewQueue(jobStore, 0)
	docs := document.New(document.NewMemoryStore(), document.Options{Enqueuer: queue})
	activityFeed := activity.New(activity.NewMemoryStore())
	resources, _ := resource.New(testDocumentFamily{documents: docs})
	sessions := session.New(session.NewMemoryStore(), session.Options{
		StaleTimeout: 15 * time.Minute, SweepInterval: 10 * time.Minute, QueueSize: 8,
	})
	personas, _ := persona.New(persona.NewMemoryStore(), persona.Options{})
	tasks, _ := agent.NewTasks(agent.NewMemoryTaskStore(), agent.TaskOptions{Enqueuer: queue})
	workflows, _ := agent.NewWorkflows(agent.WorkflowOptions{Tasks: tasks, Personas: personas, Intelligence: &stubIntel{}, Knowledge: &stubKnow{}, PlanningCast: testAgentCast, DefaultCast: testAgentCast, Documents: docs})
	// nil engine: the chat routes exercised here (create/get/list) never invoke a
	// model. A chat turn's model behavior is proven in the live dev-test, never
	// against a stub.
	chats, _ := chat.NewChats(chat.NewMemoryChatStore(), nil)
	return New(Options{
		Access:         acc,
		Documents:      docs,
		Activity:       activityFeed,
		Resources:      resources,
		Enqueuer:       queue,
		Jobs:           jobStore,
		Sessions:       sessions,
		AgentTasks:     tasks,
		AgentWorkflows: workflows,
		Chats:          chats,
		Personas:       personas,
	})
}

var testAgentCast = intelligence.Cast{Purpose: "general", Strength: "low", Speed: "high", Cost: "low"}

type stubIntel struct{}

func (*stubIntel) ReasonJSON(_ context.Context, _ intelligence.ReasonRequest, _ json.RawMessage) (intelligence.Result, error) {
	return intelligence.Result{}, nil
}
func (*stubIntel) ReasonWithToolsJSON(_ context.Context, _ intelligence.ToolRequest, _ json.RawMessage) (intelligence.ToolResponse, error) {
	return intelligence.ToolResponse{}, nil
}

type stubKnow struct{}

func (*stubKnow) Retrieve(_ context.Context, _, _ string, _ int) (knowledge.RetrieveResult, error) {
	return knowledge.RetrieveResult{}, nil
}
func (*stubKnow) SearchTool(_ string) intelligence.ToolBinding {
	return intelligence.ToolBinding{}
}
func (*stubKnow) ListTool(_ string) intelligence.ToolBinding {
	return intelligence.ToolBinding{}
}
func (*stubKnow) ReadTool(_ string) intelligence.ToolBinding {
	return intelligence.ToolBinding{}
}

func TestAgentTaskEndpoints(t *testing.T) {
	e := newTestServerWithAgents()
	cookie := selectProject(t, e)

	rec := do(t, e, http.MethodGet, "/agent/tasks", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("list tasks: %d %s", rec.Code, rec.Body.String())
	}

	planReq := `{"objective":"Plan the launch.","persona":{"personaId":"general"}}`
	rec = do(t, e, http.MethodPost, "/agent/plans", planReq, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create plan: %d %s", rec.Code, rec.Body.String())
	}
	var task agent.Task
	json.Unmarshal(rec.Body.Bytes(), &task)
	if task.Objective != "Plan the launch." || task.Mode != "plan" || task.State != "queued" {
		t.Fatalf("plan task: %+v", task)
	}

	rec = do(t, e, http.MethodGet, "/agent/tasks/"+task.ID, "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("get task: %d %s", rec.Code, rec.Body.String())
	}
	json.Unmarshal(rec.Body.Bytes(), &task)
	if task.Objective != "Plan the launch." {
		t.Fatalf("get returned wrong task: %+v", task)
	}

	rec = do(t, e, http.MethodGet, "/agent/tasks", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("list after create: %d", rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "\"tasks\":[") {
		t.Fatalf("list body: %s", body)
	}

	actionReq := `{"objective":"Update the doc.","persona":{"personaId":"general"}}`
	rec = do(t, e, http.MethodPost, "/agent/actions", actionReq, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create action: %d %s", rec.Code, rec.Body.String())
	}

	otherCookie := otherProjectCookie(t, e)
	rec = do(t, e, http.MethodGet, "/agent/tasks/"+task.ID, "", otherCookie)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("cross-project get: %d, want 404", rec.Code)
	}
}

func TestChatEndpoints(t *testing.T) {
	e := newTestServerWithAgents()
	cookie := selectProject(t, e)

	rec := do(t, e, http.MethodGet, "/agent/chats", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("list chats: %d %s", rec.Code, rec.Body.String())
	}

	rec = do(t, e, http.MethodPost, "/agent/chats", `{"mode":"ask","title":"Findings","resourceId":"doc-1"}`, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create chat: %d %s", rec.Code, rec.Body.String())
	}
	var ch chat.Chat
	json.Unmarshal(rec.Body.Bytes(), &ch)
	if ch.Mode != "ask" || ch.ResourceID != "doc-1" {
		t.Fatalf("chat: %+v", ch)
	}

	// Posting a turn needs the real engine and is proven in the live dev-test,
	// not here — this suite covers route wiring and project scoping only.
	rec = do(t, e, http.MethodGet, "/agent/chats/"+ch.ID, "", cookie)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"turns":`) {
		t.Fatalf("get chat: %d %s", rec.Code, rec.Body.String())
	}

	rec = do(t, e, http.MethodGet, "/agent/chats?resourceId=doc-1", "", cookie)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), ch.ID) {
		t.Fatalf("list by resource: %d %s", rec.Code, rec.Body.String())
	}

	otherCookie := otherProjectCookie(t, e)
	rec = do(t, e, http.MethodGet, "/agent/chats/"+ch.ID, "", otherCookie)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("cross-project get chat: %d, want 404", rec.Code)
	}
}

func TestPersonaEndpoints(t *testing.T) {
	e := newTestServerWithAgents()
	cookie := selectProject(t, e)

	rec := do(t, e, http.MethodGet, "/personas", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("list personas: %d %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"personas":[`) {
		t.Fatalf("personas list: %s", rec.Body.String())
	}

	rec = do(t, e, http.MethodGet, "/personas/default", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("default persona: %d %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"general"`) {
		t.Fatalf("default is not general: %s", rec.Body.String())
	}

	createReq := `{"name":"Helper","description":"A helper persona.","definition":{"behavioralGuidance":"Be helpful."}}`
	rec = do(t, e, http.MethodPost, "/personas", createReq, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create persona: %d %s", rec.Code, rec.Body.String())
	}
	var created persona.Record
	json.Unmarshal(rec.Body.Bytes(), &created)
	if created.Persona.Name != "Helper" || created.Version.Version != 1 {
		t.Fatalf("created persona: %+v", created)
	}

	rec = do(t, e, http.MethodGet, "/personas/"+created.Persona.ID, "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("get persona: %d %s", rec.Code, rec.Body.String())
	}

	updateReq := `{"expectedVersion":1,"name":"Super Helper","description":"Updated","definition":{"behavioralGuidance":"Be super helpful."}}`
	rec = do(t, e, http.MethodPut, "/personas/"+created.Persona.ID, updateReq, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("update persona: %d %s", rec.Code, rec.Body.String())
	}
	var updated persona.Record
	json.Unmarshal(rec.Body.Bytes(), &updated)
	if updated.Persona.Name != "Super Helper" || updated.Version.Version != 2 {
		t.Fatalf("updated persona: %+v", updated)
	}

	rec = do(t, e, http.MethodGet, "/personas/"+created.Persona.ID+"/versions", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("persona versions: %d %s", rec.Code, rec.Body.String())
	}

	rec = do(t, e, http.MethodGet, "/personas/"+created.Persona.ID+"/versions/1", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("persona version get: %d %s", rec.Code, rec.Body.String())
	}

	rec = do(t, e, http.MethodGet, "/personas/"+created.Persona.ID+"/tasks", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("persona tasks: %d %s", rec.Code, rec.Body.String())
	}

	setDefaultReq := `{"personaId":"` + created.Persona.ID + `"}`
	rec = do(t, e, http.MethodPut, "/personas/default", setDefaultReq, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("set default: %d %s", rec.Code, rec.Body.String())
	}

	rec = do(t, e, http.MethodGet, "/personas/default", "", cookie)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), created.Persona.ID) {
		t.Fatalf("default after set: %s", rec.Body.String())
	}

	rec = do(t, e, http.MethodDelete, "/personas/"+created.Persona.ID, "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("delete persona: %d %s", rec.Code, rec.Body.String())
	}

	rec = do(t, e, http.MethodGet, "/personas/"+created.Persona.ID, "", cookie)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("get deleted persona: %d, want 404", rec.Code)
	}
}

func TestConnectorRoutes(t *testing.T) {
	e := newTestServer()
	cookie := selectProject(t, e)

	rec := do(t, e, http.MethodPost, "/connectors", `{"name":"Sales drive","subkind":"local-folder"}`, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create connector: got %d, body %s", rec.Code, rec.Body.String())
	}
	var created struct{ ID, SubKind, Path string }
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if created.ID == "" || created.SubKind != "local-folder" {
		t.Fatalf("unexpected created connector: %+v", created)
	}

	rec = do(t, e, http.MethodPut, "/connectors/"+created.ID+"/config", `{"path":"   "}`, cookie)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("blank endpoint: got %d", rec.Code)
	}

	rec = do(t, e, http.MethodPut, "/connectors/"+created.ID+"/config", `{"path":"http://127.0.0.1:9099"}`, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("configure: got %d, body %s", rec.Code, rec.Body.String())
	}
	var configured struct{ Path string }
	json.Unmarshal(rec.Body.Bytes(), &configured)
	if configured.Path != "http://127.0.0.1:9099" {
		t.Fatalf("endpoint = %q", configured.Path)
	}

	rec = do(t, e, http.MethodGet, "/connectors/"+created.ID, "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("get: got %d", rec.Code)
	}
}

func TestConnectorSyncRoute(t *testing.T) {
	e := newTestServer()
	cookie := selectProject(t, e)

	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "notes.txt"), []byte("hello world"), 0o644); err != nil {
		t.Fatal(err)
	}

	rec := do(t, e, http.MethodPost, "/connectors", `{"name":"Drive","subkind":"local-folder"}`, cookie)
	var created struct{ ID string }
	json.Unmarshal(rec.Body.Bytes(), &created)
	do(t, e, http.MethodPut, "/connectors/"+created.ID+"/config", `{"path":"`+dir+`"}`, cookie)

	rec = do(t, e, http.MethodPost, "/connectors/"+created.ID+"/sync", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("sync: got %d, body %s", rec.Code, rec.Body.String())
	}
	var synced struct {
		Seq     int64 `json:"seq"`
		Changed bool  `json:"changed"`
	}
	json.Unmarshal(rec.Body.Bytes(), &synced)
	if !synced.Changed || synced.Seq != 1 {
		t.Fatalf("unexpected sync result: %+v", synced)
	}
}

func TestContextRoutes(t *testing.T) {
	e := newTestServer()
	cookie := selectProject(t, e)

	// Create.
	rec := do(t, e, http.MethodPost, "/contexts",
		`{"name":"Design","includes":[{"kind":"document","id":"d1","name":"Doc 1"}]}`, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create status %d body %s", rec.Code, rec.Body.String())
	}
	var created struct {
		ID       string `json:"id"`
		Name     string `json:"name"`
		Includes []struct {
			Kind, ID string
		} `json:"includes"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode create: %v", err)
	}
	if created.ID == "" || created.Name != "Design" || len(created.Includes) != 1 {
		t.Fatalf("unexpected created: %+v", created)
	}
	// List.
	rec = do(t, e, http.MethodGet, "/contexts", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("list status %d", rec.Code)
	}
	// Get.
	rec = do(t, e, http.MethodGet, "/contexts/"+created.ID, "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("get status %d", rec.Code)
	}
	// Resolved (leaf origins; d1 is a leaf so it passes through).
	rec = do(t, e, http.MethodGet, "/contexts/"+created.ID+"/resolved", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("resolved status %d body %s", rec.Code, rec.Body.String())
	}
	// Update (replace membership).
	rec = do(t, e, http.MethodPatch, "/contexts/"+created.ID,
		`{"name":"Design v2","includes":[],"excludes":[{"kind":"document","id":"d1"}]}`, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("update status %d", rec.Code)
	}
	// Resolved on a nonexistent context 404s (the subject itself must exist,
	// unlike a dangling member ref inside a real context's definition).
	rec = do(t, e, http.MethodGet, "/contexts/does-not-exist/resolved", "", cookie)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("resolved missing context status %d body %s", rec.Code, rec.Body.String())
	}
	// Delete.
	rec = do(t, e, http.MethodDelete, "/contexts/"+created.ID, "", cookie)
	if rec.Code != http.StatusOK && rec.Code != http.StatusNoContent {
		t.Fatalf("delete status %d", rec.Code)
	}
}

// --- CSRF (double-submit cookie) ------------------------------------------

// rawDo makes a request with exactly the cookies and CSRF header given, without
// the automatic double-submit token do() attaches. The CSRF tests need that
// control: they are about what happens when the cookie and header disagree.
func rawDo(t *testing.T, e *echo.Echo, method, path, body string, cookies []*http.Cookie, csrfHeader string) *httptest.ResponseRecorder {
	t.Helper()
	var r io.Reader
	if body != "" {
		r = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, r)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for _, c := range cookies {
		req.AddCookie(c)
	}
	if csrfHeader != "" {
		req.Header.Set("X-CSRF-Token", csrfHeader)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

// signIn registers and logs in one user, returning only the session cookie.
func signIn(t *testing.T, e *echo.Echo) *http.Cookie {
	t.Helper()
	do(t, e, http.MethodPost, "/auth/register", `{"email":"csrf@b.com","password":"password123"}`, nil)
	cookie := sessionCookie(do(t, e, http.MethodPost, "/auth/login", `{"email":"csrf@b.com","password":"password123"}`, nil))
	if cookie == nil {
		t.Fatal("login set no session cookie")
	}
	return cookie
}

func csrfCookie(rec *httptest.ResponseRecorder) *http.Cookie {
	for _, c := range rec.Result().Cookies() {
		if c.Name == access.CSRFCookieName {
			return c
		}
	}
	return nil
}

// TestGateIssuesCSRFCookie pins the self-healing half of the scheme: an
// authenticated request that arrives with no to_csrf cookie gets one back, so a
// session created before this defence existed acquires a token on its next call.
// The cookie must be readable by the browser client (not HttpOnly) — the client
// has to echo it in the header.
func TestGateIssuesCSRFCookie(t *testing.T) {
	e := newTestServer()
	session := signIn(t, e)

	rec := rawDo(t, e, http.MethodGet, "/auth/me", "", []*http.Cookie{session}, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /auth/me = %d (%s)", rec.Code, rec.Body.String())
	}
	issued := csrfCookie(rec)
	if issued == nil {
		t.Fatal("gate issued no to_csrf cookie")
	}
	if issued.Value == "" {
		t.Error("to_csrf cookie is empty")
	}
	if issued.HttpOnly {
		t.Error("to_csrf cookie is HttpOnly; the client must be able to read it")
	}
	if issued.Path != "/" {
		t.Errorf("to_csrf path = %q, want /", issued.Path)
	}

	// A request that already carries a token is left alone.
	rec = rawDo(t, e, http.MethodGet, "/auth/me", "", []*http.Cookie{session, issued}, "")
	if again := csrfCookie(rec); again != nil {
		t.Errorf("gate reissued to_csrf (%q) when the request already had one", again.Value)
	}
}

// TestCSRFMutationWithoutTokenIsForbidden covers the gated group: a valid
// session alone is no longer enough to mutate.
func TestCSRFMutationWithoutTokenIsForbidden(t *testing.T) {
	e := newTestServer()
	session := signIn(t, e)

	rec := rawDo(t, e, http.MethodPost, "/projects", `{"name":"P"}`, []*http.Cookie{session}, "")
	if rec.Code != http.StatusForbidden {
		t.Fatalf("POST /projects with no CSRF token = %d, want 403 (%s)", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "error") {
		t.Errorf("body = %q, want a JSON error", rec.Body.String())
	}

	// A cookie with no header is equally refused.
	token := &http.Cookie{Name: access.CSRFCookieName, Value: "abc123"}
	if rec := rawDo(t, e, http.MethodPost, "/projects", `{"name":"P"}`, []*http.Cookie{session, token}, ""); rec.Code != http.StatusForbidden {
		t.Errorf("cookie without header = %d, want 403", rec.Code)
	}
	// A header with no cookie is equally refused.
	if rec := rawDo(t, e, http.MethodPost, "/projects", `{"name":"P"}`, []*http.Cookie{session}, "abc123"); rec.Code != http.StatusForbidden {
		t.Errorf("header without cookie = %d, want 403", rec.Code)
	}
}

// TestCSRFMutationWithMismatchedTokenIsForbidden is the case the scheme exists
// for: an attacker can make the browser send the cookie, but cannot read it to
// put the same value in the header.
func TestCSRFMutationWithMismatchedTokenIsForbidden(t *testing.T) {
	e := newTestServer()
	session := signIn(t, e)
	token := &http.Cookie{Name: access.CSRFCookieName, Value: "abc123"}

	rec := rawDo(t, e, http.MethodPost, "/projects", `{"name":"P"}`, []*http.Cookie{session, token}, "guessed")
	if rec.Code != http.StatusForbidden {
		t.Fatalf("mismatched token = %d, want 403 (%s)", rec.Code, rec.Body.String())
	}
}

// TestCSRFMutationWithMatchingTokenSucceeds proves the check passes real
// traffic through — on the gated group and on the project-scoped group.
func TestCSRFMutationWithMatchingTokenSucceeds(t *testing.T) {
	e := newTestServer()
	session := signIn(t, e)
	token := &http.Cookie{Name: access.CSRFCookieName, Value: "abc123"}
	cookies := []*http.Cookie{session, token}

	rec := rawDo(t, e, http.MethodPost, "/projects", `{"name":"P"}`, cookies, "abc123")
	if rec.Code != http.StatusCreated {
		t.Fatalf("matching token on /projects = %d, want 201 (%s)", rec.Code, rec.Body.String())
	}
	var p struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &p); err != nil || p.ID == "" {
		t.Fatalf("decode project: %s (%v)", rec.Body.String(), err)
	}

	// Project-scoped group: select the project, then create a resource in it.
	if rec := rawDo(t, e, http.MethodPost, "/session/project", `{"projectId":"`+p.ID+`"}`, cookies, "abc123"); rec.Code != http.StatusOK {
		t.Fatalf("select project = %d (%s)", rec.Code, rec.Body.String())
	}
	if rec := rawDo(t, e, http.MethodPost, "/resources", `{"kind":"document","name":"Plan"}`, cookies, "abc123"); rec.Code != http.StatusCreated {
		t.Fatalf("scoped create with matching token = %d, want 201 (%s)", rec.Code, rec.Body.String())
	}
	// The scoped group is guarded too: the same call without the header fails.
	if rec := rawDo(t, e, http.MethodPost, "/resources", `{"kind":"document","name":"Plan"}`, cookies, ""); rec.Code != http.StatusForbidden {
		t.Errorf("scoped create with no header = %d, want 403", rec.Code)
	}
}

// TestCSRFSafeMethodsNeedNoToken keeps reads working: only state-changing
// methods are guarded.
func TestCSRFSafeMethodsNeedNoToken(t *testing.T) {
	e := newTestServer()
	session := signIn(t, e)

	if rec := rawDo(t, e, http.MethodGet, "/auth/me", "", []*http.Cookie{session}, ""); rec.Code != http.StatusOK {
		t.Errorf("GET /auth/me with no token = %d, want 200 (%s)", rec.Code, rec.Body.String())
	}
	if rec := rawDo(t, e, http.MethodGet, "/projects", "", []*http.Cookie{session}, ""); rec.Code != http.StatusOK {
		t.Errorf("GET /projects with no token = %d, want 200", rec.Code)
	}
}

// TestCSRFPublicRoutesNeedNoToken pins the exemption: register and login have no
// session to protect yet, so they must stay reachable with no token at all.
func TestCSRFPublicRoutesNeedNoToken(t *testing.T) {
	e := newTestServer()

	if rec := rawDo(t, e, http.MethodGet, "/healthz", "", nil, ""); rec.Code != http.StatusOK {
		t.Errorf("GET /healthz = %d, want 200", rec.Code)
	}
	if rec := rawDo(t, e, http.MethodPost, "/auth/register", `{"email":"pub@b.com","password":"password123"}`, nil, ""); rec.Code != http.StatusCreated {
		t.Fatalf("register with no token = %d, want 201 (%s)", rec.Code, rec.Body.String())
	}
	rec := rawDo(t, e, http.MethodPost, "/auth/login", `{"email":"pub@b.com","password":"password123"}`, nil, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("login with no token = %d, want 200 (%s)", rec.Code, rec.Body.String())
	}
	if sessionCookie(rec) == nil {
		t.Error("login set no session cookie")
	}
}
