// Package config defines the application's configuration schema and loads it
// from a YAML manifest. Every setting has a built-in default; values in the
// manifest overlay those defaults, so a partial (or missing) file still yields a
// complete, valid configuration.
package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// Composition modes. Mode selects which composition path the core runs. It also
// governs TLS: dev generates a self-signed certificate when none is configured,
// while prod requires a real certificate and refuses to start without one.
const (
	ModeProd = "prod"
	ModeDev  = "dev"
)

// Config is the whole of the application's configuration. It is intended to
// mirror the YAML manifest one-to-one, growing new sections as the core does.
type Config struct {
	// Mode selects the composition path (ModeProd or ModeDev).
	Mode         string       `yaml:"mode"`
	Server       Server       `yaml:"server"`
	Logging      Logging      `yaml:"logging"`
	Storage      Storage      `yaml:"storage"`
	Access       Access       `yaml:"access"`
	Documents    Documents    `yaml:"documents"`
	Jobs         Jobs         `yaml:"jobs"`
	Limits       Limits       `yaml:"limits"`
	Intelligence Intelligence `yaml:"intelligence"`
	Knowledge    Knowledge    `yaml:"knowledge"`
	Connectors   Connectors   `yaml:"connectors"`
	Agents       Agents       `yaml:"agents"`
}

// Limits holds the deployment's resource budget — the one number several caps
// are derived from, so a container and a workstation are bounded by their own
// memory rather than by a constant chosen for neither.
type Limits struct {
	// MemoryBudget is how much memory indexing may spend, as a byte size
	// ("8GiB", "512MB", or a bare byte count). Empty derives it from system RAM.
	//
	// It is not enforced by measurement — nothing here watches the heap. It is
	// the input the derived caps are computed from, and the startup log says
	// what it resolved to and how, because a cap that varies per machine is only
	// operable if the number can be accounted for.
	MemoryBudget string `yaml:"memory_budget"`
}

// Connectors bounds what an external-source sync admits.
type Connectors struct {
	// Sync bounds how a failing sync is retried, and how often sources are checked.
	Sync ConnectorSync `yaml:"sync"`
}

// ConnectorSync bounds the sync loop: how hard a failure is retried, and how
// often the background detector looks for changes. Every value is a number
// because every one of them is a cost — a re-sync spends embedding tokens, so
// how many times to try and how long to wait between tries is a budget.
type ConnectorSync struct {
	// MaxAttempts is how many consecutive failures are tolerated before automatic
	// syncing stops and the connector reports needing attention. 0 takes the
	// default (3).
	MaxAttempts int `yaml:"max_attempts"`
	// Backoff is the delay after the first failure, doubling per attempt. Go
	// duration string; empty takes the default (30s).
	Backoff string `yaml:"backoff"`
	// MaxBackoff caps that doubling. Go duration string; empty takes the default
	// (15m).
	MaxBackoff string `yaml:"max_backoff"`
	// DetectInterval is how often the background detector re-checks every
	// connector's source for changes. Go duration string; empty takes the default
	// (2s).
	DetectInterval string `yaml:"detect_interval"`
}

// Server holds HTTP transport settings.
type Server struct {
	// Addr is the address the HTTP server listens on (host:port; host optional).
	Addr string `yaml:"addr"`
	// TLS configures the certificate the server presents.
	TLS TLS `yaml:"tls"`
}

// TLS holds the paths to the server's certificate and private key. In dev mode a
// self-signed pair is generated at these paths (or a default under var/) when
// they are missing; prod requires them to be provided.
type TLS struct {
	Cert string `yaml:"cert"`
	Key  string `yaml:"key"`
}

// Logging holds observability settings.
type Logging struct {
	// Requests enables capturing each request and its response as a structured
	// log record.
	Requests bool `yaml:"requests"`
	// Dir is where server logs are written. When empty (the default), logs go to
	// standard error, for a dev or unconfigured run. Production is expected to set
	// a dir: logs are appended to a file in it (created if missing) that can be
	// shipped for support and then deleted, rather than streaming out of a
	// long-lived process. A mounted config can set this without a code change.
	Dir string `yaml:"dir"`
}

// Storage holds persistence settings.
type Storage struct {
	// DSN is the path to the SQLite database file (created if missing, along with
	// its parent directory). Holds users and sessions.
	DSN string `yaml:"dsn"`
}

// Access holds access-layer settings.
type Access struct {
	// SessionTTL is how long a session stays valid, as a Go duration string
	// (e.g. "24h").
	SessionTTL string `yaml:"session_ttl"`
}

// Documents holds document-resource tuning.
type Documents struct {
	// RebaseThreshold is how many pending change sets trigger a re-base — folding
	// them into a new base so reads stay fast.
	RebaseThreshold int `yaml:"rebase_threshold"`
	// HistoryLimit is the maximum number of revision summaries kept per document
	// after re-base. Positive limits retain detailed pending changes and the
	// current undo/redo recipe; 0 keeps all detail and summaries. Pruning is
	// carried out by the jobs system.
	HistoryLimit int `yaml:"history_limit"`
	// Layout supplies the page geometry and row metrics captured by newly
	// created documents.
	Layout DocumentLayout `yaml:"layout"`
	// Prompt configures prompt-block resolution.
	Prompt DocumentPrompt `yaml:"prompt"`
	// TrashRetention is how long a trashed document lives before PurgeStale
	// removes it permanently. Format: Go duration string (e.g. "720h" = 30 days).
	// Empty or missing defaults to "720h".
	TrashRetention string `yaml:"trash_retention"`
}

// DocumentLayout holds integer typographic-point defaults. The effective values
// are copied into each new document so later configuration changes do not
// silently repaginate existing content.
type DocumentLayout struct {
	PageWidth     int `yaml:"page_width"`
	PageHeight    int `yaml:"page_height"`
	MarginTop     int `yaml:"margin_top"`
	MarginRight   int `yaml:"margin_right"`
	MarginBottom  int `yaml:"margin_bottom"`
	MarginLeft    int `yaml:"margin_left"`
	MaxFontHeight int `yaml:"max_font_height"`
	MinRowPadding int `yaml:"min_row_padding"`
	CharWidth     int `yaml:"char_width"`
}

// DocumentPrompt configures how a prompt block resolves: the semantic cast for
// the plan step (prompt → retrieval queries) and the synthesis step (evidence →
// answer), each resolved through the reasoning cast table, plus retrieval
// bounds.
type DocumentPrompt struct {
	PlanCast      PromptCast `yaml:"plan_cast"`
	SynthesisCast PromptCast `yaml:"synthesis_cast"`
	RetrievalTopK int        `yaml:"retrieval_top_k"`
	MaxQueries    int        `yaml:"max_queries"`
	// Plan and Synthesis override the prompt templates for the two resolution
	// steps. Blank fields fall back to the built-in defaults (documented in
	// docs/architecture/workflows/prompt-resolution.md), so a manifest only needs
	// to set the ones it wants to change.
	Plan      PromptStep `yaml:"plan"`
	Synthesis PromptStep `yaml:"synthesis"`
}

// PromptStep holds the system and user prompt templates for one resolution step.
// Each is a Go text/template rendered with that step's placeholders.
type PromptStep struct {
	System string `yaml:"system"`
	User   string `yaml:"user"`
}

// PromptCast is a semantic cast reference — the four coordinates that select a
// model from the reasoning cast table. It carries no provider/model of its own.
type PromptCast struct {
	Purpose  string `yaml:"purpose"`
	Strength string `yaml:"strength"`
	Speed    string `yaml:"speed"`
	Cost     string `yaml:"cost"`
}

// Jobs holds background-jobs settings.
type Jobs struct {
	// Workers is how many jobs run concurrently.
	Workers int `yaml:"workers"`
	// PollInterval is how long a worker waits before polling an empty queue,
	// as a Go duration string (e.g. "1s").
	PollInterval string `yaml:"poll_interval"`
	// MaxAttempts is how many times a job is tried before it is marked failed.
	MaxAttempts int `yaml:"max_attempts"`
}

// Intelligence holds the intelligence service configuration: the model
// providers it can reach and the cast tables that map a semantic cast to a
// concrete provider and model per endpoint kind.
type Intelligence struct {
	// Providers is the set of model backends, keyed by name (e.g. "openrouter").
	Providers map[string]Provider `yaml:"providers"`
	// Casts holds the per-endpoint-kind cast tables.
	Casts Casts `yaml:"casts"`
	// Embedding bounds how an embedding batch is split and paced.
	Embedding Embedding `yaml:"embedding"`
}

// Embedding bounds one embedding batch's provider traffic. It lives under
// intelligence rather than knowledge because it describes the endpoint, not the
// lattice: any caller embedding a large batch meets the same per-request and
// per-minute limits.
type Embedding struct {
	// MaxBatchInputs is the most inputs one provider request may carry. A larger
	// batch is split into this many at a time, which is what keeps a large ingest
	// from becoming either one oversized request or a request per source.
	MaxBatchInputs int `yaml:"max_batch_inputs"`
	// MaxWait is the total time one chunk may spend waiting out a provider that is
	// rate limiting or too slow to answer, before it gives up (Go duration, e.g.
	// "90s"). Blank takes the default.
	//
	// A time budget rather than an attempt count, because rate limits are enforced
	// over windows measured in minutes: an attempt count bounds the wait only by
	// accident, and the count that used to be here bounded it at seven seconds.
	MaxWait string `yaml:"max_wait"`
	// Backoff is the delay before the first paced retry (Go duration, e.g. "1s"),
	// doubled per retry. It applies only when the provider does not send a
	// Retry-After of its own, which is honoured in preference to guessing.
	Backoff string `yaml:"backoff"`
}

// Provider holds the connection settings for one model backend. BaseURL may be
// left blank to use the provider's built-in default. APIKey is a secret and is
// expected to come from a gitignored local overlay, not the committed manifest.
type Provider struct {
	APIKey  string `yaml:"api_key"`
	BaseURL string `yaml:"base_url"`
	// Timeout bounds a single provider HTTP call (Go duration, e.g. "60s").
	// Blank uses the provider default. This is a deliberate product constraint,
	// not just a safety valve: how fast a model answers is part of whether it is
	// usable here, so a model that cannot respond inside the budget is cut.
	Timeout string `yaml:"timeout"`
}

// Casts groups the cast tables by endpoint kind. Each table lists the casts that
// kind supports and the model each resolves to.
type Casts struct {
	Reasoning []Cast `yaml:"reasoning"`
	Inference []Cast `yaml:"inference"`
	Embedding []Cast `yaml:"embedding"`
}

// Cast maps one semantic cast — (purpose, strength, speed, cost) — to a concrete
// provider and model. Strength, Speed, and Cost are each "low", "medium", or
// "high"; Purpose is "general" for now.
type Cast struct {
	Purpose  string `yaml:"purpose"`
	Strength string `yaml:"strength"`
	Speed    string `yaml:"speed"`
	Cost     string `yaml:"cost"`
	Provider string `yaml:"provider"`
	Model    string `yaml:"model"`
	// Effort optionally pins how hard the model thinks on this route
	// ("low"|"medium"|"high"). Omit to leave the model's default alone. It is
	// per-row, so one cast can be served by a cheap model told to think harder.
	Effort string `yaml:"effort"`
}

// Knowledge configures the retrieval lattice: window geometry, clustering
// calibration, and the directed-descent retrieval path.
type Knowledge struct {
	// Window is the sentence-aware window geometry, in runes (~4 runes ≈ 1 token).
	Window KnowledgeWindow `yaml:"window"`
	// Cluster calibrates the KLR threshold rule.
	Cluster KnowledgeCluster `yaml:"cluster"`
	// Descent tunes directed lattice retrieval, which is how retrieval works —
	// there is no alternative path to select. The exact scan survives only as the
	// test oracle (Knowledge.RetrieveExact).
	Descent KnowledgeDescent `yaml:"descent"`
	// Retrieval bounds the grounded output.
	Retrieval KnowledgeRetrieval `yaml:"retrieval"`
	// Ingest bounds what one sync holds in memory before committing.
	Ingest KnowledgeIngest `yaml:"ingest"`
}

// KnowledgeIngest bounds ingest: a commit cadence, and one real ceiling. The
// two are different kinds of bound and the difference matters — the cadence
// refuses nothing, the ceiling refuses everything.
type KnowledgeIngest struct {
	// CommitWindowBudget is how many windows an ingest accumulates before
	// embedding, clustering and writing them and moving on. 0 derives it from
	// limits.memory_budget.
	//
	// It bounds peak memory to O(slice) instead of O(sync), and it decides what a
	// failed sync leaves behind: everything committed before the failure stays,
	// and the retry skips it. Lower it where memory is tight, at the cost of more
	// write transactions and — below a few hundred — smaller embedding requests
	// than the provider's per-request batch allows.
	CommitWindowBudget int `yaml:"commit_window_budget"`

	// MaxArtifacts is the most artifacts — windows plus nodes — one project's
	// lattice may hold. 0 derives it from limits.memory_budget as
	// budget / (dims × 8 bytes), the memory a corpus rebuild needs to hold every
	// frontier vector at once; negative means unbounded.
	//
	// This one IS an admission limit. Crossing it produces a typed
	// knowledge.project_artifact_limit error from the exact source/corpus
	// transaction. Earlier complete slices can remain after a later refusal, and
	// the run is explicitly marked partial rather than current. Without the bound
	// the ceiling was still there — it was the machine's RAM — and reaching it
	// killed the process instead of answering.
	MaxArtifacts int `yaml:"max_artifacts"`

	// MaxSourceBytes and MaxRunBytes bound actual decoded bytes while content is
	// streamed into Knowledge. Provider Size is untrusted metadata, so zero
	// means use the capability's safe default rather than disable enforcement;
	// negative is an explicit opt-out for a controlled deployment.
	MaxSourceBytes int64 `yaml:"max_source_bytes"`
	MaxRunBytes    int64 `yaml:"max_run_bytes"`
}

// KnowledgeRetrieval bounds what one retrieval returns: char_budget caps the
// total region text (dense regions may overrun by a controlled quarter).
type KnowledgeRetrieval struct {
	CharBudget int `yaml:"char_budget"`
}

// KnowledgeWindow is the window geometry.
type KnowledgeWindow struct {
	TargetRunes  int `yaml:"target_runes"`
	OverlapRunes int `yaml:"overlap_runes"`
}

// KnowledgeCluster calibrates the level-relative clustering threshold, and
// bounds how large a pool may be clustered at all.
type KnowledgeCluster struct {
	Percentile float64 `yaml:"percentile"`
	Floor      float64 `yaml:"floor"`
	// MaxPool is the crossover between the two clustering constructions, not a
	// ceiling. Below it, clustering builds the complete n×n similarity matrix —
	// n²·8 bytes, independent of vector dimension, so 800MB at 10,000 and 20GB at
	// 50,000, which is what the crossover exists to avoid. At or above it the pool
	// is clustered over a k-NN graph instead. No pool is ever refused, and nothing
	// selects between the two but the pool's own size.
	MaxPool int `yaml:"max_pool"`
	// Neighbors configures the sparse clustering path for pools over MaxPool.
	Neighbors KnowledgeNeighbors `yaml:"neighbors"`
}

// KnowledgeNeighbors calibrates sparse (k-NN graph) clustering, which runs for
// any pool over Cluster.MaxPool — the crossover between the exact and sparse
// constructions. These are tuning knobs, not a mechanism switch: the system
// always runs the construction that is most efficient at the pool's scale.
type KnowledgeNeighbors struct {
	// K is the neighbours kept per artifact (default 32). It also caps cluster
	// size — a clique cannot exceed its members' degree.
	K int `yaml:"k"`
	// Cells is the IVF cell count for candidate search; 0 derives √pool.
	Cells int `yaml:"cells"`
	// PCADims is the projection dimension for candidate generation; 0 takes
	// the default (128), negative disables projection.
	PCADims int `yaml:"pca_dims"`
	// RepairMaxFraction bounds the changed fraction a stored level index may
	// absorb as a local repair; past it the level rebuilds in full. 0 takes
	// the default (0.2), negative disables repair.
	RepairMaxFraction float64 `yaml:"repair_max_fraction"`
	// RepairMaxDrift bounds how far the pinned threshold may stray from the
	// pool's current percentile before a repair is refused and the level
	// consolidates. 0 takes the default (0.02).
	RepairMaxDrift float64 `yaml:"repair_max_drift"`
}

// KnowledgeDescent tunes directed lattice descent at retrieval time: how many
// children a node expands into (Beam) and how similar a node must be to be
// followed (Threshold). Descent quality is measured against the exact scan in
// tests, not by a runtime audit mode.
type KnowledgeDescent struct {
	Beam      int     `yaml:"beam"`
	Threshold float64 `yaml:"threshold"`
}

// Agents holds deployment-frozen agent prompts and output schemas for the
// three Quarterback modes (Ask, Plan, Action) and retrieval planning.
type Agents struct {
	DefaultPersona AgentPersona     `yaml:"default_persona"`
	Prompts        AgentPrompts     `yaml:"prompts"`
	Schemas        AgentSchemas     `yaml:"schemas"`
	Web            AgentWeb         `yaml:"web"`
	Attachments    AgentAttachments `yaml:"attachments"`
}

// AgentAttachments bounds chat attachment uploads. Per-file size is enforced by
// the file capability; MaxDirectoryFiles caps how many files one directory
// manifest may carry (0 = unbounded).
type AgentAttachments struct {
	MaxDirectoryFiles int `yaml:"max_directory_files"`
}

// AgentWeb configures the optional live-web retrieval provider a chat turn can
// consult. When Endpoint is empty the web source is unavailable. Endpoint must be
// an https URL that answers a `q`/`count` query with a JSON
// {"results":[{title,url,snippet}]} body.
type AgentWeb struct {
	Endpoint   string `yaml:"endpoint"`
	APIKey     string `yaml:"api_key"`
	MaxResults int    `yaml:"max_results"`
}

// AgentPersona is the deployment-owned General Persona template materialized
// lazily in each Project.
type AgentPersona struct {
	Name                string   `yaml:"name"`
	Description         string   `yaml:"description"`
	Focus               string   `yaml:"focus"`
	Instructions        string   `yaml:"instructions"`
	ContextReferences   []string `yaml:"context_references"`
	DefaultVerification string   `yaml:"default_verification"`
	OutputPreferences   string   `yaml:"output_preferences"`
}

// AgentPrompts holds the system instruction for each agent mode.
type AgentPrompts struct {
	RetrievalPlan string `yaml:"retrieval_plan"`
	Ask           string `yaml:"ask"`
	Plan          string `yaml:"plan"`
	Action        string `yaml:"action"`
}

// AgentSchemas holds the JSON output schema for each agent mode.
type AgentSchemas struct {
	RetrievalPlan string `yaml:"retrieval_plan"`
	Ask           string `yaml:"ask"`
	Plan          string `yaml:"plan"`
	Action        string `yaml:"action"`
}

// Default returns the built-in configuration used when the manifest omits a
// value (or is absent entirely).
func Default() Config {
	return Config{
		Mode:    ModeProd,
		Server:  Server{Addr: ":8080"},
		Logging: Logging{Requests: true},
		Storage: Storage{DSN: "var/taurus-omega.db"},
		Access:  Access{SessionTTL: "24h"},
		Documents: Documents{
			RebaseThreshold: 50,
			Layout: DocumentLayout{
				PageWidth: 612, PageHeight: 792,
				MarginTop: 72, MarginRight: 72, MarginBottom: 72, MarginLeft: 72,
				MaxFontHeight: 24, MinRowPadding: 4, CharWidth: 8,
			},
			Prompt: DocumentPrompt{
				PlanCast:      PromptCast{Purpose: "general", Strength: "high", Speed: "medium", Cost: "medium"},
				SynthesisCast: PromptCast{Purpose: "general", Strength: "high", Speed: "medium", Cost: "medium"},
				RetrievalTopK: 5,
				MaxQueries:    4,
			},
		},
		Jobs: Jobs{Workers: 2, PollInterval: "1s", MaxAttempts: 5},
		Connectors: Connectors{
			Sync: ConnectorSync{
				MaxAttempts: 3, Backoff: "30s", MaxBackoff: "15m", DetectInterval: "2s",
			},
		},
		Knowledge: Knowledge{
			Window:    KnowledgeWindow{TargetRunes: 4000, OverlapRunes: 400},
			Cluster:   KnowledgeCluster{Percentile: 0.75, Floor: 0.30},
			Descent:   KnowledgeDescent{Beam: 3, Threshold: 0.35},
			Retrieval: KnowledgeRetrieval{CharBudget: 4000},
		},
		Agents: Agents{
			DefaultPersona: AgentPersona{
				Name:         "General",
				Description:  "General-purpose Project assistant",
				Instructions: "Be a helpful, accurate Project assistant. When Project evidence or tool results are available, ground your answer in them and cite what you use; otherwise answer from your own knowledge. Report uncertainty, and describe only effects confirmed by tools.",
			},
			Attachments: AgentAttachments{MaxDirectoryFiles: 256},
		},
	}
}

// Load reads the YAML manifest at path and overlays it onto the built-in
// defaults. A field the manifest does not set keeps its default value. It
// returns the (still-defaulted) config alongside any read or parse error so
// callers can decide how to treat a missing file.
func Load(path string) (Config, error) {
	cfg := Default()

	data, err := os.ReadFile(path)
	if err != nil {
		return cfg, err
	}

	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return cfg, fmt.Errorf("parse config %s: %w", path, err)
	}
	return cfg, nil
}

// Overlay unmarshals the YAML manifest at path onto cfg, overwriting only the
// keys it sets and leaving the rest untouched — the same defaults-plus-overlay
// model Load uses, applied to an already-loaded config. A file that does not
// exist leaves cfg unchanged and is not an error, so an optional local override
// manifest (see LocalPath) can simply be absent.
func Overlay(cfg Config, path string) (Config, error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return cfg, nil
	}
	if err != nil {
		return cfg, err
	}
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return cfg, fmt.Errorf("parse config %s: %w", path, err)
	}
	return cfg, nil
}

// LocalPath returns the sibling "<name>.local<ext>" path for a manifest path —
// e.g. "etc/config.yaml" -> "etc/config.local.yaml". The local file is where
// secrets such as provider API keys live: gitignored, overlaid on top of the
// committed manifest so the template itself never carries a key.
func LocalPath(path string) string {
	ext := filepath.Ext(path)
	return strings.TrimSuffix(path, ext) + ".local" + ext
}
