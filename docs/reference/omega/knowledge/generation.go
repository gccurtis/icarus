package knowledge

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// LatticeKind keeps independently comparable artifact families apart. Ω-005
// certifies only Text; Structured Data and Media deliberately receive their own
// generations when those lattices are implemented.
type LatticeKind string

const LatticeText LatticeKind = "text"

// EmbeddingSpace is the complete immutable identity of one comparable vector
// space. Provider/model/dimensions alone are insufficient: changing storage
// representation, normalization or the lattice algorithm also creates a new
// generation.
type EmbeddingSpace struct {
	Provider      string `json:"provider"`
	Model         string `json:"model"`
	Dimensions    int    `json:"dimensions"`
	Normalization string `json:"normalization"`
	VectorFormat  string `json:"vectorFormat"`
	SchemaVersion int    `json:"schemaVersion"`
	Algorithm     string `json:"algorithm"`
}

const (
	embeddingNormalization = "unit-l2"
	embeddingVectorFormat  = "float32-le"
	embeddingSchemaVersion = 1
	embeddingAlgorithm     = "klr-text-v1"
)

// SpaceForIdentity expands the legacy three-field provider result into the
// frozen Text-lattice space contract.
func SpaceForIdentity(v VectorIdentity) EmbeddingSpace {
	return EmbeddingSpace{
		Provider: strings.TrimSpace(v.Provider), Model: strings.TrimSpace(v.Model), Dimensions: v.Dims,
		Normalization: embeddingNormalization, VectorFormat: embeddingVectorFormat,
		SchemaVersion: embeddingSchemaVersion, Algorithm: embeddingAlgorithm,
	}
}

func (s EmbeddingSpace) VectorIdentity() VectorIdentity {
	return VectorIdentity{Provider: s.Provider, Model: s.Model, Dims: s.Dimensions}
}

func (s EmbeddingSpace) Validate() error {
	switch {
	case strings.TrimSpace(s.Provider) == "":
		return errors.New("knowledge: embedding provider is required")
	case strings.TrimSpace(s.Model) == "":
		return errors.New("knowledge: embedding model is required")
	case s.Dimensions <= 0:
		return errors.New("knowledge: embedding dimensions must be positive")
	case s.Normalization != embeddingNormalization:
		return fmt.Errorf("knowledge: unsupported embedding normalization %q", s.Normalization)
	case s.VectorFormat != embeddingVectorFormat:
		return fmt.Errorf("knowledge: unsupported vector format %q", s.VectorFormat)
	case s.SchemaVersion != embeddingSchemaVersion:
		return fmt.Errorf("knowledge: unsupported embedding schema version %d", s.SchemaVersion)
	case s.Algorithm != embeddingAlgorithm:
		return fmt.Errorf("knowledge: unsupported lattice algorithm %q", s.Algorithm)
	default:
		return nil
	}
}

// Identity is SHA-256 over a canonical struct JSON encoding. Struct field order
// is stable and every field is explicit, so the same space has the same identity
// in every process and database.
func (s EmbeddingSpace) Identity() string {
	raw, _ := json.Marshal(s)
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}

type GenerationState string

const (
	GenerationBuilding        GenerationState = "building"
	GenerationValidating      GenerationState = "validating"
	GenerationReady           GenerationState = "ready"
	GenerationActive          GenerationState = "active"
	GenerationRetired         GenerationState = "retired"
	GenerationFailed          GenerationState = "failed"
	GenerationReembedRequired GenerationState = "reembed_required"
)

type LatticeGeneration struct {
	ID                string          `json:"id"`
	ProjectID         string          `json:"projectId"`
	Kind              LatticeKind     `json:"kind"`
	SpaceIdentity     string          `json:"spaceIdentity"`
	State             GenerationState `json:"state"`
	SourceWatermark   int64           `json:"sourceWatermark"`
	SourceCount       int             `json:"sourceCount"`
	ArtifactCount     int             `json:"artifactCount"`
	CreatedBy         string          `json:"createdBy"`
	CreatedAt         time.Time       `json:"createdAt"`
	PromotedAt        *time.Time      `json:"promotedAt,omitempty"`
	RetiredAt         *time.Time      `json:"retiredAt,omitempty"`
	RollbackExpiresAt *time.Time      `json:"rollbackExpiresAt,omitempty"`
	Validation        Validation      `json:"validation"`
}

type ProjectLatticeState struct {
	ProjectID            string      `json:"projectId"`
	Kind                 LatticeKind `json:"kind"`
	ActiveGenerationID   string      `json:"activeGenerationId,omitempty"`
	PreviousGenerationID string      `json:"previousGenerationId,omitempty"`
	Revision             int64       `json:"revision"`
	SourceCursor         int64       `json:"sourceCursor"`
	UpdatedAt            time.Time   `json:"updatedAt"`
}

// ReadToken pins one logical read to one immutable generation and state
// revision. SourceCursor is included so a hydration can also detect an ordinary
// replacement/removal that raced its ranking pass.
type ReadToken struct {
	ProjectID     string      `json:"projectId"`
	Kind          LatticeKind `json:"kind"`
	GenerationID  string      `json:"generationId"`
	StateRevision int64       `json:"stateRevision"`
	SourceCursor  int64       `json:"sourceCursor"`
}

func (t ReadToken) Equal(other ReadToken) bool {
	return t.ProjectID == other.ProjectID && t.Kind == other.Kind &&
		t.GenerationID == other.GenerationID && t.StateRevision == other.StateRevision &&
		t.SourceCursor == other.SourceCursor
}

// SourceChange is the durable add/update/remove stream. Remove retains an
// origin tombstone, which is what timestamp-only source rows could not express.
type SourceChange struct {
	ProjectID   string      `json:"projectId"`
	Kind        LatticeKind `json:"kind"`
	Cursor      int64       `json:"cursor"`
	Operation   string      `json:"operation"`
	SourceType  string      `json:"sourceType"`
	SourceID    string      `json:"sourceId"`
	Revision    int64       `json:"revision"`
	ContentHash string      `json:"contentHash,omitempty"`
	OccurredAt  time.Time   `json:"occurredAt"`
}

const (
	SourceAdded   = "add"
	SourceUpdated = "update"
	SourceRemoved = "remove"
)

// Stable lifecycle failures. errors.Is is the capability contract; handlers map
// them to the matching `knowledge.*` wire code without exposing source content.
var (
	// ErrGenerationNotInitialized is an internal lifecycle signal used only to
	// distinguish a genuinely empty Project (which ordinary first ingest may
	// initialize) from an unavailable or quarantined generation (which it may
	// not overwrite).
	ErrGenerationNotInitialized     = errors.New("knowledge: generation not initialized")
	ErrEmbeddingSpaceUnavailable    = errors.New("knowledge.embedding_space_unavailable")
	ErrEmbeddingSpaceChangeRequired = errors.New("knowledge.embedding_space_change_required")
	ErrGenerationConflict           = errors.New("knowledge.generation_conflict")
	ErrReembedPreviewStale          = errors.New("knowledge.reembed_preview_stale")
	ErrReembedIncomplete            = errors.New("knowledge.reembed_incomplete")
	ErrReembedValidationFailed      = errors.New("knowledge.reembed_validation_failed")
	ErrReembedSourceChanged         = errors.New("knowledge.reembed_source_changed")
	ErrReembedCancelled             = errors.New("knowledge.reembed_cancelled")
	ErrRollbackExpired              = errors.New("knowledge.rollback_expired")
	ErrEvidenceChanged              = errors.New("knowledge.evidence_changed")
	ErrEvidenceCorrupt              = errors.New("knowledge.evidence_corrupt")
	ErrReembedForbidden             = errors.New("knowledge.reembed_forbidden")
	ErrReembedNotFound              = errors.New("knowledge.reembed_not_found")
)

// ArtifactStore is a generation-pinned view of the lattice tables. Its methods
// intentionally do not accept a generation id: the view was created for one and
// every query is filtered by it, making accidental cross-generation reads hard
// to express.
type ArtifactStore interface {
	SourceByOrigin(projectID, sourceType, sourceID string) (Source, bool, error)
	SourcesUnder(projectID, sourceType, sourceIDPrefix string) ([]Origin, error)
	Sources(projectID string) ([]Source, error)
	ReplaceSources(writes []SourceWrite) error
	DeleteSource(projectID, sourceType, sourceID string) (bool, error)
	CorpusSeq(projectID string) (dirty, built int64, err error)
	RebuildCorpus(projectID string, corpus []Node, seq int64, indexes []CorpusLevelIndex) error
	CorpusIndexes(projectID string) ([]CorpusLevelIndex, error)
	CorpusIndexHeader(projectID string, level int) (CorpusLevelIndex, bool, error)
	EntryFrontierProbed(projectID string, level int, cells []int) ([]FrontierEntry, error)
	SourceFrontier(projectID string) ([]FrontierEntry, error)
	Identities(projectID string) (map[string]VectorIdentity, error)
	EntryFrontier(projectID string) ([]FrontierEntry, error)
	NodesByID(ids []string) ([]Node, error)
	WindowsByID(ids []string) ([]Window, error)
	ProjectWindows(projectID string) ([]Window, error)
	WindowContent(ids []string) (map[string]WindowContent, error)
	SourceWindows(localRefID string) ([]Window, error)
	SourcesByRef(refs []string) (map[string]Source, error)
	ArtifactCounts(projectID string) (map[string]int, error)
	AdmitAndReplaceSources(maxArtifacts int, writes []SourceWrite) (ArtifactCounts, error)
	AdmitCorpus(projectID string, maxArtifacts int, corpus []Node, seq int64, indexes []CorpusLevelIndex) (ArtifactCounts, error)
}

// ReembedAuthorizer is rechecked at preview/start, by every worker attempt, and
// immediately before promotion/rollback. Only a current Project owner with
// entitlement to the target space may pass.
type ReembedAuthorizer interface {
	AuthorizeReembed(ctx context.Context, projectID, actorID string, target EmbeddingSpace) error
}

// ReembedSourceReader opens one current canonical source snapshot after
// reauthorizing its Resource. It is separate from model-facing exact reading:
// Ω-003 permits a much larger bounded ingest than the 64KiB model read surface.
type ReembedSourceReader interface {
	ReadReembedSource(ctx context.Context, projectID, actorID string, source Source) (AddItem, error)
}

// IdentityEmbedder can target a frozen provider/model explicitly. The production
// intelligence adapter implements it; simple test embedders may implement only
// Embed, in which case Knowledge verifies the returned identity exactly.
type IdentityEmbedder interface {
	EmbedInSpace(ctx context.Context, space EmbeddingSpace, texts []string) (Embedded, error)
}

// ConfiguredSpaceReporter provides a free provider/model drift check before an
// unchanged ordinary sync is skipped. Dimensions may be zero when the provider
// discovers them only on its first call.
type ConfiguredSpaceReporter interface {
	ConfiguredSpace(ctx context.Context) (EmbeddingSpace, error)
}

// GenerationStore is the lifecycle root beside the generation-pinned artifact
// views. Active pointer changes and source-cursor changes live here because a
// plain ArtifactStore cannot make their required CAS/outbox transactions.
type GenerationStore interface {
	Active(projectID string, kind LatticeKind) (ReadToken, LatticeGeneration, EmbeddingSpace, error)
	// ReembedBase returns the source-bearing generation used to construct a
	// preview. It normally equals Active, but may return a quarantined
	// reembed_required legacy generation whose mixed vectors are not queryable.
	ReembedBase(projectID string, kind LatticeKind) (ReadToken, LatticeGeneration, EmbeddingSpace, error)
	EnsureActive(projectID string, kind LatticeKind, generation LatticeGeneration, space EmbeddingSpace) (ReadToken, LatticeGeneration, error)
	ForGeneration(generationID string) ArtifactStore
	Current(token ReadToken) (bool, error)
	AdmitAndReplaceActive(token ReadToken, maxArtifacts int, writes []SourceWrite, at time.Time) (ArtifactCounts, ReadToken, error)
	DeleteActive(token ReadToken, sourceType, sourceID string, at time.Time) (bool, ReadToken, error)
	ChangedSince(projectID string, kind LatticeKind, since time.Time) (bool, error)
	SourceChangesAfter(projectID string, kind LatticeKind, cursor int64, limit int) ([]SourceChange, error)

	SaveReembedPreview(preview ReembedPreview) error
	ReembedPreview(projectID, previewID string) (ReembedPreview, error)
	StartReembed(previewID string, run ReembedRun, generation LatticeGeneration) (ReembedRun, bool, error)
	ReembedRun(projectID, runID string) (ReembedRun, error)
	SetReembedControl(projectID, runID string, control ReembedControl, at time.Time) (ReembedRun, error)
	ClaimReembed(runID string, at time.Time) (ReembedRun, bool, error)
	// RecoverReembeds restores durable worker state after process startup:
	// interrupted running/validating work becomes queued, an acknowledged pause
	// request settles as paused, and all queued runs are returned in deterministic
	// scheduling order.
	RecoverReembeds(at time.Time) ([]ReembedRun, error)
	ReembedCheckpoints(runID string) ([]ReembedCheckpoint, error)
	CommitReembedCheckpoint(runID string, checkpoint ReembedCheckpoint, write *SourceWrite, maxArtifacts int, at time.Time) (ReembedRun, error)
	DeleteReembedCheckpoint(runID, sourceType, sourceID string, at time.Time) error
	MarkReembedReady(runID string, sourceWatermark int64, validation Validation, corpus []Node, indexes []CorpusLevelIndex, at time.Time) (ReembedRun, error)
	FailReembed(runID string, code, detail string, at time.Time) error
	PromoteReembed(projectID, runID, actorID string, expectedRevision int64, rollbackUntil, at time.Time) (ProjectLatticeState, error)
	RollbackGeneration(projectID string, kind LatticeKind, actorID string, expectedRevision int64, at time.Time) (ProjectLatticeState, error)
	GenerationEvents(projectID string, after int64, limit int) ([]GenerationEvent, error)
}

type UsageEstimate struct {
	PromptTokens int64   `json:"promptTokens"`
	Requests     int     `json:"requests"`
	CostUSD      float64 `json:"costUsd"`
}

type SourceSummary struct {
	SourceType  string `json:"sourceType"`
	SourceID    string `json:"sourceId"`
	Label       string `json:"label,omitempty"`
	Revision    int64  `json:"revision"`
	ContentHash string `json:"contentHash,omitempty"`
	SizeBytes   int    `json:"sizeBytes"`
}

type ReembedPolicy struct {
	MaxSources      int     `json:"maxSources"`
	MaxBytes        int64   `json:"maxBytes"`
	MaxVectors      int     `json:"maxVectors"`
	MaxPromptTokens int64   `json:"maxPromptTokens"`
	MaxRequests     int     `json:"maxRequests"`
	MaxCostUSD      float64 `json:"maxCostUsd"`
}

type ReembedPreview struct {
	ID                    string          `json:"id"`
	ProjectID             string          `json:"projectId"`
	Kind                  LatticeKind     `json:"kind"`
	FromGenerationID      string          `json:"fromGenerationId,omitempty"`
	FromSpace             EmbeddingSpace  `json:"fromSpace"`
	ToSpace               EmbeddingSpace  `json:"toSpace"`
	ExpectedStateRevision int64           `json:"expectedStateRevision"`
	SourceCursor          int64           `json:"sourceCursor"`
	Sources               int             `json:"sources"`
	EstimatedBytes        int64           `json:"estimatedBytes"`
	EstimatedVectors      int             `json:"estimatedVectors"`
	EstimatedUsage        UsageEstimate   `json:"estimatedUsage"`
	Unsupported           []SourceSummary `json:"unsupported"`
	Policy                ReembedPolicy   `json:"policy"`
	CreatedBy             string          `json:"createdBy"`
	CreatedAt             time.Time       `json:"createdAt"`
	ExpiresAt             time.Time       `json:"expiresAt"`
}

type ReembedCommand struct {
	PreviewID             string `json:"previewId"`
	IdempotencyKey        string `json:"idempotencyKey"`
	ExpectedStateRevision int64  `json:"expectedStateRevision"`
}

type ReembedStatus string

const (
	ReembedQueued     ReembedStatus = "queued"
	ReembedRunning    ReembedStatus = "running"
	ReembedPausing    ReembedStatus = "pausing"
	ReembedPaused     ReembedStatus = "paused"
	ReembedCancelling ReembedStatus = "cancelling"
	ReembedCancelled  ReembedStatus = "cancelled"
	ReembedValidating ReembedStatus = "validating"
	ReembedReady      ReembedStatus = "ready"
	ReembedPromoted   ReembedStatus = "promoted"
	ReembedRolledBack ReembedStatus = "rolled_back"
	ReembedFailed     ReembedStatus = "failed"
)

type ReembedControl string

const (
	ControlPause  ReembedControl = "pause"
	ControlResume ReembedControl = "resume"
	ControlCancel ReembedControl = "cancel"
)

type ReembedRun struct {
	ID                 string         `json:"id"`
	ProjectID          string         `json:"projectId"`
	Kind               LatticeKind    `json:"kind"`
	PreviewID          string         `json:"previewId"`
	FromGenerationID   string         `json:"fromGenerationId"`
	TargetGenerationID string         `json:"targetGenerationId"`
	TargetSpace        EmbeddingSpace `json:"targetSpace"`
	IdempotencyKey     string         `json:"idempotencyKey"`
	Status             ReembedStatus  `json:"status"`
	ActorID            string         `json:"actorId"`
	ExpectedRevision   int64          `json:"expectedRevision"`
	StartCursor        int64          `json:"startCursor"`
	CaughtUpCursor     int64          `json:"caughtUpCursor"`
	Policy             ReembedPolicy  `json:"policy"`
	SourcesTotal       int            `json:"sourcesTotal"`
	SourcesCompleted   int            `json:"sourcesCompleted"`
	SourcesSkipped     int            `json:"sourcesSkipped"`
	BytesRead          int64          `json:"bytesRead"`
	Vectors            int            `json:"vectors"`
	Usage              Usage          `json:"usage"`
	Validation         Validation     `json:"validation"`
	LastErrorCode      string         `json:"lastErrorCode,omitempty"`
	LastError          string         `json:"lastError,omitempty"`
	CreatedAt          time.Time      `json:"createdAt"`
	UpdatedAt          time.Time      `json:"updatedAt"`
}

type ReembedCheckpoint struct {
	RunID       string    `json:"runId"`
	SourceType  string    `json:"sourceType"`
	SourceID    string    `json:"sourceId"`
	Revision    int64     `json:"revision"`
	ContentHash string    `json:"contentHash"`
	Status      string    `json:"status"`
	Attempts    int       `json:"attempts"`
	BytesRead   int64     `json:"bytesRead"`
	Vectors     int       `json:"vectors"`
	Usage       Usage     `json:"usage"`
	LastError   string    `json:"lastError,omitempty"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// Validation is durable evidence for every promotion gate. Counts cover the
// exact shadow rows; ProbeCount covers deterministic grounded self-probes.
type Validation struct {
	Complete        bool      `json:"complete"`
	SourceCount     int       `json:"sourceCount"`
	WindowCount     int       `json:"windowCount"`
	NodeCount       int       `json:"nodeCount"`
	ArtifactCount   int       `json:"artifactCount"`
	ProbeCount      int       `json:"probeCount"`
	SpaceIdentity   string    `json:"spaceIdentity"`
	SourceWatermark int64     `json:"sourceWatermark"`
	ValidatedAt     time.Time `json:"validatedAt"`
}

type GenerationEvent struct {
	Sequence      int64       `json:"sequence"`
	ID            string      `json:"id"`
	ProjectID     string      `json:"projectId"`
	Kind          LatticeKind `json:"kind"`
	GenerationID  string      `json:"generationId"`
	Type          string      `json:"type"`
	ActorID       string      `json:"actorId"`
	StateRevision int64       `json:"stateRevision"`
	OccurredAt    time.Time   `json:"occurredAt"`
}
