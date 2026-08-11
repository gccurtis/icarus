package job_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/endpoint"
	jobapp "github.com/gccurtis/taurus-omega/core/handlers/job"
	corejob "github.com/gccurtis/taurus-omega/core/platform/job"
)

// fakeReader records what the handler asked the store for and hands back a
// canned page, so the handler's own decisions (defaults, bounds, validation)
// are what the test observes.
type fakeReader struct {
	jobs      []corejob.Job
	counts    map[corejob.Status]int
	gotStatus corejob.Status
	gotLimit  int
}

func (f *fakeReader) JobByID(id string) (corejob.Job, error) {
	for _, j := range f.jobs {
		if j.ID == id {
			return j, nil
		}
	}
	return corejob.Job{}, corejob.ErrNotFound
}

func (f *fakeReader) JobsByStatus(status corejob.Status, limit int) ([]corejob.Job, error) {
	f.gotStatus, f.gotLimit = status, limit
	return f.jobs, nil
}

func (f *fakeReader) JobCounts() (map[corejob.Status]int, error) { return f.counts, nil }

// query builds a request whose only inputs are query parameters.
func query(params map[string]string) endpoint.Request {
	return endpoint.Request{
		Param: func(string) string { return "" },
		Query: func(name string) string { return params[name] },
	}
}

// TestListFiltersByStatus pins the observability read: ?status=failed is passed
// through to the store, and the response carries both the matching jobs and the
// whole-queue summary, so a run of failures is visible without holding an id.
func TestListFiltersByStatus(t *testing.T) {
	now := time.Now().UTC()
	reader := &fakeReader{
		jobs: []corejob.Job{
			{ID: "j2", Type: "document.rebase", Status: corejob.StatusFailed, LastError: "boom", CreatedAt: now},
			{ID: "j1", Type: "document.resolve", Status: corejob.StatusFailed, CreatedAt: now.Add(-time.Hour)},
		},
		counts: map[corejob.Status]int{corejob.StatusFailed: 2, corejob.StatusQueued: 3},
	}
	resp := jobapp.NewHandlers(reader).List(access.Context{}, query(map[string]string{"status": "failed"}))
	if resp.Status != http.StatusOK {
		t.Fatalf("status = %d, want 200 (%v)", resp.Status, resp.Body)
	}
	if reader.gotStatus != corejob.StatusFailed {
		t.Errorf("store asked for status %q, want %q", reader.gotStatus, corejob.StatusFailed)
	}

	var got struct {
		Status string         `json:"status"`
		Limit  int            `json:"limit"`
		Counts map[string]int `json:"counts"`
		Jobs   []struct {
			ID        string `json:"id"`
			Type      string `json:"type"`
			Status    string `json:"status"`
			LastError string `json:"lastError"`
		} `json:"jobs"`
	}
	raw, err := json.Marshal(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Jobs) != 2 || got.Jobs[0].ID != "j2" || got.Jobs[0].LastError != "boom" {
		t.Fatalf("jobs = %+v, want the two failed jobs newest first", got.Jobs)
	}
	// The summary covers every status, including ones with no jobs, so a caller
	// reads a fixed shape.
	for _, want := range []struct {
		status string
		n      int
	}{{"failed", 2}, {"queued", 3}, {"running", 0}, {"done", 0}} {
		if n, ok := got.Counts[want.status]; !ok || n != want.n {
			t.Errorf("counts[%s] = %d (present=%v), want %d", want.status, n, ok, want.n)
		}
	}
	if got.Status != "failed" {
		t.Errorf("echoed status = %q, want failed", got.Status)
	}
}

// TestListNeverExposesPayload guards the one leak that matters: a job payload
// holds internal ids, so only lifecycle fields may cross the wire.
func TestListNeverExposesPayload(t *testing.T) {
	reader := &fakeReader{
		jobs: []corejob.Job{{
			ID: "j1", Type: "document.rebase", Status: corejob.StatusQueued,
			Payload: json.RawMessage(`{"projectId":"p-secret","documentId":"d-secret"}`),
		}},
	}
	resp := jobapp.NewHandlers(reader).List(access.Context{}, query(nil))
	raw, err := json.Marshal(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "secret") || strings.Contains(string(raw), "payload") {
		t.Fatalf("payload leaked into the jobs listing: %s", raw)
	}
}

// TestListDefaultsAndBounds pins the request shape: no status means "any", the
// limit defaults when absent or unparseable, and an over-large limit is capped
// at the queue's page bound.
func TestListDefaultsAndBounds(t *testing.T) {
	for _, tc := range []struct {
		name  string
		limit string
		want  int
	}{
		{"absent", "", jobapp.DefaultListLimit},
		{"garbage", "abc", jobapp.DefaultListLimit},
		{"zero", "0", jobapp.DefaultListLimit},
		{"explicit", "7", 7},
		{"over the cap", "100000", corejob.MaxJobsPage},
	} {
		t.Run(tc.name, func(t *testing.T) {
			reader := &fakeReader{}
			params := map[string]string{}
			if tc.limit != "" {
				params["limit"] = tc.limit
			}
			resp := jobapp.NewHandlers(reader).List(access.Context{}, query(params))
			if resp.Status != http.StatusOK {
				t.Fatalf("status = %d, want 200", resp.Status)
			}
			if reader.gotLimit != tc.want {
				t.Errorf("store limit = %d, want %d", reader.gotLimit, tc.want)
			}
			if reader.gotStatus != "" {
				t.Errorf("store status = %q, want any", reader.gotStatus)
			}
		})
	}
}

// TestListRejectsUnknownStatus keeps the filter honest: a typo must say so
// rather than silently return the whole queue.
func TestListRejectsUnknownStatus(t *testing.T) {
	reader := &fakeReader{}
	resp := jobapp.NewHandlers(reader).List(access.Context{}, query(map[string]string{"status": "borked"}))
	if resp.Status != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.Status)
	}
	if reader.gotLimit != 0 {
		t.Errorf("store was queried despite the bad status")
	}
}

// TestListReturnsAnEmptyArray keeps the empty case a list, not null, so a client
// can iterate it unconditionally.
func TestListReturnsAnEmptyArray(t *testing.T) {
	resp := jobapp.NewHandlers(&fakeReader{}).List(access.Context{}, query(nil))
	raw, err := json.Marshal(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), `"jobs":[]`) {
		t.Fatalf("empty listing = %s, want an empty jobs array", raw)
	}
}
