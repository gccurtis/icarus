// Dispatch: how an operation is executed once it is past the gate.
//
// This file holds the operation → execution-mode classification (sync,
// deferred, or serialized per key), the tables that record it, and the adapters
// that carry each mode out: the per-key serial lock, the sync/async/serial
// chooser the route table calls, and the job-enqueueing async adapter.
package transport

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

// executionMode classifies how an operation is dispatched once it is past the
// gate. The axis that separates these is not whether the response is synchronous
// — it is **where the work lives and how long it survives**:
//
//	concurrent  work lives on the request goroutine, dies with the request
//	serial      the same, but ordered against other work on the same key
//	deferred    work lives in the database, outliving the request and the process
//
// Only the deferred mode needs a queue, which is why there is exactly one. The
// other two are request paths, not queues: Go's goroutine-per-request is the
// concurrency, and SQLite's bounded connection pool is the natural backpressure.
// The process serves multiple users and projects, but request goroutines plus
// bounded downstream pools already provide the applicable concurrency controls;
// a second in-process scheduler would add latency without becoming a correctness
// authority.
type executionMode int

const (
	// dispatchConcurrent runs the operation inline, on the request's own
	// goroutine, and answers when it is done. Independent requests already run in
	// parallel, so this needs no machinery at all — it is the default path.
	dispatchConcurrent executionMode = iota
	// dispatchDeferred hands the operation to the durable job queue and answers
	// immediately with 202 and a job id, which the caller polls.
	//
	// This exists for work that must outlive its request: resolving a prompt block
	// is a model call, then retrieval, then a second model call. No HTTP request
	// should be held open for that, and if the process dies mid-run the work must
	// be retried rather than lost — which is what makes the queue durable rather
	// than merely asynchronous. Durability, not the 202, is the point.
	dispatchDeferred
	// dispatchSerial runs the operation inline, like dispatchConcurrent, but first
	// takes a lock on a key derived from the request, so requests sharing a key run
	// one at a time while different keys stay parallel.
	//
	// This is the general mode for any operation that must not interleave with
	// itself — typically a write against one resource. It is deliberately not tied
	// to any resource type: operationSerialKey maps an operation to an arbitrary
	// func(endpoint.Request) string, so a new serial op needs one entry there and
	// one in operationMode. Document writes are simply the operations that need it
	// today; a spreadsheet or slide write would register the same way, keyed by its
	// own id.
	//
	// It is a contention optimisation, not the correctness boundary: the store's
	// revision-checked append is what actually orders writes, including across
	// processes. Removing the lock would cost wasted conflict/rebase cycles, not
	// correctness.
	dispatchSerial
)

// operationMode is the hardcoded operation → synctype map: the single source of
// truth for which operations are handled synchronously, which serialize, and
// which are deferred to the job queue. Reads and mutations that carry a
// synchronous contract (a returned body, an immediate 409) are sync; document
// writes serialize by document id; background maintenance is async.
//
// It is the **complete** inventory of the access-scoped surface: every scoped
// route is installed through dispatchScoped, which panics at startup on an
// operation missing from this table (or registered twice). So the answer to
// "which operations are concurrent, serial, or deferred?" is this map alone —
// not the map plus a scattering of bare adapter call sites.
//
// Names are `<capability>.<verb>`, where the verb is the handler method in
// snake_case, sub-namespaced (`documents.history.list`, `agent.tasks.list`)
// where the method name alone would be ambiguous.
var operationMode = map[string]executionMode{
	// Identity and session.
	"auth.me":          dispatchConcurrent,
	"auth.update_name": dispatchConcurrent,
	"auth.logout":      dispatchConcurrent,
	"users.get":        dispatchConcurrent,

	// Jobs: dev-path observability over the queue itself (see routes.go).
	"jobs.get":  dispatchConcurrent,
	"jobs.list": dispatchConcurrent,

	// Projects: management, membership, invite links, and selection.
	"projects.list":            dispatchConcurrent,
	"projects.create":          dispatchConcurrent,
	"projects.update":          dispatchConcurrent,
	"projects.delete":          dispatchConcurrent,
	"projects.leave":           dispatchConcurrent,
	"projects.links":           dispatchConcurrent,
	"projects.rotate_link":     dispatchConcurrent,
	"projects.delete_link":     dispatchConcurrent,
	"projects.join_by_token":   dispatchConcurrent,
	"projects.members":         dispatchConcurrent,
	"projects.add_member":      dispatchConcurrent,
	"projects.set_member_role": dispatchConcurrent,
	"projects.remove_member":   dispatchConcurrent,
	"projects.select":          dispatchConcurrent,
	"projects.current":         dispatchConcurrent,
	"identities.resolve":       dispatchConcurrent,

	// Organizations: the tier above a Project.
	"organizations.create":        dispatchConcurrent,
	"organizations.list":          dispatchConcurrent,
	"organizations.rename":        dispatchConcurrent,
	"organizations.members":       dispatchConcurrent,
	"organizations.add_member":    dispatchConcurrent,
	"organizations.set_role":      dispatchConcurrent,
	"organizations.remove_member": dispatchConcurrent,

	// Intelligence: model calls answered inline (the caller waits on the model).
	"intelligence.reason": dispatchConcurrent,
	"intelligence.infer":  dispatchConcurrent,
	"intelligence.embed":  dispatchConcurrent,

	// Formula names: the project-scoped name manager and evaluation.
	"names.list":         dispatchConcurrent,
	"names.get":          dispatchConcurrent,
	"names.delete":       dispatchConcurrent,
	"names.set_value":    dispatchConcurrent,
	"names.create_table": dispatchConcurrent,
	"names.set_table":    dispatchConcurrent,
	"names.set_function": dispatchConcurrent,
	"names.add_column":   dispatchConcurrent,
	"names.append_rows":  dispatchConcurrent,
	"names.evaluate":     dispatchConcurrent,

	// Presence sessions, activity, and notification drains.
	"sessions.start":                dispatchConcurrent,
	"sessions.close":                dispatchConcurrent,
	"sessions.update":               dispatchConcurrent,
	"sessions.list":                 dispatchConcurrent,
	"activity.list":                 dispatchConcurrent,
	"notifications.drain":           dispatchConcurrent,
	"collaboration.get":             dispatchConcurrent,
	"collaboration.put_presence":    dispatchConcurrent,
	"collaboration.delete_presence": dispatchConcurrent,

	// The unified resource catalog.
	"resources.get":              dispatchConcurrent,
	"resources.list":             dispatchConcurrent,
	"resources.create":           dispatchConcurrent,
	"resources.rename":           dispatchConcurrent,
	"resources.delete":           dispatchConcurrent,
	"resources.patch_attributes": dispatchConcurrent,
	"resources.patch_access":     dispatchConcurrent,
	"resources.generate":         dispatchConcurrent,

	// Connectors and contexts.
	"connectors.create":    dispatchConcurrent,
	"connectors.get":       dispatchConcurrent,
	"connectors.configure": dispatchConcurrent,
	"connectors.sync":      dispatchConcurrent,
	"connectors.files":     dispatchConcurrent,
	"contexts.create":      dispatchConcurrent,
	"contexts.list":        dispatchConcurrent,
	"contexts.get":         dispatchConcurrent,
	"contexts.resolved":    dispatchConcurrent,
	"contexts.update":      dispatchConcurrent,
	"contexts.delete":      dispatchConcurrent,

	// Documents: reads and metadata are concurrent, the three writes serialize by
	// document id, and the two maintenance/inference operations are deferred.
	"documents.list":            dispatchConcurrent,
	"documents.create":          dispatchConcurrent,
	"documents.get":             dispatchConcurrent,
	"documents.rename":          dispatchConcurrent,
	"documents.delete":          dispatchConcurrent,
	"documents.restore":         dispatchConcurrent,
	"documents.purge":           dispatchConcurrent,
	"documents.duplicate":       dispatchConcurrent,
	"documents.diff":            dispatchConcurrent,
	"documents.create_anchor":   dispatchConcurrent,
	"documents.list_anchors":    dispatchConcurrent,
	"documents.delete_anchor":   dispatchConcurrent,
	"documents.validate_anchor": dispatchConcurrent,
	"documents.append_changes":  dispatchSerial,
	"documents.descriptor":      dispatchConcurrent,
	"documents.row_manifest":    dispatchConcurrent,
	"documents.rows":            dispatchConcurrent,
	"documents.rows_locate":     dispatchConcurrent,
	"documents.export":          dispatchConcurrent,
	"documents.import":          dispatchConcurrent,
	"documents.templates":       dispatchConcurrent,
	"documents.revision_hints":  dispatchConcurrent,
	"documents.history.list":    dispatchConcurrent,
	"documents.history.get":     dispatchConcurrent,
	"documents.undo":            dispatchSerial,
	"documents.redo":            dispatchSerial,
	"documents.rebase":          dispatchDeferred,
	"documents.resolve":         dispatchDeferred,

	// The document graph and its anchored discussion.
	"references.list":      dispatchConcurrent,
	"references.backlinks": dispatchConcurrent,
	"comments.list":        dispatchConcurrent,
	"comments.create":      dispatchConcurrent,
	"comments.patch":       dispatchConcurrent,
	"comments.delete":      dispatchConcurrent,
	"comments.reply":       dispatchConcurrent,

	// Files: uploads and downloads stream inline under their own body cap.
	"files.upload":   dispatchConcurrent,
	"files.download": dispatchConcurrent,
	"files.meta":     dispatchConcurrent,

	// Agent tasks and chats. The durable Task queue is the agent capability's
	// own; from the transport's side these calls answer inline.
	"agent.tasks.list":        dispatchConcurrent,
	"agent.tasks.get":         dispatchConcurrent,
	"agent.plans.create":      dispatchConcurrent,
	"agent.plans.accept":      dispatchConcurrent,
	"agent.actions.create":    dispatchConcurrent,
	"chats.create":            dispatchConcurrent,
	"chats.list":              dispatchConcurrent,
	"chats.get":               dispatchConcurrent,
	"chats.post_turn":         dispatchConcurrent,
	"chats.set_persona":       dispatchConcurrent,
	"chats.add_attachment":    dispatchConcurrent,
	"chats.list_attachments":  dispatchConcurrent,
	"chats.delete_attachment": dispatchConcurrent,

	// Per-user workspace state and Project-local personas.
	"workspace.get":        dispatchConcurrent,
	"workspace.put":        dispatchConcurrent,
	"personas.list":        dispatchConcurrent,
	"personas.create":      dispatchConcurrent,
	"personas.default":     dispatchConcurrent,
	"personas.set_default": dispatchConcurrent,
	"personas.get":         dispatchConcurrent,
	"personas.update":      dispatchConcurrent,
	"personas.delete":      dispatchConcurrent,
	"personas.revise":      dispatchConcurrent,
	"personas.versions":    dispatchConcurrent,
	"personas.get_version": dispatchConcurrent,
	"personas.tasks":       dispatchConcurrent,

	// Knowledge: dev-path lattice tooling.
	"knowledge.add_document":     dispatchConcurrent,
	"knowledge.remove_document":  dispatchConcurrent,
	"knowledge.retrieve":         dispatchConcurrent,
	"knowledge.reembed.preview":  dispatchConcurrent,
	"knowledge.reembed.start":    dispatchConcurrent,
	"knowledge.reembed.status":   dispatchConcurrent,
	"knowledge.reembed.pause":    dispatchConcurrent,
	"knowledge.reembed.resume":   dispatchConcurrent,
	"knowledge.reembed.cancel":   dispatchConcurrent,
	"knowledge.reembed.promote":  dispatchConcurrent,
	"knowledge.reembed.rollback": dispatchConcurrent,
}

// operationSerialKey holds the key function for every operation classified
// dispatchSerial: it derives the serialization key from the request, so
// requests sharing a key serialize. An operation classified dispatchSerial must
// have an entry here, and only such operations may — dispatchScoped panics at
// startup on either mismatch, so the two tables cannot silently disagree.
//
// Document writes (append, undo, redo) serialize by document id, so concurrent
// edits to one document within a process do not interleave. Different documents
// hold different keys and run in parallel.
var operationSerialKey = map[string]func(endpoint.Request) string{
	"documents.append_changes": serialKeyByParam("documentID"),
	"documents.undo":           serialKeyByParam("documentID"),
	"documents.redo":           serialKeyByParam("documentID"),
}

// serialKeyByParam builds a serial key function that reads a path parameter (for
// document writes, the document id) as the serialization key.
func serialKeyByParam(name string) func(endpoint.Request) string {
	return func(r endpoint.Request) string { return r.Param(name) }
}

// deferredSpec describes how an async operation becomes a job: the job type to
// enqueue, an authorization predicate, and how to build the job payload from the
// resolved context and request.
type deferredSpec struct {
	jobType    string
	authorized func(access.Context) bool
	payload    func(access.Context, endpoint.Request) any
}

// adaptSerialScoped turns an access-scoped handler into an echo.HandlerFunc that
// first acquires the per-key serial lock (key derived from the request), runs
// the handler inline, and answers synchronously. Requests sharing a key run one
// at a time; different keys run in parallel.
func (s *server) adaptSerialScoped(h access.ScopedHandler, key func(endpoint.Request) string) echo.HandlerFunc {
	return func(c echo.Context) error {
		ctx, _ := c.Get(ctxKey).(access.Context)
		req := buildRequest(c)
		unlock := s.serial.Lock(key(req))
		defer unlock()
		return writeResponse(c, h(ctx, req))
	}
}

// dispatchScoped installs a scoped operation, choosing sync, serial, or async
// handling from operationMode. A sync operation runs its handler inline; a
// serial one takes its per-key lock first; an async one enqueues a job from its
// deferredSpec. The classification lives in the map, so the wiring here and the map
// cannot silently disagree — every mismatch panics while the routes are being
// built, which is at process start, so a mistake never reaches a request.
//
// Three invariants are enforced here, and together they are what makes
// operationMode a trustworthy inventory rather than a partial index:
//
//  1. every installed operation is classified in operationMode (an unknown name
//     is a typo or a route added without a table entry);
//  2. no operation is installed twice, so one name means one route;
//  3. the mode and the serial-key table agree, and each mode has what it needs
//     (a handler, or an deferredSpec).
//
// Registration happens once per server while New builds the route table, on one
// goroutine, so the registered set needs no lock.
func (s *server) dispatchScoped(op string, sync access.ScopedHandler, async *deferredSpec) echo.HandlerFunc {
	mode, classified := operationMode[op]
	if !classified {
		panic("transport: operation " + op + " is not classified in operationMode")
	}
	if s.registered == nil {
		s.registered = make(map[string]bool)
	}
	if s.registered[op] {
		panic("transport: operation " + op + " is installed on more than one route")
	}
	s.registered[op] = true
	if _, hasKey := operationSerialKey[op]; hasKey && mode != dispatchSerial {
		panic("transport: operation " + op + " has a serial key but is not classified dispatchSerial")
	}
	switch mode {
	case dispatchDeferred:
		if async == nil {
			panic("transport: async operation " + op + " wired without an deferredSpec")
		}
		return s.adaptDeferred(*async)
	case dispatchSerial:
		if sync == nil {
			panic("transport: serial operation " + op + " wired without a handler")
		}
		key, ok := operationSerialKey[op]
		if !ok {
			panic("transport: serial operation " + op + " wired without a serial key function")
		}
		return s.adaptSerialScoped(sync, key)
	default:
		if sync == nil {
			panic("transport: sync operation " + op + " wired without a handler")
		}
		return s.adaptScoped(sync)
	}
}

// adaptDeferred handles an async operation: it authorizes the request, enqueues a
// job built from the spec, and answers 202 with the job id for the client to
// poll at /dev/jobs/:jobID.
func (s *server) adaptDeferred(spec deferredSpec) echo.HandlerFunc {
	return func(c echo.Context) error {
		ctx, _ := c.Get(ctxKey).(access.Context)
		if spec.authorized != nil && !spec.authorized(ctx) {
			return writeResponse(c, endpoint.Response{
				Status: http.StatusForbidden,
				Body:   map[string]string{"error": "not permitted"},
			})
		}
		j, err := s.enqueuer.Enqueue(c.Request().Context(), spec.jobType, spec.payload(ctx, buildRequest(c)))
		if err != nil {
			return writeResponse(c, endpoint.Response{
				Status: http.StatusInternalServerError,
				Body:   map[string]string{"error": "could not enqueue job"},
			})
		}
		return writeResponse(c, endpoint.Response{
			Status: http.StatusAccepted,
			Body:   map[string]any{"jobId": j.ID, "status": string(j.Status)},
		})
	}
}
