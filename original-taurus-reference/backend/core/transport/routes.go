// Routes: the route table.
//
// This file holds New, which builds the Echo instance, installs the global
// middleware, and maps every URL onto an imported application handler. It is
// the one place the whole HTTP surface is visible, split into a public group
// and the gated and project-scoped groups behind requireUser/requireProject.
package transport

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"golang.org/x/time/rate"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/capability/resource"
	"github.com/gccurtis/taurus-omega/core/endpoint"
	activityapp "github.com/gccurtis/taurus-omega/core/handlers/activity"
	agentapp "github.com/gccurtis/taurus-omega/core/handlers/agent"
	authapp "github.com/gccurtis/taurus-omega/core/handlers/auth"
	chatapp "github.com/gccurtis/taurus-omega/core/handlers/chat"
	collaborationapp "github.com/gccurtis/taurus-omega/core/handlers/collaboration"
	commentapp "github.com/gccurtis/taurus-omega/core/handlers/comment"
	connectorapp "github.com/gccurtis/taurus-omega/core/handlers/connector"
	contextapp "github.com/gccurtis/taurus-omega/core/handlers/context"
	documentapp "github.com/gccurtis/taurus-omega/core/handlers/document"
	echoapp "github.com/gccurtis/taurus-omega/core/handlers/echo"
	fileapp "github.com/gccurtis/taurus-omega/core/handlers/file"
	"github.com/gccurtis/taurus-omega/core/handlers/healthz"
	identityapp "github.com/gccurtis/taurus-omega/core/handlers/identity"
	intelligenceapp "github.com/gccurtis/taurus-omega/core/handlers/intelligence"
	jobapp "github.com/gccurtis/taurus-omega/core/handlers/job"
	knowledgeapp "github.com/gccurtis/taurus-omega/core/handlers/knowledge"
	nameapp "github.com/gccurtis/taurus-omega/core/handlers/name"
	notificationapp "github.com/gccurtis/taurus-omega/core/handlers/notification"
	organizationapp "github.com/gccurtis/taurus-omega/core/handlers/organization"
	personaapp "github.com/gccurtis/taurus-omega/core/handlers/persona"
	projectapp "github.com/gccurtis/taurus-omega/core/handlers/project"
	referenceapp "github.com/gccurtis/taurus-omega/core/handlers/reference"
	resourceapp "github.com/gccurtis/taurus-omega/core/handlers/resource"
	sessionapp "github.com/gccurtis/taurus-omega/core/handlers/session"
	userapp "github.com/gccurtis/taurus-omega/core/handlers/user"
	workspaceapp "github.com/gccurtis/taurus-omega/core/handlers/workspace"
	"github.com/gccurtis/taurus-omega/core/transport/requestlog"
)

// New builds the Echo instance with its middleware and routes. It is kept
// separate from composition so tests can exercise the handlers without starting
// a listener.
func New(opts Options) *echo.Echo {
	e := echo.New()
	e.HideBanner = true

	e.Use(middleware.Recover())
	// The default body cap applies everywhere except the file-upload route, which
	// carries its own larger cap (registered as route middleware below).
	e.Use(middleware.BodyLimitWithConfig(middleware.BodyLimitConfig{
		Limit: maxBodySize,
		Skipper: func(c echo.Context) bool {
			return c.Request().Method == http.MethodPost && c.Path() == "/files"
		},
	}))
	e.Use(middleware.SecureWithConfig(middleware.SecureConfig{
		ContentTypeNosniff: "nosniff",
		XFrameOptions:      "DENY",
		HSTSMaxAge:         hstsMaxAge,
	}))
	if opts.LogRequests {
		e.Use(requestlog.Middleware(requestlog.LogSink))
	}

	s := &server{access: opts.Access, enqueuer: opts.Enqueuer}
	auth := authapp.NewHandlers(opts.Access)
	users := userapp.NewHandlers(opts.Access)
	projects := projectapp.NewHandlers(opts.Access)
	if opts.Activity != nil {
		projects = projectapp.NewHandlers(opts.Access, opts.Activity)
	}
	jobs := jobapp.NewHandlers(opts.Jobs)

	// Throttle the credential endpoints per client IP to blunt online
	// brute-force and credential-stuffing attacks.
	authLimiter := middleware.RateLimiter(middleware.NewRateLimiterMemoryStoreWithConfig(
		middleware.RateLimiterMemoryStoreConfig{Rate: rate.Limit(5), Burst: 10, ExpiresIn: 3 * time.Minute},
	))

	// Public: reachable with no user.
	e.GET("/healthz", adapt(healthz.Handle))
	e.POST("/auth/register", adapt(auth.Register), authLimiter)
	e.POST("/auth/login", adapt(auth.Login), authLimiter)

	// Gated: everything else requires a signed-in user — and, on a mutating
	// method, the double-submit CSRF token the gate issued (see requireCSRF).
	gated := e.Group("", s.requireUser, requireCSRF)
	gated.GET("/auth/me", s.dispatchScoped("auth.me", auth.Me, nil))
	gated.PATCH("/auth/me", s.dispatchScoped("auth.update_name", auth.UpdateName, nil))
	gated.POST("/auth/logout", s.dispatchScoped("auth.logout", auth.Logout, nil))

	// Background jobs are observability, not a product surface, so they live on
	// the dev path: the queue is process-wide (the jobs table carries no user or
	// project column), and job status was only ever authorized by possession of
	// the opaque id. Both routes stay gated, so a signed-in user is still
	// required. Status polls one id — the one an async endpoint handed out — and
	// the listing makes a stuck queue or a run of failures visible to an operator
	// who holds no id at all.
	gated.GET("/dev/jobs/:jobID", s.dispatchScoped("jobs.get", jobs.Get, nil))
	gated.GET("/dev/jobs", s.dispatchScoped("jobs.list", jobs.List, nil))

	// Project management and selection.
	gated.GET("/projects", s.dispatchScoped("projects.list", projects.List, nil))
	gated.POST("/projects", s.dispatchScoped("projects.create", projects.Create, nil))
	gated.PATCH("/projects/:projectID", s.dispatchScoped("projects.update", projects.Update, nil))
	gated.DELETE("/projects/:projectID", s.dispatchScoped("projects.delete", projects.Delete, nil))
	gated.POST("/projects/:projectID/leave", s.dispatchScoped("projects.leave", projects.Leave, nil))
	gated.GET("/projects/:projectID/links", s.dispatchScoped("projects.links", projects.Links, nil))
	gated.PUT("/projects/:projectID/links/:role", s.dispatchScoped("projects.rotate_link", projects.RotateLink, nil))
	gated.DELETE("/projects/:projectID/links/:role", s.dispatchScoped("projects.delete_link", projects.DeleteLink, nil))
	gated.POST("/join/:token", s.dispatchScoped("projects.join_by_token", projects.JoinByToken, nil))
	gated.GET("/projects/:projectID/members", s.dispatchScoped("projects.members", projects.Members, nil))
	gated.POST("/projects/:projectID/members", s.dispatchScoped("projects.add_member", projects.AddMember, nil))
	gated.PATCH("/projects/:projectID/members/:userID", s.dispatchScoped("projects.set_member_role", projects.SetMemberRole, nil))
	gated.DELETE("/projects/:projectID/members/:userID", s.dispatchScoped("projects.remove_member", projects.RemoveMember, nil))
	// Batch identity resolver: mixed user/persona references → public profile cards.
	gated.POST("/projects/:projectID/identities/resolve",
		s.dispatchScoped("identities.resolve", identityapp.NewHandlers(opts.Access, opts.Personas).Resolve, nil))
	gated.POST("/session/project", s.dispatchScoped("projects.select", projects.Select, nil))
	gated.GET("/session/project", s.dispatchScoped("projects.current", projects.Current, nil))
	if opts.Organizations != nil {
		orgs := organizationapp.NewHandlers(opts.Organizations)
		gated.POST("/organizations", s.dispatchScoped("organizations.create", orgs.Create, nil))
		gated.GET("/organizations", s.dispatchScoped("organizations.list", orgs.List, nil))
		gated.PATCH("/organizations/:orgID", s.dispatchScoped("organizations.rename", orgs.Rename, nil))
		gated.GET("/organizations/:orgID/members", s.dispatchScoped("organizations.members", orgs.Members, nil))
		gated.POST("/organizations/:orgID/members", s.dispatchScoped("organizations.add_member", orgs.AddMember, nil))
		gated.PATCH("/organizations/:orgID/members/:userID", s.dispatchScoped("organizations.set_role", orgs.SetRole, nil))
		gated.DELETE("/organizations/:orgID/members/:userID", s.dispatchScoped("organizations.remove_member", orgs.RemoveMember, nil))
	}

	gated.POST("/echo", adapt(echoapp.Handle))

	// Intelligence: reasoning, inference, and embedding by semantic cast. Gated
	// like the rest; only registered when a service was supplied.
	if opts.Intelligence != nil {
		intel := intelligenceapp.NewHandlers(opts.Intelligence)
		gated.POST("/intelligence/reason", s.dispatchScoped("intelligence.reason", intel.Reason, nil))
		gated.POST("/intelligence/infer", s.dispatchScoped("intelligence.infer", intel.Infer, nil))
		gated.POST("/intelligence/embed", s.dispatchScoped("intelligence.embed", intel.Embed, nil))
	}

	// Names: the formula name-manager's endpoints, scoped by :projectID in the
	// path rather than the session's selected project, since a caller may act
	// on a project's names without it being their current selection. Gated
	// like the rest; only registered when a manager was supplied.
	if opts.Names != nil {
		nameHandlers := nameapp.NewHandlers(opts.Access, opts.Names)
		gated.GET("/projects/:projectID/names", s.dispatchScoped("names.list", nameHandlers.List, nil))
		gated.GET("/projects/:projectID/names/:name", s.dispatchScoped("names.get", nameHandlers.Get, nil))
		gated.DELETE("/projects/:projectID/names/:name", s.dispatchScoped("names.delete", nameHandlers.Delete, nil))
		gated.PUT("/projects/:projectID/names/:name/value", s.dispatchScoped("names.set_value", nameHandlers.SetValue, nil))
		gated.POST("/projects/:projectID/names/:name/table", s.dispatchScoped("names.create_table", nameHandlers.CreateTable, nil))
		gated.PUT("/projects/:projectID/names/:name/table", s.dispatchScoped("names.set_table", nameHandlers.SetTable, nil))
		gated.PUT("/projects/:projectID/names/:name/function", s.dispatchScoped("names.set_function", nameHandlers.SetFunction, nil))
		gated.POST("/projects/:projectID/names/:name/columns", s.dispatchScoped("names.add_column", nameHandlers.AddColumn, nil))
		gated.POST("/projects/:projectID/names/:name/rows", s.dispatchScoped("names.append_rows", nameHandlers.AppendRows, nil))
		gated.POST("/projects/:projectID/evaluate", s.dispatchScoped("names.evaluate", nameHandlers.Evaluate, nil))
	}

	// Project-scoped: a project must be selected. These operate on the selected
	// project's resources. Each route names an operation whose handling (sync or
	// async) is looked up in operationMode — sync ones run inline, async ones
	// enqueue a job.
	// docAccess is the per-document access-scope check the by-id and listing
	// routes apply, so a document restricted within a project is neither listed
	// nor replied-to by an excluded member. nil when access scoping is not
	// configured, which disables the narrowing.
	var docAccess func(callerID, projectID, documentID string) (bool, error)
	if opts.Resources != nil {
		docAccess = func(callerID, projectID, documentID string) (bool, error) {
			return opts.Resources.CanAccessResource(callerID, projectID, resource.KindDocument, documentID)
		}
	}
	documents := documentapp.NewHandlers(opts.Documents, docAccess)
	scoped := e.Group("", s.requireProject, requireCSRF)
	if opts.Resources != nil {
		// Enforce per-resource access on every direct document route in one place:
		// the same CanAccessResource resolver the catalog uses (the "direct path
		// underneath"), so a document restricted in the catalog cannot be opened,
		// edited, or read by URL either. Deeper paths (comments, agent tools) are a
		// documented follow-up.
		scoped.Use(s.documentAccessGuard(opts.Resources))
	}
	if opts.Sessions != nil {
		scoped.Use(sessionActivity(opts.Sessions))
		sessHandlers := sessionapp.NewHandlers(opts.Sessions)
		scoped.POST("/sessions", s.dispatchScoped("sessions.start", sessHandlers.Start, nil))
		scoped.DELETE("/sessions/current", s.dispatchScoped("sessions.close", sessHandlers.Close, nil))
		scoped.PUT("/sessions/current", s.dispatchScoped("sessions.update", sessHandlers.Update, nil))
		scoped.GET("/sessions", s.dispatchScoped("sessions.list", sessHandlers.List, nil))
	}
	scoped.GET("/users/:userID", s.dispatchScoped("users.get", users.Get, nil))
	if opts.Activity != nil {
		activityHandlers := activityapp.NewHandlers(opts.Activity)
		scoped.GET("/activity", s.dispatchScoped("activity.list", activityHandlers.List, nil))
	}
	if opts.Notifications != nil {
		notificationHandlers := notificationapp.NewHandlers(opts.Notifications)
		scoped.GET("/notifications", s.dispatchScoped("notifications.drain", notificationHandlers.Drain, nil))
	}
	if opts.Resources != nil {
		resources := resourceapp.NewHandlers(opts.Resources, opts.ResourceGenerator)
		scoped.GET("/resources/:kind/:resourceID", s.dispatchScoped("resources.get", resources.Get, nil))
		scoped.GET("/resources", s.dispatchScoped("resources.list", resources.List, nil))
		scoped.POST("/resources", s.dispatchScoped("resources.create", resources.Create, nil))
		scoped.PATCH("/resources/:kind/:resourceID", s.dispatchScoped("resources.rename", resources.Rename, nil))
		scoped.DELETE("/resources/:kind/:resourceID", s.dispatchScoped("resources.delete", resources.Delete, nil))
		// Catalog attributes (pin to top).
		scoped.PATCH("/resources/:kind/:resourceID/attributes", s.dispatchScoped("resources.patch_attributes", resources.PatchAttributes, nil))
		scoped.PATCH("/resources/:kind/:resourceID/access", s.dispatchScoped("resources.patch_access", resources.PatchAccess, nil))
		// Create with AI: create a resource then populate it via an agent Action.
		scoped.POST("/resources/generate", s.dispatchScoped("resources.generate", resources.Generate, nil))
	}
	if opts.Connectors != nil {
		conns := connectorapp.NewHandlers(opts.Connectors)
		scoped.POST("/connectors", s.dispatchScoped("connectors.create", conns.Create, nil))
		scoped.GET("/connectors/:connectorID", s.dispatchScoped("connectors.get", conns.Get, nil))
		scoped.PUT("/connectors/:connectorID/config", s.dispatchScoped("connectors.configure", conns.Configure, nil))
		scoped.POST("/connectors/:connectorID/sync", s.dispatchScoped("connectors.sync", conns.Sync, nil))
		scoped.GET("/connectors/:connectorID/files", s.dispatchScoped("connectors.files", conns.Files, nil))
	}
	if opts.Contexts != nil {
		ctxs := contextapp.NewHandlers(opts.Contexts)
		scoped.POST("/contexts", s.dispatchScoped("contexts.create", ctxs.Create, nil))
		scoped.GET("/contexts", s.dispatchScoped("contexts.list", ctxs.List, nil))
		scoped.GET("/contexts/:contextID", s.dispatchScoped("contexts.get", ctxs.Get, nil))
		scoped.GET("/contexts/:contextID/resolved", s.dispatchScoped("contexts.resolved", ctxs.Resolved, nil))
		scoped.PATCH("/contexts/:contextID", s.dispatchScoped("contexts.update", ctxs.Update, nil))
		scoped.DELETE("/contexts/:contextID", s.dispatchScoped("contexts.delete", ctxs.Delete, nil))
	}
	scoped.GET("/documents", s.dispatchScoped("documents.list", documents.List, nil))
	scoped.POST("/documents", s.dispatchScoped("documents.create", documents.Create, nil))
	scoped.GET("/documents/:documentID", s.dispatchScoped("documents.get", documents.Get, nil))
	scoped.PATCH("/documents/:documentID", s.dispatchScoped("documents.rename", documents.Rename, nil))
	scoped.DELETE("/documents/:documentID", s.dispatchScoped("documents.delete", documents.Delete, nil))
	scoped.POST("/documents/:documentID/restore", s.dispatchScoped("documents.restore", documents.Restore, nil))
	scoped.DELETE("/documents/:documentID/purge", s.dispatchScoped("documents.purge", documents.Purge, nil))
	scoped.POST("/documents/:documentID/duplicate", s.dispatchScoped("documents.duplicate", documents.Duplicate, nil))
	scoped.GET("/documents/:documentID/diff", s.dispatchScoped("documents.diff", documents.Diff, nil))
	scoped.POST("/documents/:documentID/anchors", s.dispatchScoped("documents.create_anchor", documents.CreateAnchor, nil))
	scoped.GET("/documents/:documentID/anchors", s.dispatchScoped("documents.list_anchors", documents.ListAnchors, nil))
	scoped.DELETE("/documents/:documentID/anchors/:anchorID", s.dispatchScoped("documents.delete_anchor", documents.DeleteAnchor, nil))
	scoped.POST("/documents/:documentID/anchors/:anchorID/validate", s.dispatchScoped("documents.validate_anchor", documents.ValidateAnchor, nil))
	scoped.POST("/documents/:documentID/changes", s.dispatchScoped("documents.append_changes", documents.AppendChanges, nil))
	if opts.Presence != nil && opts.Activity != nil {
		collab := collaborationapp.NewHandlers(opts.Documents, opts.Activity, opts.Presence)
		scoped.GET("/documents/:documentID/collaboration", s.dispatchScoped("collaboration.get", collab.Get, nil))
		scoped.PUT("/documents/:documentID/presence", s.dispatchScoped("collaboration.put_presence", collab.PutPresence, nil))
		scoped.DELETE("/documents/:documentID/presence", s.dispatchScoped("collaboration.delete_presence", collab.DeletePresence, nil))
	}
	scoped.GET("/documents/:documentID/history", s.dispatchScoped("documents.history.list", documents.History, nil))
	scoped.GET("/documents/:documentID/history/:changeSetID", s.dispatchScoped("documents.history.get", documents.GetChangeSet, nil))
	scoped.POST("/documents/:documentID/changes/:changeSetID/undo", s.dispatchScoped("documents.undo", documents.Undo, nil))
	scoped.POST("/documents/:documentID/changes/:changeSetID/redo", s.dispatchScoped("documents.redo", documents.Redo, nil))
	scoped.GET("/documents/revision-hints", s.dispatchScoped("documents.revision_hints", documents.RevisionHints, nil))
	// Template library: documents marked as reusable templates.
	scoped.GET("/documents/templates", s.dispatchScoped("documents.templates", documents.Templates, nil))
	// Windowed row reads for bounded large-document loading: a body-less
	// descriptor and a row manifest lay out the scroll region, then row windows
	// and locate page in content. Every response is revision-stamped.
	scoped.GET("/documents/:documentID/descriptor", s.dispatchScoped("documents.descriptor", documents.Descriptor, nil))
	scoped.GET("/documents/:documentID/row-manifest", s.dispatchScoped("documents.row_manifest", documents.RowManifest, nil))
	scoped.GET("/documents/:documentID/rows", s.dispatchScoped("documents.rows", documents.Rows, nil))
	scoped.GET("/documents/:documentID/rows/locate", s.dispatchScoped("documents.rows_locate", documents.RowsLocate, nil))
	// Markdown export (pdf/docx are follow-ups).
	scoped.GET("/documents/:documentID/export", s.dispatchScoped("documents.export", documents.Export, nil))
	// Import a document from an uploaded Markdown file (needs the file store).
	if opts.Files != nil {
		imports := documentapp.NewImportHandlers(opts.Documents, opts.Files)
		scoped.POST("/documents/import", s.dispatchScoped("documents.import", imports.Import, nil))
	}
	// Reference graph: a document's outgoing references and its backlinks, derived
	// from the inline links each document carries.
	if opts.References != nil {
		refs := referenceapp.NewHandlers(opts.References)
		scoped.GET("/documents/:documentID/references", s.dispatchScoped("references.list", refs.References, nil))
		scoped.GET("/documents/:documentID/backlinks", s.dispatchScoped("references.backlinks", refs.Backlinks, nil))
	}
	// Anchored comments: threads pinned to a document anchor, with replies and a
	// resolved state. List/create are document-scoped; patch/delete/reply address
	// a comment by id (the service re-checks project ownership).
	if opts.Comments != nil {
		comments := commentapp.NewHandlers(opts.Comments, docAccess)
		scoped.GET("/documents/:documentID/comments", s.dispatchScoped("comments.list", comments.List, nil))
		scoped.POST("/documents/:documentID/comments", s.dispatchScoped("comments.create", comments.Create, nil))
		scoped.PATCH("/comments/:commentID", s.dispatchScoped("comments.patch", comments.Patch, nil))
		scoped.DELETE("/comments/:commentID", s.dispatchScoped("comments.delete", comments.Delete, nil))
		scoped.POST("/comments/:commentID/replies", s.dispatchScoped("comments.reply", comments.Reply, nil))
	}
	// Files: project-scoped binary uploads (base64), binary download, and
	// metadata. Upload carries the larger body cap; the global limit skips it.
	if opts.Files != nil {
		files := fileapp.NewHandlers(opts.Files)
		scoped.POST("/files", s.dispatchScoped("files.upload", files.Upload, nil), middleware.BodyLimit(uploadMaxBodySize))
		scoped.GET("/files/:fileID", s.dispatchScoped("files.download", files.Download, nil))
		scoped.GET("/files/:fileID/meta", s.dispatchScoped("files.meta", files.Meta, nil))
	}
	// Resolving a prompt block is inference-heavy (plan + retrieve + synthesize),
	// so it is dispatched async: enqueue a job and return 202 + a job id. The
	// resolve mode (reload / refresh; empty = auto) comes from the request body.
	scoped.POST("/documents/:documentID/blocks/:blockID/resolve", s.dispatchScoped("documents.resolve", nil, &deferredSpec{
		jobType:    document.JobTypeResolve,
		authorized: func(ctx access.Context) bool { return ctx.Role.CanWrite() },
		payload: func(ctx access.Context, req endpoint.Request) any {
			var in struct {
				Mode string `json:"mode"`
			}
			_ = req.Bind(&in)
			return map[string]string{
				"projectId":  ctx.Project.ID,
				"documentId": req.Param("documentID"),
				"blockId":    req.Param("blockID"),
				"mode":       in.Mode,
			}
		},
	}))

	// Agent routes: durable Plan/Action tasks and their lifecycle.
	if opts.AgentTasks != nil && opts.AgentWorkflows != nil {
		agents := agentapp.NewHandlers(opts.AgentTasks, opts.AgentWorkflows)
		scoped.GET("/agent/tasks", s.dispatchScoped("agent.tasks.list", agents.List, nil))
		scoped.POST("/agent/plans", s.dispatchScoped("agent.plans.create", agents.CreatePlan, nil))
		scoped.POST("/agent/actions", s.dispatchScoped("agent.actions.create", agents.CreateAction, nil))
		scoped.GET("/agent/tasks/:taskID", s.dispatchScoped("agent.tasks.get", agents.Get, nil))
		scoped.POST("/agent/tasks/:taskID/plans/:planID/accept", s.dispatchScoped("agent.plans.accept", agents.AcceptPlan, nil))
	}
	// Chats: persistent, project-scoped AI conversations (their own capability,
	// driven through an engine adapter the composition root supplies).
	if opts.Chats != nil {
		chats := chatapp.NewHandlers(opts.Chats, opts.Files, opts.MaxAttachmentDirectoryFiles)
		scoped.POST("/agent/chats", s.dispatchScoped("chats.create", chats.Create, nil))
		scoped.GET("/agent/chats", s.dispatchScoped("chats.list", chats.List, nil))
		scoped.GET("/agent/chats/:chatID", s.dispatchScoped("chats.get", chats.Get, nil))
		scoped.POST("/agent/chats/:chatID/turns", s.dispatchScoped("chats.post_turn", chats.PostTurn, nil))
		scoped.PATCH("/agent/chats/:chatID/persona", s.dispatchScoped("chats.set_persona", chats.SetPersona, nil))
		if opts.Files != nil {
			scoped.POST("/agent/chats/:chatID/attachments", s.dispatchScoped("chats.add_attachment", chats.AddAttachment, nil))
			scoped.GET("/agent/chats/:chatID/attachments", s.dispatchScoped("chats.list_attachments", chats.ListAttachments, nil))
			scoped.DELETE("/agent/chats/:chatID/attachments/:attachmentID", s.dispatchScoped("chats.delete_attachment", chats.DeleteAttachment, nil))
		}
	}
	// Workspace routes: a user's opaque per-project cockpit state (personal UI
	// state, not project content), keyed by user × project.
	if opts.Workspaces != nil {
		ws := workspaceapp.NewHandlers(opts.Workspaces)
		scoped.GET("/workspace", s.dispatchScoped("workspace.get", ws.Get, nil))
		scoped.PUT("/workspace", s.dispatchScoped("workspace.put", ws.Put, nil))
	}
	// Persona routes: Project-local behavior profiles, defaults, and task history.
	if opts.Personas != nil && opts.AgentTasks != nil {
		personas := personaapp.NewHandlers(opts.Personas, opts.AgentTasks)
		scoped.GET("/personas", s.dispatchScoped("personas.list", personas.List, nil))
		scoped.POST("/personas", s.dispatchScoped("personas.create", personas.Create, nil))
		scoped.GET("/personas/default", s.dispatchScoped("personas.default", personas.Default, nil))
		scoped.PUT("/personas/default", s.dispatchScoped("personas.set_default", personas.SetDefault, nil))
		scoped.GET("/personas/:personaID", s.dispatchScoped("personas.get", personas.Get, nil))
		scoped.PUT("/personas/:personaID", s.dispatchScoped("personas.update", personas.Update, nil))
		scoped.DELETE("/personas/:personaID", s.dispatchScoped("personas.delete", personas.Delete, nil))
		scoped.POST("/personas/:personaID/revisions", s.dispatchScoped("personas.revise", personas.Revise, nil))
		scoped.GET("/personas/:personaID/versions", s.dispatchScoped("personas.versions", personas.Versions, nil))
		scoped.GET("/personas/:personaID/versions/:version", s.dispatchScoped("personas.get_version", personas.GetVersion, nil))
		scoped.GET("/personas/:personaID/tasks", s.dispatchScoped("personas.tasks", personas.Tasks, nil))
	}

	// Dev-only, project-scoped endpoints. The /dev prefix marks operations that are
	// not part of the production client surface (maintenance and lattice tooling).
	// Re-basing a document is background maintenance dispatched async: the request
	// enqueues a job and gets 202 + a job id to poll.
	scoped.POST("/dev/documents/:documentID/rebase", s.dispatchScoped("documents.rebase", nil, &deferredSpec{
		jobType:    document.JobTypeRebase,
		authorized: func(ctx access.Context) bool { return ctx.Role.CanWrite() },
		payload: func(ctx access.Context, req endpoint.Request) any {
			return map[string]string{"projectId": ctx.Project.ID, "documentId": req.Param("documentID")}
		},
	}))
	if opts.Knowledge != nil {
		know := knowledgeapp.NewHandlers(opts.Documents, opts.Knowledge, opts.FlattenDocument)
		scoped.POST("/dev/knowledge/documents/:documentID", s.dispatchScoped("knowledge.add_document", know.AddDocument, nil))
		scoped.DELETE("/dev/knowledge/documents/:documentID", s.dispatchScoped("knowledge.remove_document", know.RemoveDocument, nil))
		scoped.POST("/dev/knowledge/retrieve", s.dispatchScoped("knowledge.retrieve", know.Retrieve, nil))
		scoped.POST("/dev/knowledge/reembed/preview", s.dispatchScoped("knowledge.reembed.preview", know.PreviewReembed, nil))
		scoped.POST("/dev/knowledge/reembed/runs", s.dispatchScoped("knowledge.reembed.start", know.StartReembed, nil))
		scoped.GET("/dev/knowledge/reembed/runs/:runID", s.dispatchScoped("knowledge.reembed.status", know.ReembedStatus, nil))
		scoped.POST("/dev/knowledge/reembed/runs/:runID/pause", s.dispatchScoped("knowledge.reembed.pause", know.PauseReembed, nil))
		scoped.POST("/dev/knowledge/reembed/runs/:runID/resume", s.dispatchScoped("knowledge.reembed.resume", know.ResumeReembed, nil))
		scoped.POST("/dev/knowledge/reembed/runs/:runID/cancel", s.dispatchScoped("knowledge.reembed.cancel", know.CancelReembed, nil))
		scoped.POST("/dev/knowledge/reembed/runs/:runID/promote", s.dispatchScoped("knowledge.reembed.promote", know.PromoteReembed, nil))
		scoped.POST("/dev/knowledge/reembed/rollback", s.dispatchScoped("knowledge.reembed.rollback", know.RollbackReembed, nil))
	}

	// An unknown path is Not Found — say so.
	//
	// This has to be registered last, and it is not decoration. Echo's Group
	// attaches a catch-all ("/*") carrying the group's middleware so that group
	// middleware still runs for paths the router does not match. Both of our
	// groups are declared with an empty prefix, so their catch-alls cover the
	// WHOLE API surface, and the last one registered wins: every unknown URL was
	// being answered by requireProject with 409 "select a project first" instead
	// of 404. Registering our own catch-all after them restores the honest
	// answer — an address that does not exist reports that it does not exist,
	// rather than reporting on the caller's session state.
	e.Any("/*", func(c echo.Context) error {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "not found"})
	})

	return e
}
