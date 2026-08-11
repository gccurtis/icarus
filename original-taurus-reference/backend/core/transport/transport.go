// Package transport sets up the HTTP transport layer. It builds the Echo
// instance, installs middleware, and maps each route to an imported application
// handler through small adapters, translating between Echo and the neutral
// endpoint contract.
//
// It is also where access is enforced: routes are split into a public group
// (health, register, login) and a gated group that the requireUser middleware
// (see gate.go) blocks unless the session resolves to a user.
package transport

import (
	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/capability/activity"
	"github.com/gccurtis/taurus-omega/core/capability/agent"
	"github.com/gccurtis/taurus-omega/core/capability/chat"
	"github.com/gccurtis/taurus-omega/core/capability/comment"
	"github.com/gccurtis/taurus-omega/core/capability/connector"
	contextscap "github.com/gccurtis/taurus-omega/core/capability/contexts"
	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/capability/file"
	"github.com/gccurtis/taurus-omega/core/capability/formula/names"
	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/capability/notification"
	"github.com/gccurtis/taurus-omega/core/capability/organization"
	"github.com/gccurtis/taurus-omega/core/capability/persona"
	"github.com/gccurtis/taurus-omega/core/capability/presence"
	"github.com/gccurtis/taurus-omega/core/capability/reference"
	"github.com/gccurtis/taurus-omega/core/capability/resource"
	"github.com/gccurtis/taurus-omega/core/capability/session"
	"github.com/gccurtis/taurus-omega/core/capability/workspace"
	jobapp "github.com/gccurtis/taurus-omega/core/handlers/job"
	resourceapp "github.com/gccurtis/taurus-omega/core/handlers/resource"
	"github.com/gccurtis/taurus-omega/core/platform/dispatch"
	"github.com/gccurtis/taurus-omega/core/platform/job"
)

// Server-wide limits and hardening constants.
const (
	// maxBodySize caps request bodies, both as a DoS guard and so the request
	// logger never buffers an unbounded body.
	maxBodySize = "1M"
	// uploadMaxBodySize is the larger cap applied only to file uploads, whose
	// base64 body legitimately exceeds the default 1M. It still bounds the body,
	// so a single upload can never be unbounded.
	uploadMaxBodySize = "32M"
	// hstsMaxAge is the HTTP Strict-Transport-Security max-age (one year).
	hstsMaxAge = 31536000
)

// Options are the transport settings the composition layer supplies.
type Options struct {
	// Access is the access service used to resolve sessions and enforce the gate.
	Access *access.Access
	// Documents is the document resource service backing the document routes.
	Documents *document.Documents
	// Activity backs the selected Project's semantic activity feed.
	Activity *activity.Activity
	// Notifications backs the caller's ephemeral toast drain. When nil, the
	// /notifications route is not registered.
	Notifications *notification.Notifications
	// Organizations backs the above-Project /organizations routes. When nil, those
	// routes are not registered.
	Organizations *organization.Organizations
	// Resources backs the unified selected-Project resource catalog.
	Resources *resource.Resources

	// Connectors backs connector-specific creation and configuration (provider
	// subkind + config) beyond the generic resource catalog.
	Connectors *connector.Connectors
	// Contexts backs the project-scoped /contexts routes. When nil, those routes
	// are not registered.
	Contexts *contextscap.Contexts
	// Enqueuer schedules the deferred operations (see operationMode) onto the job
	// queue. Required if any deferred operation is routed.
	Enqueuer job.Enqueuer
	// Jobs reads the background-job queue for the dev-path observability
	// endpoints: /dev/jobs/:jobID (one job's status) and /dev/jobs (the listing).
	Jobs jobapp.Reader
	// Intelligence backs the /intelligence/* routes. When nil, those routes are
	// not registered.
	Intelligence *intelligence.Intelligence
	// Knowledge backs the (dev) /dev/knowledge/* routes. When nil, those routes
	// are not registered.
	Knowledge *knowledge.Knowledge
	// FlattenDocument renders a document as the text the lattice indexes, with its
	// block map. It travels as an option because the composition root owns the
	// definition — whole-source reads flatten again to serve themselves, and the two
	// must not disagree about what a document's text is.
	//
	// Spelled as a raw signature rather than the handler package's named type so this
	// options struct keeps importing no handler package; the two are assignable.
	FlattenDocument func(document.Document) (string, []knowledge.BlockSpan)
	// Names backs the /projects/:projectID/names/* and
	// /projects/:projectID/evaluate routes. When nil, those routes are not
	// registered.
	Names *names.Manager
	// Sessions backs the /sessions/* presence routes. When nil, session
	// routes and activity middleware are not registered.
	Sessions *session.Sessions
	// AgentTasks and AgentWorkflows back durable Quarterback Plan/Action routes.
	AgentTasks     *agent.Tasks
	AgentWorkflows *agent.Workflows
	// Chats backs the /agent/chats/* persistent conversation routes. Chat is its
	// own capability; when nil, those routes are not registered.
	Chats *chat.Chats
	// MaxAttachmentDirectoryFiles bounds how many files one directory-manifest
	// chat attachment upload may carry. Zero means unbounded.
	MaxAttachmentDirectoryFiles int
	// References backs the document reference/backlink routes. When nil, those
	// routes are not registered.
	References *reference.References
	// Comments backs the anchored document-comment routes. When nil, those routes
	// are not registered.
	Comments *comment.Comments
	// Files backs the file upload/download/meta routes. When nil, those routes are
	// not registered.
	Files *file.Files
	// Workspaces backs the per-user /workspace state routes. When nil, those routes
	// are not registered.
	Workspaces *workspace.Workspaces
	// Presence backs the ephemeral per-document presence behind the collaboration
	// projection. When nil, the collaboration/presence routes are not registered.
	Presence *presence.Presence
	// ResourceGenerator backs "Create with AI" (POST /resources/generate). When
	// nil, that route reports generation is not configured.
	ResourceGenerator resourceapp.ResourceGenerator
	// Personas backs Project-local Persona management, defaults, and Task
	// attribution routes.
	Personas *persona.Personas
	// LogRequests enables structured request/response logging.
	LogRequests bool
}

// server carries the transport's dependencies for use by middleware and adapters.
type server struct {
	access   *access.Access
	enqueuer job.Enqueuer
	// serial serializes requests for operations in the dispatchSerial mode, keyed
	// by the operation's serial key (e.g. document id). Its zero value is ready.
	serial dispatch.KeyedMutex
	// registered names every operation already installed on a route, so
	// dispatchScoped can refuse a second route for the same operation. It is
	// written only while New builds the route table (one goroutine, at startup),
	// never per request.
	registered map[string]bool
}
