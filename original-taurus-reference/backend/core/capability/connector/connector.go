// Package connector owns external-source connector resources. A connector is a
// project-scoped resource of a provider subkind (the first is local-folder) that
// names where external content lives; a later slice syncs that content into the
// knowledge lattice. This capability owns only the connector record and its
// config; it does not read the filesystem or talk to any provider.
package connector

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/gccurtis/taurus-omega/core/platform/dispatch"
	"github.com/gccurtis/taurus-omega/core/platform/logging"
)

const maxName = 200

// SubKind names a connector's provider. The vocabulary is closed; new providers
// (google-drive, …) are added here as they ship.
type SubKind string

const SubKindLocalFolder SubKind = "local-folder"

func validSubKind(s SubKind) bool { return s == SubKindLocalFolder }

var (
	ErrNotFound       = errors.New("connector not found")
	ErrInvalidName    = errors.New("connector name must not be empty")
	ErrInvalidSubKind = errors.New("connector subkind is not supported")
	ErrInvalidPath    = errors.New("connector path is invalid")
	ErrPointRead      = errors.New("connector provider does not support item reads")
	ErrVersionChanged = errors.New("connector provider item version changed")
)

// Actor is trusted request identity.
type Actor struct {
	ID   string
	Name string
}

// Usage is the token cost a sync incurred feeding the lattice (embedding).
type Usage struct {
	PromptTokens int
	TotalTokens  int
}

// CostRecorder receives the token cost of a sync so it is surfaced centrally
// rather than discarded. The real recorder wraps the telemetry sink in wiring.
type CostRecorder interface {
	RecordSyncCost(projectID, connectorID string, usage Usage)
}

// FileSeparator joins a connector ID and a file's own ID into that file's
// lattice source ID (see FileSourceID). Both halves are hex ids, so a plain
// slash separates them unambiguously.
//
// It used to be a unit separator (0x1F), on the reasoning that an unprintable
// byte could never collide with a path segment. The reasoning held and the
// choice was still wrong: a source id is handed to a model as evidence and has
// to come back byte-exact in a citation, and an unprintable byte does not
// survive that round trip. Nothing addressable is unprintable any more.
const FileSeparator = "/"

// FileSourceID is the lattice source ID for one file synced by a connector: the
// connector's own ID, FileSeparator, then the ID minted for that file.
//
// It is the file's ID and not its path. A path may hold spaces, quotes, brackets
// or its own separators, and a source id has to survive being addressed by a
// model and echoed back exactly; an id can never carry any of that. The path
// travels beside it as the source's label, which is how the file is recognised
// and how its id is recovered on the next sync.
//
// Every source ID a connector owns starts with connectorID+FileSeparator, so
// SourcesUnder(projectID, connectorID+FileSeparator) still enumerates exactly
// the files currently synced for that connector.
func FileSourceID(connectorID, fileID string) string {
	return connectorID + FileSeparator + fileID
}

// Connector is a project-scoped external-source binding. Path is the provider
// endpoint Omega polls for content (for local-folder, the watcher's HTTP URL);
// empty until configured.
// Fingerprint / SyncSeq / SyncedAt track the last sync into the lattice: the
// fingerprint of the content last synced, a monotonically increasing sync
// sequence, and when it last synced. SyncSeq is zero before the first sync.
// FailedAttempts / LastError / RetryAfter track a sync that is failing: how many
// consecutive attempts have failed, why the last one did, and the earliest the
// automatic path may try again. All three are cleared by a successful sync.
type Connector struct {
	ID             string
	ProjectID      string
	Name           string
	SubKind        SubKind
	Path           string
	CreatorID      string
	Fingerprint    string
	SyncSeq        int64
	SyncedAt       time.Time
	FailedAttempts int
	LastError      string
	RetryAfter     time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// Store persists connector records within a project.
type Store interface {
	InsertConnector(c Connector) error
	ConnectorByID(projectID, id string) (Connector, error)
	ConnectorSummaries(projectID string) ([]Connector, error)
	UpdateConnector(c Connector) error
	DeleteConnector(projectID, id string) error
	// SetConnectorSyncState records a successful sync — and, because success is
	// what ends a failure, clears FailedAttempts / LastError / RetryAfter in the
	// same write. A connector that has just synced is not also mid-retry, and
	// leaving the two facts to separate writes is how they would disagree.
	SetConnectorSyncState(projectID, id, fingerprint string, seq int64, at time.Time) error
	// SetConnectorSyncFailure records a failing sync's state. attempts is the
	// consecutive-failure count, lastErr the cause, and retryAfter the earliest the
	// automatic path may try again (zero means it may not — see NeedsAttention).
	// Passing 0/""/zero clears the failure.
	SetConnectorSyncFailure(projectID, id string, attempts int, lastErr string, retryAfter time.Time) error
	// AllConnectors lists every connector across all projects, for the change
	// detector.
	AllConnectors() ([]Connector, error)
}

// Connectors is the connector service over an injected Store. When wired for
// syncing (see NewWithSync) it also holds a provider factory and a lattice writer.
type Connectors struct {
	store     Store
	now       func() time.Time
	providers ProviderFactory
	lattice   LatticeWriter
	costs     CostRecorder
	cascader  Cascader
	// syncing serializes a sync against itself, per connector. Two callers reach
	// the sync path concurrently in normal operation: the background change
	// detector on its interval, and an explicit sync request. Without this they
	// both write the same lattice sources and the same connector sync state at
	// once. Different connectors still sync in parallel.
	syncing dispatch.KeyedMutex
	// retry bounds how hard a failing sync is retried.
	retry syncRetry
	log   logging.Logger
}

// syncRetry bounds how hard a failing sync is retried. Without it, sync is a
// reconciliation loop with no memory: the detector compares the source's
// fingerprint to the stored one every tick, a failed sync records no state, so
// the next tick decides to sync again — and re-embeds the whole connector from
// zero, at provider rates, for as long as the failure lasts.
//
// The three numbers answer three different questions. backoff is how long to
// wait after the first failure; maxBackoff caps the doubling so a long outage
// settles into a steady, cheap poll rather than an ever-lengthening one; and
// maxAttempts is where automatic retrying stops altogether, because a sync that
// has failed that many times is not waiting on a transient condition.
type syncRetry struct {
	maxAttempts int
	backoff     time.Duration
	maxBackoff  time.Duration
}

// The retry defaults. Deliberately patient rather than eager: a connector sync
// is not latency-sensitive — nothing is waiting on it — and its failure modes
// (an unreachable provider, a rate limit, a folder that has gone away) are the
// kind that resolve on a human timescale or not at all.
const (
	defaultSyncMaxAttempts = 3
	defaultSyncBackoff     = 30 * time.Second
	defaultSyncMaxBackoff  = 15 * time.Minute
)

// New constructs the service. now defaults to time.Now when nil.
func New(store Store) *Connectors {
	return &Connectors{
		store: store, now: time.Now,
		retry: syncRetry{
			maxAttempts: defaultSyncMaxAttempts,
			backoff:     defaultSyncBackoff,
			maxBackoff:  defaultSyncMaxBackoff,
		},
		log: logging.Nop{},
	}
}

// UseSyncRetry bounds how hard a failing sync is retried: how many consecutive
// failures are tolerated before automatic syncing stops, the delay after the
// first failure, and the cap on that delay's doubling. Any non-positive value
// keeps the default for that field.
func (c *Connectors) UseSyncRetry(maxAttempts int, backoff, maxBackoff time.Duration) {
	if maxAttempts > 0 {
		c.retry.maxAttempts = maxAttempts
	}
	if backoff > 0 {
		c.retry.backoff = backoff
	}
	if maxBackoff > 0 {
		c.retry.maxBackoff = maxBackoff
	}
}

// NeedsAttention reports whether a connector has exhausted its automatic sync
// attempts. Such a connector is no longer snapshotted or synced on the
// detector's interval: it has failed the same way enough times that continuing
// to try is spending money on a condition only a person can clear. Sync — the
// explicit request — clears it.
//
// It is derived rather than stored so that the attempt cap remains a
// configuration value with one meaning. A stored flag would freeze the cap that
// happened to be in force when the connector failed, and raising the cap would
// not give an already-stopped connector the extra attempts it now allows.
func (c *Connectors) NeedsAttention(rec Connector) bool {
	return c.retry.maxAttempts > 0 && rec.FailedAttempts >= c.retry.maxAttempts
}

// delay returns how long to wait before the retry that follows the nth
// consecutive failure: backoff × 2^(n-1), capped at maxBackoff.
//
// It is the job pool's curve (job/pool.go), on purpose. A failing sync and a
// failing job are the same problem — an operation whose cause of failure may or
// may not still be there — and one backoff shape in the system is easier to
// reason about, and to tune, than two that differ for no reason.
func (r syncRetry) delay(attempts int) time.Duration {
	d := r.backoff
	for i := 1; i < attempts; i++ {
		d *= 2
		if d >= r.maxBackoff {
			return r.maxBackoff
		}
	}
	return d
}

// UseLogger sets the sink for operational narration (a file skipped for size, a
// sync that has stopped retrying). Nil is a Nop, which is also the default.
func (c *Connectors) UseLogger(l logging.Logger) { c.log = logging.OrNop(l) }

// UseCostRecorder sets the sink that receives each sync's token cost. A nil
// recorder (the default) simply discards it.
func (c *Connectors) UseCostRecorder(r CostRecorder) { c.costs = r }

// UseCascader sets the sink notified after a changed sync so dependents can be
// refreshed. A nil cascader (the default) means no cascade.
func (c *Connectors) UseCascader(x Cascader) { c.cascader = x }

// Create makes a new connector of the given subkind with no path yet.
func (c *Connectors) Create(projectID string, actor Actor, name string, sub SubKind) (Connector, error) {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > maxName {
		return Connector{}, ErrInvalidName
	}
	if !validSubKind(sub) {
		return Connector{}, ErrInvalidSubKind
	}
	at := c.clock()
	rec := Connector{
		ID: newID(), ProjectID: projectID, Name: name, SubKind: sub,
		CreatorID: actor.ID, CreatedAt: at, UpdatedAt: at,
	}
	if err := c.store.InsertConnector(rec); err != nil {
		return Connector{}, err
	}
	return rec, nil
}

// Get returns one connector scoped to its project.
func (c *Connectors) Get(projectID, id string) (Connector, error) {
	return c.store.ConnectorByID(projectID, id)
}

// Summaries lists a project's connectors (unordered; the catalog sorts).
func (c *Connectors) Summaries(projectID string) ([]Connector, error) {
	return c.store.ConnectorSummaries(projectID)
}

// Configure sets a connector's provider endpoint — the address of the external
// watcher/provider Omega polls for content (for local-folder, the watcher's HTTP
// URL). The value must be non-empty; its format is the provider's concern and is
// validated when the provider is actually reached, so this capability stays free
// of any provider-specific transport knowledge.
func (c *Connectors) Configure(projectID, id, endpoint string) (Connector, error) {
	rec, err := c.store.ConnectorByID(projectID, id)
	if err != nil {
		return Connector{}, err
	}
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		return Connector{}, ErrInvalidPath
	}
	rec.Path = endpoint
	rec.UpdatedAt = c.clock()
	if err := c.store.UpdateConnector(rec); err != nil {
		return Connector{}, err
	}
	return rec, nil
}

// Rename changes a connector's display name.
func (c *Connectors) Rename(projectID string, actor Actor, id, name string) (Connector, error) {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > maxName {
		return Connector{}, ErrInvalidName
	}
	rec, err := c.store.ConnectorByID(projectID, id)
	if err != nil {
		return Connector{}, err
	}
	rec.Name = name
	rec.UpdatedAt = c.clock()
	if err := c.store.UpdateConnector(rec); err != nil {
		return Connector{}, err
	}
	return rec, nil
}

// Delete removes a connector.
func (c *Connectors) Delete(projectID string, actor Actor, id string) error {
	return c.store.DeleteConnector(projectID, id)
}

func (c *Connectors) clock() time.Time {
	if c.now == nil {
		return time.Now().UTC()
	}
	return c.now().UTC()
}

func newID() string {
	buf := make([]byte, 16)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}

// FileKeyID derives the stable per-file half of a source id from the provider's
// own key for that file.
//
// It replaces a minted random id, and the reason is not the connector's: window
// ids in the lattice are derived from the source they belong to, so a random
// source id made a fresh ingest of identical content produce a different lattice
// (see knowledge.windowID). Deriving this closes the last random input to that
// chain.
//
// It is a HASH of the key, never the key. Record 0133 is the constraint: a source
// id is handed to a model as evidence and has to come back byte-exact in a
// citation, and a path holds spaces, quotes, brackets and separators that do not
// survive that trip — a live run returned U+FFFD where a byte had been and a
// correct answer was rejected. Hex survives it. The key travels beside the id as
// the source's label, which is how a person recognises the file.
//
// Two connectors syncing the same path stay distinct, because FileSourceID
// prefixes the connector's own id.
func FileKeyID(key string) string {
	sum := sha256.Sum256([]byte(key))
	return hex.EncodeToString(sum[:16])
}
