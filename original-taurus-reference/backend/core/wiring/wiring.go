// Package wiring is the composition root: it loads configuration, creates
// the application's initial objects — including the access objects the transport
// layer enforces — and owns the process lifecycle (startup, signal handling, and
// graceful shutdown). main is a thin shell over Run.
//
// It also selects the composition path from the configured mode. The core always
// serves HTTPS: in dev it generates a self-signed certificate when none is
// configured, while prod requires a real certificate and refuses to start
// without one.
package wiring

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/capability/activity"
	"github.com/gccurtis/taurus-omega/core/capability/agent"
	"github.com/gccurtis/taurus-omega/core/capability/chat"
	"github.com/gccurtis/taurus-omega/core/capability/comment"
	"github.com/gccurtis/taurus-omega/core/capability/connector"
	"github.com/gccurtis/taurus-omega/core/capability/contexts"
	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/capability/file"
	"github.com/gccurtis/taurus-omega/core/capability/formula"
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
	"github.com/gccurtis/taurus-omega/core/integration/context/web"
	"github.com/gccurtis/taurus-omega/core/platform/config"
	"github.com/gccurtis/taurus-omega/core/platform/job"
	"github.com/gccurtis/taurus-omega/core/platform/logging"
	"github.com/gccurtis/taurus-omega/core/platform/memory"
	"github.com/gccurtis/taurus-omega/core/platform/storage/sqlite"
	"github.com/gccurtis/taurus-omega/core/platform/telemetry"
	"github.com/gccurtis/taurus-omega/core/transport"
)

// defaultConfigPath is where the default manifest lives, relative to the working
// directory. Override it with the TAURUS_OMEGA_CONFIG environment variable.
const defaultConfigPath = "etc/config.yaml"

// defaultDevCert / defaultDevKey are where dev mode writes a self-signed
// certificate when the manifest does not point at one.
const (
	defaultDevCert = "var/dev-cert.pem"
	defaultDevKey  = "var/dev-key.pem"
)

// Run loads configuration, opens durable storage, builds the access objects,
// resolves the TLS certificate for the selected mode, wires up the server, and
// blocks until the process is signalled to stop, then shuts it down gracefully.
func Run() {
	cfg := loadConfig()

	// Direct logs where the config says: a file in logging.dir, or stderr when
	// empty. Do this early so everything after the config load is captured.
	logOut, logCloser, err := logOutput(cfg.Logging.Dir)
	if err != nil {
		log.Fatalf("logging: %v", err)
	}
	log.SetOutput(logOut)
	if logCloser != nil {
		defer logCloser.Close()
	}

	if cfg.Mode != config.ModeProd && cfg.Mode != config.ModeDev {
		log.Fatalf("config: invalid mode %q (want %q or %q)", cfg.Mode, config.ModeProd, config.ModeDev)
	}

	certPath, keyPath := resolveTLS(cfg)

	ttl, err := time.ParseDuration(cfg.Access.SessionTTL)
	if err != nil {
		log.Fatalf("config: invalid access.session_ttl %q: %v", cfg.Access.SessionTTL, err)
	}

	// One durable SQLite store backs every resource — users, sessions, projects,
	// memberships, and documents — so all of them survive a restart.
	store, err := sqlite.Open(cfg.Storage.DSN)
	if err != nil {
		log.Fatalf("storage: %v", err)
	}
	defer store.Close()
	log.Printf("storage: opened %s", cfg.Storage.DSN)

	acc := access.New(
		access.Stores{Users: store, Sessions: store, Projects: store, Memberships: store, Links: store},
		access.Options{SessionTTL: ttl},
	)

	jobPoll, err := time.ParseDuration(cfg.Jobs.PollInterval)
	if err != nil {
		log.Fatalf("config: invalid jobs.poll_interval %q: %v", cfg.Jobs.PollInterval, err)
	}

	// Background jobs: one durable queue over the same store, a registry of job
	// handlers, and a worker pool that runs them off the request path.
	queue := job.NewQueue(store, cfg.Jobs.MaxAttempts)

	intel := buildIntelligence(cfg)
	log.Printf("intelligence: %d provider(s) configured", len(cfg.Intelligence.Providers))

	// The memory budget, and the ingest caps derived from it. Resolved here
	// because it is a property of the machine, not of any capability, and logged
	// because a bound that differs per host is only operable if the number can be
	// accounted for afterwards. A manifest that sets either cap keeps it: the
	// derivation fills in what was left at 0, it does not overrule anyone.
	memBudget, derivation, err := memory.Budget(cfg.Limits.MemoryBudget)
	if err != nil {
		log.Fatalf("config: invalid limits.memory_budget: %v", err)
	}
	maxArtifacts := cfg.Knowledge.Ingest.MaxArtifacts
	if maxArtifacts == 0 {
		maxArtifacts = memory.ArtifactCeiling(memBudget)
	}
	commitWindows := cfg.Knowledge.Ingest.CommitWindowBudget
	if commitWindows == 0 {
		commitWindows = memory.CommitWindows(memBudget)
	}
	// Knowledge: a per-project retrieval lattice over the same store, embedding
	// through the intelligence service under a fixed general embedding cast.
	knowledgeEmbedding := knowledgeEmbedder{
		intel: intel,
		cast:  intelligence.Cast{Purpose: "general", Strength: "medium", Speed: "medium", Cost: "medium"},
	}
	know := knowledge.New(store, knowledgeEmbedding, knowledge.Options{
		WindowTargetRunes:          cfg.Knowledge.Window.TargetRunes,
		WindowOverlapRunes:         cfg.Knowledge.Window.OverlapRunes,
		ClusterPercentile:          cfg.Knowledge.Cluster.Percentile,
		ClusterFloor:               cfg.Knowledge.Cluster.Floor,
		MaxClusterPool:             cfg.Knowledge.Cluster.MaxPool,
		NeighborsK:                 cfg.Knowledge.Cluster.Neighbors.K,
		NeighborsCells:             cfg.Knowledge.Cluster.Neighbors.Cells,
		NeighborsPCADims:           cfg.Knowledge.Cluster.Neighbors.PCADims,
		NeighborsRepairMaxFraction: cfg.Knowledge.Cluster.Neighbors.RepairMaxFraction,
		NeighborsRepairMaxDrift:    cfg.Knowledge.Cluster.Neighbors.RepairMaxDrift,
		Logger:                     logging.New(),
		DescentBeam:                cfg.Knowledge.Descent.Beam,
		DescentThreshold:           cfg.Knowledge.Descent.Threshold,
		CharBudget:                 cfg.Knowledge.Retrieval.CharBudget,
		CommitWindowBudget:         commitWindows,
		MaxArtifacts:               maxArtifacts,
		MaxSourceBytes:             cfg.Knowledge.Ingest.MaxSourceBytes,
		MaxRunBytes:                cfg.Knowledge.Ingest.MaxRunBytes,
		// A write drops the corpus tier and defers rebuilding it to the job queue,
		// so an add never waits on a project-scale clustering.
		Enqueuer: queue,
	})
	log.Printf("limits: memory budget %s; max %d artifacts per project, %d windows per commit; knowledge source/run byte caps %d/%d",
		derivation, maxArtifacts, commitWindows, know.MaxSourceBytes(), know.MaxRunBytes())

	// Personas: versioned, Project-local behavior overlays. The configured
	// General template is materialized lazily per-Project on first access.
	personas, err := persona.New(store, persona.Options{
		GeneralName:        cfg.Agents.DefaultPersona.Name,
		GeneralDescription: cfg.Agents.DefaultPersona.Description,
		GeneralDefinition: persona.Definition{
			Focus:               cfg.Agents.DefaultPersona.Focus,
			BehavioralGuidance:  cfg.Agents.DefaultPersona.Instructions,
			ContextReferences:   append([]string(nil), cfg.Agents.DefaultPersona.ContextReferences...),
			DefaultVerification: cfg.Agents.DefaultPersona.DefaultVerification,
			OutputPreferences:   cfg.Agents.DefaultPersona.OutputPreferences,
		},
	})
	if err != nil {
		log.Fatalf("personas: %v", err)
	}

	// Agent Tasks: durable Project-local work records. Tasks are created before
	// documents because the task store only needs the enqueuer.
	tasks, err := agent.NewTasks(store, agent.TaskOptions{Enqueuer: queue})
	if err != nil {
		log.Fatalf("agent tasks: %v", err)
	}
	// The reaper is started later, bound to jobCtx, so it stops on shutdown.

	// Documents. Layout config becomes defaults captured by each new document.
	// Prompt-block resolution reaches intelligence (plan + synthesize) and
	// knowledge (retrieve) through ports, so document imports neither: the
	// adapters below bind the configured casts and the knowledge lattice.
	// The document service and the reference graph reference each other — a
	// document reindexes its links after every edit, and resolving those links to
	// resources reads documents back. A late-bound indexer breaks the cycle: it is
	// injected here and pointed at the reference service once that is built below.
	refIndexer := &lazyReferenceIndexer{}
	docs := document.New(store, document.Options{
		ReferenceIndexer: refIndexer,
		// Charge a resolution's plan and synthesis calls to the block that caused
		// them, without the document capability learning what telemetry is.
		Attributor:      intelligence.WithSubject,
		RebaseThreshold: cfg.Documents.RebaseThreshold,
		HistoryLimit:    cfg.Documents.HistoryLimit,
		PageLayout: document.PageLayout{
			Width:        document.LayoutUnit(cfg.Documents.Layout.PageWidth),
			Height:       document.LayoutUnit(cfg.Documents.Layout.PageHeight),
			MarginTop:    document.LayoutUnit(cfg.Documents.Layout.MarginTop),
			MarginRight:  document.LayoutUnit(cfg.Documents.Layout.MarginRight),
			MarginBottom: document.LayoutUnit(cfg.Documents.Layout.MarginBottom),
			MarginLeft:   document.LayoutUnit(cfg.Documents.Layout.MarginLeft),
		},
		LayoutRules: document.LayoutRules{
			MaxFontHeight: document.LayoutUnit(cfg.Documents.Layout.MaxFontHeight),
			MinRowPadding: document.LayoutUnit(cfg.Documents.Layout.MinRowPadding),
			CharWidth:     document.LayoutUnit(cfg.Documents.Layout.CharWidth),
		},
		Enqueuer: queue,
		PromptModel: documentPromptModel{
			intel:     intel,
			planCast:  promptCast(cfg.Documents.Prompt.PlanCast),
			synthCast: promptCast(cfg.Documents.Prompt.SynthesisCast),
		},
		Retriever:       documentRetriever{know: know},
		PersonaResolver: documentPersonaResolver{personas: personas},
		PromptTemplates: document.PromptTemplates{
			PlanSystem:      cfg.Documents.Prompt.Plan.System,
			PlanUser:        cfg.Documents.Prompt.Plan.User,
			SynthesisSystem: cfg.Documents.Prompt.Synthesis.System,
			SynthesisUser:   cfg.Documents.Prompt.Synthesis.User,
		},
		PromptTopK:       cfg.Documents.Prompt.RetrievalTopK,
		PromptMaxQueries: cfg.Documents.Prompt.MaxQueries,
		TrashRetention:   parseDurationOrZero(cfg.Documents.TrashRetention),
	})
	activityFeed := activity.New(store)
	// Stale-trash reclamation runs in the background (started with jobCtx below),
	// so it neither delays readiness nor happens only once per process lifetime.

	// Ephemeral toast notifications: an in-memory, per-user, Project-scoped queue.
	// It is a transient signal channel — task workers push completion toasts and
	// the caller drains them — so it lives only in memory and is not persisted.
	notifications := notification.New()

	// Organizations: above-Project entities users belong to. Backed by the shared
	// SQLite store. The resource access-scope resolver (Phase 4b) consults this
	// for a caller's org memberships; org membership never grants Project access.
	organizations, err := organization.New(store)
	if err != nil {
		log.Fatalf("organizations: %v", err)
	}

	// Reference graph over the same store, resolving link hrefs to in-project
	// documents. Wiring the indexer now activates link extraction on save.
	references, err := reference.New(store, documentResolver{docs: docs})
	if err != nil {
		log.Fatalf("references: %v", err)
	}
	refIndexer.refs = references

	// Anchored comments over the same store, reaching document anchors through an
	// adapter so the comment capability never imports document.
	comments, err := comment.New(store, commentAnchors{docs: docs})
	if err != nil {
		log.Fatalf("comments: %v", err)
	}

	// File store over the same SQLite store (metadata + content BLOB).
	files, err := file.New(store, 0)
	if err != nil {
		log.Fatalf("files: %v", err)
	}

	// Per-user workspace state (opaque JSON, keyed by user × project).
	workspaces := workspace.New(store)

	// Ephemeral per-document presence behind the collaboration projection.
	documentPresence := presence.New(presence.DefaultTTL)

	// Connectors: external-source resources (first subkind local-folder). Wired
	// for syncing — the provider factory reads the source, the lattice writer feeds
	// its content into the knowledge lattice under the connector source type.
	connectors := connector.NewWithSync(store, connectorProviderFactory, connectorLatticeWriter{know: know})
	connectors.UseCostRecorder(connectorCostRecorder{rec: telemetry.NewLogger()})
	// Bound the retry loop. Sync is reconciliation with no memory of having tried,
	// so without a cap a connector whose provider is broken re-reads and re-embeds
	// its whole content on every detector tick, indefinitely, at provider rates.
	connectors.UseSyncRetry(
		cfg.Connectors.Sync.MaxAttempts,
		parseDurationOrZero(cfg.Connectors.Sync.Backoff),
		parseDurationOrZero(cfg.Connectors.Sync.MaxBackoff),
	)
	connectors.UseLogger(logging.New())
	// When a connector sync changes a source, refresh every prompt block that
	// depends on it (reference graph → reload resolves), server-side and
	// system-attributed. Best-effort: a cascade failure never fails the sync.
	connectors.UseCascader(refreshCascader{docs: docs, queue: queue})

	// Resources: the unified catalog. Built before the agent workflows so the
	// workflows' document tools can honor the same per-resource access scope the
	// HTTP routes do (via the authorizer below).
	resources, err := resource.NewWithAttributes(store,
		documentResourceFamily{documents: docs},
		connectorResourceFamily{connectors: connectors},
		fileResourceFamily{files: files},
	)
	if err != nil {
		log.Fatalf("resources: %v", err)
	}
	// The resource access-scope resolver consults org membership to admit the
	// "organization" slice of a scope. Org membership never grants Project access;
	// it only narrows who, among members, may see an org-scoped resource.
	resources.UseOrgMembership(organizations)

	// Contexts: named, nestable resource sets, resolved live over the unified
	// catalog (whole-project) and the document capability's bound-variable
	// selections (prompt-block scoping). Neither capability imports the other —
	// the catalog and scope adapters live here in wiring.
	contextsSvc := contexts.New(store)
	contextsSvc.UseCatalog(resourceCatalog{resources: resources})
	contextsSvc.UseConnectorFiles(connectorFilesCatalog{know: know})
	docs.UseScopeResolver(documentScopeResolver{contexts: contextsSvc})
	docs.UseScopeReferences(documentScopeReferences{contexts: contextsSvc})

	// Agent Workflows: durable Plan/Action execution with document tools and a
	// frozen application policy. Constructed after documents so document tools
	// can bind to the real document service.
	agentPolicy := configuredAgentPolicy(cfg.Agents)
	workflows, err := agent.NewWorkflows(agent.WorkflowOptions{
		Tasks: tasks, Intelligence: intel, Knowledge: know, Personas: personas, Documents: docs,
		PlanningCast:  intelligence.Cast{Purpose: "general", Strength: "medium", Speed: "medium", Cost: "medium"},
		DefaultCast:   intelligence.Cast{Purpose: "general", Strength: "medium", Speed: "medium", Cost: "medium"},
		ToolLimits:    intelligence.ToolLimits{MaxRounds: 64, MaxCallsPerRound: 8, MaxCalls: 256, MaxTotalTokens: 512 * 1024},
		Policy:        agentPolicy,
		Notifier:      notifications,
		Authorizer:    documentAuthorizer{resources: resources},
		Enqueuer:      queue,
		ResourceTools: resourceToolSource{resources: resources},
	})
	if err != nil {
		log.Fatalf("agent workflows: %v", err)
	}

	// Optional live-web retriever for ask-mode chat turns; nil unless configured,
	// in which case the web source is simply unavailable.
	var webRetriever agent.WebRetriever
	if cfg.Agents.Web.Endpoint != "" {
		wc, err := web.New(web.Options{
			Endpoint:   cfg.Agents.Web.Endpoint,
			APIKey:     cfg.Agents.Web.APIKey,
			MaxResults: cfg.Agents.Web.MaxResults,
		})
		if err != nil {
			log.Fatalf("web retriever: %v", err)
		}
		webRetriever = wc
		log.Printf("web retrieval: enabled")
	}

	// Agent Ask: the read-only Q&A engine, used inline by ask-mode chats.
	ask, err := agent.New(agent.Options{
		Intelligence: intel, Knowledge: know, Personas: personas,
		PlanningCast:  intelligence.Cast{Purpose: "general", Strength: "medium", Speed: "medium", Cost: "medium"},
		DefaultCast:   intelligence.Cast{Purpose: "general", Strength: "medium", Speed: "medium", Cost: "medium"},
		ToolLimits:    intelligence.ToolLimits{MaxRounds: 64, MaxCallsPerRound: 8, MaxCalls: 256, MaxTotalTokens: 512 * 1024},
		Policy:        agentPolicy,
		WebRetriever:  webRetriever,
		Attachments:   chatAttachmentLister{attachments: store, files: files},
		ResourceTools: resourceToolSource{resources: resources},
	})
	if err != nil {
		log.Fatalf("agent ask: %v", err)
	}

	// Agent Chats: persistent, Project-scoped conversations. Each turn runs the
	// chat's mode through the Ask (inline) or Workflows (durable task) engine.
	chats, err := chat.NewChats(store, chatEngine{ask: ask, workflows: workflows, personas: personas})
	if err != nil {
		log.Fatalf("agent chats: %v", err)
	}
	chats.UseAttachments(store)
	// An attachment is admitted to Knowledge on upload, so a turn retrieves and
	// cites it through the same path as a document or a connector's file rather
	// than having its content inlined into the prompt uncitably.
	chats.UseAttachmentIndexer(attachmentLatticeWriter{know: know, files: files})

	know.UseResourceLocatorResolver(knowledgeResourceLocatorResolver{chats: chats})
	know.UseReembedPorts(
		knowledgeReembedAuthorizer{access: acc, embeddings: knowledgeEmbedding},
		knowledgeReembedSourceReader{
			resources: resources, documents: docs, connectors: connectors,
			chats: chats, files: files,
		},
	)

	// Names: the formula name-manager's per-project namespace, over the same
	// durable store and the pure formula evaluator.
	nameManager := names.New(store, formula.NewService())

	// Sessions: per-user, per-project activity tracking. The consumer and sweeper
	// goroutines start on construction and run in the background.
	sessions := session.New(store, session.Options{
		StaleTimeout:  15 * time.Minute,
		SweepInterval: 60 * time.Second,
		QueueSize:     256,
	})
	defer sessions.Stop()

	registry := job.NewRegistry()
	for _, registration := range []struct {
		typ     string
		handler job.Handler
	}{
		{document.JobTypeRebase, docs.RebaseJob},
		{document.JobTypeResolve, docs.ResolveJob},
		{agent.JobTypeRun, workflows.RunJob},
		{knowledge.JobTypeRebuildCorpus, know.RebuildCorpusJob},
		{knowledge.JobTypeReembed, know.ReembedJob},
	} {
		if err := registry.Register(registration.typ, registration.handler); err != nil {
			log.Fatalf("jobs: %v", err)
		}
	}
	if err := registry.Validate(
		document.JobTypeRebase,
		document.JobTypeResolve,
		agent.JobTypeRun,
		knowledge.JobTypeRebuildCorpus,
		knowledge.JobTypeReembed,
	); err != nil {
		log.Fatalf("jobs: %v", err)
	}
	recoveredReembeds, err := store.RecoverReembeds(time.Now().UTC())
	if err != nil {
		log.Fatalf("knowledge re-embed recovery: %v", err)
	}
	for _, run := range recoveredReembeds {
		if _, err := queue.Enqueue(context.Background(), knowledge.JobTypeReembed, map[string]string{"runId": run.ID}); err != nil {
			log.Fatalf("knowledge re-embed recovery: enqueue %s: %v", run.ID, err)
		}
	}
	if len(recoveredReembeds) > 0 {
		log.Printf("knowledge: recovered %d queued re-embed run(s)", len(recoveredReembeds))
	}
	if err := validateReadiness(
		readinessCheck{name: "resource families", check: func() error {
			return resources.ValidateFamilies(resource.KindDocument, resource.KindConnector, resource.KindFile)
		}},
		readinessCheck{name: "resource ports", check: resources.ValidateBoundPorts},
		readinessCheck{name: "connector ports", check: connectors.ValidateBoundPorts},
		readinessCheck{name: "context ports", check: contextsSvc.ValidateBoundPorts},
		readinessCheck{name: "document ports", check: docs.ValidateBoundPorts},
		readinessCheck{name: "chat ports", check: chats.ValidateBoundPorts},
		readinessCheck{name: "knowledge ports", check: know.ValidateBoundPorts},
	); err != nil {
		log.Fatalf("%v", err)
	}

	pool := job.NewPool(store, registry, job.Options{
		Workers:      cfg.Jobs.Workers,
		PollInterval: jobPoll,
		Logf:         log.Printf,
	})
	jobCtx, jobCancel := context.WithCancel(context.Background())
	pool.Start(jobCtx)
	log.Printf("jobs: %d workers polling every %s", cfg.Jobs.Workers, jobPoll)

	// Reap tasks stuck in running, bound to jobCtx so it stops with the pool.
	tasks.StartReaper(jobCtx, 30*time.Second, 5*time.Minute)

	// Reclaim documents whose trash retention has elapsed, off the boot path and
	// for as long as the process runs.
	go runTrashPurge(jobCtx, docs, trashPurgeInterval)

	// Background change detection: re-sync connectors whose external source
	// changed, so updates reach the lattice without a manual sync call.
	go runConnectorDetector(jobCtx, connectors, parseDurationOrZero(cfg.Connectors.Sync.DetectInterval))

	log.Printf("composition: running in %s mode", cfg.Mode)

	e := transport.New(transport.Options{
		Access:                      acc,
		Documents:                   docs,
		Activity:                    activityFeed,
		Notifications:               notifications,
		Organizations:               organizations,
		Resources:                   resources,
		Connectors:                  connectors,
		Contexts:                    contextsSvc,
		Enqueuer:                    queue,
		Jobs:                        store,
		Intelligence:                intel,
		Knowledge:                   know,
		FlattenDocument:             FlattenDocument,
		Names:                       nameManager,
		Sessions:                    sessions,
		AgentTasks:                  tasks,
		AgentWorkflows:              workflows,
		Chats:                       chats,
		MaxAttachmentDirectoryFiles: cfg.Agents.Attachments.MaxDirectoryFiles,
		References:                  references,
		Comments:                    comments,
		Workspaces:                  workspaces,
		Presence:                    documentPresence,
		Files:                       files,
		ResourceGenerator:           resourceGenerator{workflows: workflows, personas: personas},
		Personas:                    personas,
		LogRequests:                 cfg.Logging.Requests,
	})

	// Start the server in the background so Run can wait for a shutdown signal.
	go func() {
		if err := e.StartTLS(cfg.Server.Addr, certPath, keyPath); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	// Block until we receive an interrupt or termination signal.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	// Give in-flight requests a short window to finish.
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := e.Shutdown(ctx); err != nil {
		log.Fatalf("graceful shutdown failed: %v", err)
	}

	// With the listener drained, stop the background workers and wait for any
	// in-flight job to finish.
	jobCancel()
	pool.Wait()
	log.Print("jobs: workers stopped")
}
