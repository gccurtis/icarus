// Package job implements the job endpoints: reading a background job's status by
// id, and a bounded listing of the queue. Async endpoints hand a client a job id
// in their 202 response; the by-id endpoint lets it poll that id until the job is
// done or failed.
//
// Jobs are observability, not a product surface: they carry no owner (the jobs
// table has no user or project column), so both endpoints live under /dev,
// behind the signed-in gate, and expose only lifecycle fields — never a payload,
// which holds internal ids.
package job

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/endpoint"
	corejob "github.com/gccurtis/taurus-omega/core/platform/job"
)

// DefaultListLimit is how many jobs a listing returns when the caller does not
// ask for a size. corejob.MaxJobsPage is the hard cap above it.
const DefaultListLimit = 50

// Reader reads jobs: one by id, and a bounded status-filtered page with a
// whole-queue summary. The SQLite store satisfies it.
type Reader interface {
	JobByID(id string) (corejob.Job, error)
	JobsByStatus(status corejob.Status, limit int) ([]corejob.Job, error)
	JobCounts() (map[corejob.Status]int, error)
}

// listStatuses is every status a listing may filter on, and the fixed set the
// summary reports (zeros included) so a caller reads a stable shape.
var listStatuses = []corejob.Status{
	corejob.StatusQueued, corejob.StatusRunning, corejob.StatusDone, corejob.StatusFailed,
}

// Handlers holds the job endpoints, bound to a job Reader.
type Handlers struct {
	jobs Reader
}

// NewHandlers builds the job endpoints.
func NewHandlers(jobs Reader) Handlers { return Handlers{jobs: jobs} }

// Get returns the status of a background job by id. The job's payload is not
// exposed (it may hold internal ids); only its lifecycle fields are returned.
func (h Handlers) Get(_ access.Context, req endpoint.Request) endpoint.Response {
	j, err := h.jobs.JobByID(req.Param("jobID"))
	if errors.Is(err, corejob.ErrNotFound) {
		return errResp(http.StatusNotFound, "job not found")
	}
	if err != nil {
		return endpoint.Fail(http.StatusInternalServerError, "could not read job", err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: j}
}

// List answers the observability read: the most recent jobs, optionally
// filtered by ?status=, plus a count of every status in the queue. Without it a
// failed job is invisible — there is no way to notice a stuck queue or a run of
// failures without already holding an id. The page is bounded (?limit=, default
// DefaultListLimit, capped by the store), and each job carries only its
// lifecycle fields, since Job.Payload is never serialized.
func (h Handlers) List(_ access.Context, req endpoint.Request) endpoint.Response {
	status, ok := parseStatus(req.Query("status"))
	if !ok {
		return errResp(http.StatusBadRequest, "unknown job status")
	}
	limit := parseLimit(req.Query("limit"))

	jobs, err := h.jobs.JobsByStatus(status, limit)
	if err != nil {
		return endpoint.Fail(http.StatusInternalServerError, "could not list jobs", err)
	}
	if jobs == nil {
		jobs = []corejob.Job{}
	}
	stored, err := h.jobs.JobCounts()
	if err != nil {
		return endpoint.Fail(http.StatusInternalServerError, "could not count jobs", err)
	}
	counts := make(map[corejob.Status]int, len(listStatuses))
	for _, s := range listStatuses {
		counts[s] = stored[s]
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{
		"status": string(status),
		"limit":  limit,
		"counts": counts,
		"jobs":   jobs,
	}}
}

// parseStatus validates the optional status filter. An empty value means "any
// status"; anything not a real status is rejected rather than quietly ignored,
// so a typo does not read as "the whole queue".
func parseStatus(raw string) (corejob.Status, bool) {
	if raw == "" {
		return "", true
	}
	for _, s := range listStatuses {
		if raw == string(s) {
			return s, true
		}
	}
	return "", false
}

// parseLimit resolves the page size: a positive number as asked, capped at the
// store's page bound; anything else (absent, unparseable, non-positive) falls
// back to the default.
func parseLimit(raw string) int {
	n, err := strconv.Atoi(raw)
	if err != nil || n < 1 {
		return DefaultListLimit
	}
	if n > corejob.MaxJobsPage {
		return corejob.MaxJobsPage
	}
	return n
}

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": msg}}
}
