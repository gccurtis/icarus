// Package knowledge maintains a per-project retrieval lattice over source text
// and answers grounded retrieval queries against it. A source (a document today,
// other resource types later) is registered under an internal local reference id,
// its text is split into overlapping windows, each window is embedded, and the
// windows are clustered — within the source, then across the project's sources —
// by the KLR rule: a cluster is a maximal set whose members are all pairwise
// similar above a level-relative threshold, clusters may overlap, and artifacts
// that cluster nowhere stay orphans and carry upward unchanged. A source
// therefore ends as a forest of roots and orphans (its frontier), never a forced
// single summary; the corpus tier clusters the union of every source's frontier
// the same way. Retrieval embeds a query and ranks windows against it, returning
// cited spans.
//
// Knowledge is inference-free: it retrieves grounded spans, it never synthesizes
// an answer. It consumes embeddings through a narrow Embedder port, so it never
// imports the intelligence service directly.
package knowledge

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/gccurtis/taurus-omega/core/platform/job"
	"github.com/gccurtis/taurus-omega/core/platform/logging"
)

// SourceTypeDocument is the source type for a document. Other resource types will
// add their own as they begin feeding the lattice.
const SourceTypeDocument = "document"

// SourceTypeConnector is the source type for connector-synced external content.
const SourceTypeConnector = "connector"

// SourceTypeAttachment is the source type for content attached to a chat. An
// attachment is admitted Knowledge like any other source, so a turn retrieves
// and cites an uploaded file exactly as it would a document or a connector's
// file — rather than the file being inlined into the prompt as material the
// answer has no way to cite.
const SourceTypeAttachment = "attachment"

// SourceIDSeparator joins a grouping id to a member's own id inside a composite
// source id (for example a connector id and one of its files, or a directory
// upload and one of its members).
//
// Both halves are minted ids, never names, so the separator only has to be a
// character an id cannot contain — and ids are hex. It was a unit separator
// (0x1F) on the theory that an unprintable byte could never collide with a path
// segment. That was true and beside the point: a source id is handed to a model
// in evidence and must come back byte-exact in a citation, and an unprintable
// byte does not survive that trip. A live run returned U+FFFD where the 0x1F had
// been, and a correct answer was rejected as citing evidence that was never
// retrieved. Nothing in a source id is now unprintable, and nothing in one is a
// name.
const SourceIDSeparator = "/"

// GroupSourceID composes the source id for one member of a group, and
// GroupSourceIDPrefix returns the prefix matching every member of that group —
// the pair that lets a whole upload or connector be listed and removed as a
// unit through SourcesUnder.
//
// member is the member's ID, not its name. A name may hold spaces, quotes,
// brackets or a path separator; an id holds none of them, so composing with one
// keeps a source id addressable no matter what a user called their file. The
// human name travels beside it as Source.Label.
func GroupSourceID(groupID, member string) string {
	return groupID + SourceIDSeparator + member
}

// GroupSourceIDPrefix returns the SourcesUnder prefix that matches every member
// of groupID and nothing else.
func GroupSourceIDPrefix(groupID string) string {
	return groupID + SourceIDSeparator
}

// Windowing and retrieval defaults. The window target is ~1000 tokens
// (approximated as ~4 runes per token for English text) so references,
// pronouns and local argument structure resolve within the embedded text;
// overlap carries roughly a sentence or two across each cut.
const (
	defaultWindowTargetRunes  = 4000
	defaultWindowOverlapRunes = 400
	defaultTopK               = 5
	defaultCharBudget         = 4000 // retrieval output budget, in bytes of region text
	// defaultCommitWindowBudget is how many windows an ingest holds before
	// committing. At 4000 runes of text plus a 1536-dim float64 vector (12KB), a
	// window in flight is on the order of 20KB, so 2000 of them is ~40MB — small
	// beside the pairwise matrix a rebuild allocates, which is the real ceiling.
	defaultCommitWindowBudget = 2000
	// An untrusted source still has to be bounded before it can create windows.
	// These are intentionally separate from the artifact cap: the former stops a
	// never-ending stream before it dominates the process, the latter bounds the
	// durable/rebuildable lattice.
	defaultMaxSourceBytes int64 = 64 << 20
	defaultMaxRunBytes    int64 = 512 << 20
)

// Descent defaults: a narrow beam and a deliberately high similarity threshold,
// per the KLR starting point — calibrate against the exact-scan audit before
// trusting wider settings.
const (
	defaultDescentBeam      = 3
	defaultDescentThreshold = 0.35
	maxDescentExpansions    = 256 // hard backstop on nodes expanded per query
)

// Options are the calibration knobs, all optional: zero values take the
// defaults above (and the clustering defaults in lattice.go).
type Options struct {
	WindowTargetRunes  int     // ~4·(target tokens); default 4000
	WindowOverlapRunes int     // trailing-sentence overlap budget; default 400
	ClusterPercentile  float64 // where in a level's similarity distribution the threshold sits; default 0.75
	ClusterFloor       float64 // the threshold never drops below this; default 0.30

	// Descent tuning. Retrieval is directed descent, always — the exact scan
	// survives as RetrieveExact, the reference oracle tests hold descent to,
	// and as the in-production fallback when descent surfaces nothing.
	DescentBeam      int     // node-children followed per expansion; default 3
	DescentThreshold float64 // minimum query similarity to follow or collect; default 0.35
	// CharBudget bounds how much region text one retrieval returns; default 4000.
	CharBudget int

	// CommitWindowBudget is how many windows an ingest holds before committing
	// them and moving on; default 2000. It bounds peak memory during a sync to
	// O(slice) rather than O(sync), and it is what makes a failure leave forward
	// progress behind: the slices that landed stay landed, and the retry skips
	// them.
	//
	// It is a commit boundary, never an admission limit. A single source with
	// more windows than the budget is still ingested whole — refusing it would
	// refuse exactly the large files this bound exists to make affordable.
	CommitWindowBudget int

	// MaxSourceBytes and MaxRunBytes bound actual decoded bytes read while
	// planning a source and a whole AddBatch respectively. A zero value takes a
	// safe default; a negative value disables that one limit only for a deliberate
	// test or deployment choice.
	MaxSourceBytes int64
	MaxRunBytes    int64

	// MaxArtifacts is the most artifacts — windows plus nodes — one project's
	// lattice may hold. Unlike CommitWindowBudget this IS an admission limit:
	// crossing it is refused, because a corpus rebuild holds every frontier
	// vector at once and the alternative to refusing is being OOM-killed
	// mid-sync. See artifact_limit.go.
	//
	// 0 or less means unbounded. The composition root always supplies a number
	// derived from the memory budget, so that is the shape a test takes, and a
	// negative value in the manifest is the operator's deliberate opt-out.
	MaxArtifacts int

	// MaxClusterPool is the crossover between the exact and sparse clustering
	// constructions; default 4000. A level whose pool fits inside it clusters
	// over the complete pairwise matrix (exact, and fast at that size); a
	// larger level clusters over the k-NN graph. It still guards the exact
	// path's allocation — the matrix is n²·8 bytes regardless of vector
	// dimension — but no pool is refused for exceeding it.
	MaxClusterPool int

	// NeighborsK is how many neighbours each artifact keeps in the k-NN graph;
	// it also caps cluster size, since a clique cannot exceed its members'
	// degree. Default 32.
	NeighborsK int
	// NeighborsCells is the IVF cell count for candidate search; 0 derives
	// √pool.
	NeighborsCells int
	// NeighborsPCADims is the projection dimension for candidate generation.
	// 0 takes the default (128); negative disables projection entirely, so
	// candidates are scored at full dimension.
	NeighborsPCADims int
	// NeighborsRepairMaxFraction bounds the changed fraction a stored level
	// index may absorb as a local repair; past it the level rebuilds in full.
	// 0 takes the default (0.2); negative disables repair entirely.
	NeighborsRepairMaxFraction float64
	// NeighborsRepairMaxDrift bounds how far the pinned threshold may stray
	// from the pool's current percentile before a repair is refused and the
	// level consolidates. 0 takes the default (0.02).
	NeighborsRepairMaxDrift float64

	// Logger receives operational narration — most importantly, whether each
	// corpus rebuild was a local repair or a consolidation, and why. Nil is a
	// Nop, so tests need not supply one.
	Logger logging.Logger

	// Enqueuer schedules the corpus rebuild a write defers. Nil means rebuilds are
	// never scheduled and RebuildCorpus must be driven by hand — which is what a
	// test wanting a deterministic corpus tier does, rather than racing a worker.
	Enqueuer job.Enqueuer
}

// Source is a registered origin: its flattened text snapshot under an internal
// LocalRefID, plus the origin's own (SourceType, SourceID). Blocks maps byte
// ranges of the snapshot back to the origin's components (document rows/blocks),
// so a retrieved span cites real addresses, not just offsets into a disposable
// flattened string. AddedAt is when it first entered the lattice; SyncedAt is
// the last time it updated the lattice; Revision is the origin's version at
// sync time (used for per-source staleness checks).
type Source struct {
	LocalRefID string `json:"localRefId"`
	SourceType string `json:"sourceType"`
	SourceID   string `json:"sourceId"`
	// Label is the source's human name — a connector file's path relative to its
	// root, an attachment's filename. It exists because SourceID is a composite of
	// minted ids and says nothing a person recognises; this is the other half of
	// that trade, and it lets composition map indexed connector or attachment
	// evidence back to a stable Resource locator. Empty where the id is already
	// the name a caller knows, as for a document.
	Label     string      `json:"label,omitempty"`
	ProjectID string      `json:"projectId"`
	Blocks    []BlockSpan `json:"blocks,omitempty"`
	// SizeBytes, LineCount and ContentHash describe the snapshot that was
	// indexed, without keeping it. They are what remains of the source text: the
	// two numbers a listing reports, and the identity a re-sync compares against
	// to decide whether anything changed.
	//
	// The hash is what makes that comparison affordable once ingest streams — a
	// 5MB file can be hashed as it is read, whereas comparing whole strings means
	// holding both.
	SizeBytes   int            `json:"sizeBytes"`
	LineCount   int            `json:"lineCount"`
	ContentHash string         `json:"contentHash,omitempty"`
	Identity    VectorIdentity `json:"identity"`
	AddedAt     time.Time      `json:"addedAt"`
	SyncedAt    time.Time      `json:"syncedAt"`
	Revision    int64          `json:"revision"`
}

// BlockSpan maps one byte range of a source's flattened text to the origin
// component it came from.
type BlockSpan struct {
	RowID   string `json:"rowId"`
	BlockID string `json:"blockId"`
	Start   int    `json:"start"`
	End     int    `json:"end"`
}

// BlockRef names one origin component a retrieved span touches.
type BlockRef struct {
	RowID   string `json:"rowId"`
	BlockID string `json:"blockId"`
}

// Window is a chunk of a source's text, with the unit-normalized embedding of that
// chunk.
// A window carries its own Text and the Blocks that text covers, so an artifact is
// self-contained: everything a citation needs travels with the thing being cited,
// and no reader has to hold a second copy of the source to interpret a range.
//
// Start/End remain, and mean "the byte range this text occupied in the source at the
// time it was indexed". They are how windows are ordered and merged into regions;
// they are no longer an instruction to go and slice something else.
//
// Text and Blocks are loaded ONLY by the queries that need them — SourceWindows (for
// embedding reuse) and WindowContent (for regions). The vector-only reads used for
// ranking, descent and the corpus rebuild leave them empty on purpose: loading the
// corpus's text to rank vectors would reintroduce the cost this change removes.
type Window struct {
	ID         string     `json:"id"`
	LocalRefID string     `json:"localRefId"`
	Ordinal    int        `json:"ordinal"`
	Start      int        `json:"start"`
	End        int        `json:"end"`
	Text       string     `json:"-"`
	Blocks     []BlockRef `json:"-"`
	Embedding  []float64  `json:"-"`
}

// WindowContent is one window's citable content: its own text and the origin
// components that text covers. It is what a region is assembled from.
type WindowContent struct {
	Text   string
	Blocks []BlockRef
}

// Node is a lattice cluster artifact: one maximal clique's representative. Its
// centroid is the normalized sum of its members' vectors, Count how many members
// it has, and Cohesion the weakest pairwise similarity inside the clique.
// Members may be windows or lower nodes, and — because cliques overlap — one
// member may appear under several parents, so the lattice is a DAG. LocalRefID
// scopes a node to one source; empty marks the corpus tier. Roots are not
// flagged: the frontier (nodes that are no one's member, plus never-clustered
// orphan windows) is derived.
type Node struct {
	ID         string    `json:"id"`
	ProjectID  string    `json:"projectId"`
	LocalRefID string    `json:"localRefId"`
	Level      int       `json:"level"`
	Centroid   []float64 `json:"-"`
	Count      int       `json:"count"`
	Cohesion   float64   `json:"cohesion"`
	MemberIDs  []string  `json:"memberIds"`
	CreatedAt  time.Time `json:"-"`
}

// FrontierEntry is one member of a source's frontier — a root node or an orphan
// window — carrying the vector the corpus tier clusters by.
type FrontierEntry struct {
	ID       string
	Vector   []float64
	IsWindow bool
}

// CorpusLevelIndex is one level of the corpus ascent's persisted k-NN index:
// the pinned threshold, the candidate machinery (projection basis, IVF cell
// centroids), and each live artifact's cell and edges. It is derived state — a
// rebuild can always recreate it from the frontier — persisted so the NEXT
// rebuild can treat a small change as a local repair instead of a global
// reconstruction. Vectors are deliberately absent: they live with the windows
// and nodes, and the index refers to them by artifact id.
type CorpusLevelIndex struct {
	Level     int
	Threshold float64
	K         int
	Basis     [][]float64
	Centroids [][]float64
	Artifacts []CorpusIndexArtifact
}

// CorpusIndexArtifact is one artifact's entry in a persisted level index: the
// IVF cell it was assigned and its graph edges.
type CorpusIndexArtifact struct {
	ID    string
	Cell  int
	Edges []CorpusIndexEdge
}

// CorpusIndexEdge is one stored edge: the neighbour's artifact id and the
// exact full-dimension similarity of the pair.
type CorpusIndexEdge struct {
	To  string
	Sim float64
}

// Usage reports the embedding token consumption a call incurred, so a test run
// (or caller) can surface its provider cost.
type Usage struct {
	PromptTokens int     `json:"promptTokens"`
	TotalTokens  int     `json:"totalTokens"`
	Requests     int     `json:"requests,omitempty"`
	CostUSD      float64 `json:"costUsd,omitempty"`
}

// VectorIdentity names the embedding space a set of vectors belongs to. Vectors
// from different identities are not comparable — a cast is only a semantic
// alias, and configuration may re-route it to another model at any time, so the
// resolved identity is stamped on every source at ingestion and checked against
// the query embedding at retrieval. All stored vectors are unit-normalized.
type VectorIdentity struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
	Dims     int    `json:"dims"`
}

// Embedded is one embedding call's outcome: the vectors, the usage it cost, and
// the identity of the space they live in.
type Embedded struct {
	Vectors  [][]float64
	Usage    Usage
	Identity VectorIdentity
}

// PartialEmbeddingError preserves usage from completed provider micro-batches
// when a later one fails. Its vectors are intentionally not admitted: source
// publication remains all-or-nothing, while callers can still account for the
// paid prefix and resume from the last committed slice.
type PartialEmbeddingError struct {
	CompletedInputs int
	Usage           Usage
	Cause           error
}

func (e *PartialEmbeddingError) Error() string {
	if e == nil || e.Cause == nil {
		return "knowledge embedding stopped after a partial result"
	}
	return fmt.Sprintf("knowledge embedding stopped after %d completed input(s): %v", e.CompletedInputs, e.Cause)
}

func (e *PartialEmbeddingError) Unwrap() error { return e.Cause }

// ErrIdentityMismatch is retained as a source-compatibility alias. Identity
// drift is now an administrative generation migration, never an instruction to
// remove and re-add individual sources.
var ErrIdentityMismatch = ErrEmbeddingSpaceChangeRequired

// AddResult summarizes what an Add produced. On a re-sync, Reused counts the
// windows whose text was unchanged (their stored embedding was kept) and
// Embedded counts the windows that were actually sent to the provider — so
// Usage, and the cost it implies, reflects only what changed.
type AddResult struct {
	Source   Source `json:"source"`
	Windows  int    `json:"windows"`
	Nodes    int    `json:"nodes"`
	Reused   int    `json:"reused"`
	Embedded int    `json:"embedded"`
	Usage    Usage  `json:"usage"`
	// Skipped reports that the source was already stored with byte-identical
	// content, so nothing was rewritten and nothing was spent. Windows, Nodes and
	// Usage are all zero on a skip — the flag is what distinguishes "there was
	// nothing to do" from "this produced nothing".
	Skipped bool `json:"skipped,omitempty"`
	// Unreadable reports that the source's content could not be read, so it was
	// left out and whatever was already stored for it was left alone.
	//
	// It is a result rather than an error because one unreadable file must not
	// abandon the sync of everything beside it — and it is a *reported* result
	// rather than a log line because a file that silently failed to arrive looks
	// exactly like one that arrived. The person who synced the folder is not
	// reading the server's stderr.
	Unreadable error `json:"-"`
}

// RetrieveResult is a retrieval outcome: the grounded regions, the path that
// produced them ("descent"; "exact-fallback" when descent found nothing;
// "exact" from RetrieveExact, the reference oracle), and the query-embedding
// usage. There is no in-production audit — holding descent to the exact scan
// is a test's job, done against RetrieveExact.
type RetrieveResult struct {
	Regions       []Region `json:"regions"`
	Mode          string   `json:"mode"`
	Usage         Usage    `json:"usage"`
	GenerationID  string   `json:"generationId,omitempty"`
	SourceCursor  int64    `json:"sourceCursor"`
	SpaceIdentity string   `json:"spaceIdentity,omitempty"`
}

// SourceWrite is one source's complete replacement payload: its snapshot and the
// windows and nodes that belong to it. A batch of these is what ReplaceSources
// commits together.
type SourceWrite struct {
	Source  Source
	Windows []Window
	Nodes   []Node
}

// ArtifactCounts records the exact arithmetic performed at a transactional
// admission boundary. Corpus nodes are replacement artifacts just like a
// source's old nodes: they are excluded from Current when the same transaction
// deletes them, then Candidate is added before publication.
type ArtifactCounts struct {
	Current   int64 `json:"current"`
	Replaced  int64 `json:"replaced"`
	Candidate int64 `json:"candidate"`
	Total     int64 `json:"total"`
}

// AddItem is one source in an AddBatch — the same arguments Add takes, as a
// value so a caller can hand over a whole set at once.
type AddItem struct {
	SourceType string
	SourceID   string
	// Label is the source's human name; empty where the id is already the name a
	// caller knows (see Origin.Label).
	Label    string
	Content  Content
	Blocks   []BlockSpan
	Revision int64
}

// Content is a source's text, as something to read rather than something held.
//
// One shape for every caller, though the callers differ: a document is assembled
// in memory from its blocks, while a connector file is bytes on a disk that may
// be larger than the process. Giving the in-memory callers a reader over their
// string costs nothing and leaves ingest with a single path, instead of a
// materialized one and a streamed one that could drift.
type Content struct {
	// Size and Hash describe the content without reading it. Hash is the hex
	// SHA-256 that ContentHash produces, and supplying it is what lets an
	// unchanged source be skipped without being opened at all — the difference
	// between a re-sync costing a listing and costing the whole corpus.
	//
	// Both may be zero when the provider cannot answer cheaply, in which case
	// they are measured while reading.
	Size int64
	Hash string
	// Open returns the content. It is called at most once per add, and only for a
	// source that is actually being (re)indexed.
	Open func() (io.ReadCloser, error)
}

// TextContent wraps a string already in memory. Size and Hash are filled in
// because they are free here, which means an unchanged document is skipped on
// the same terms as an unchanged file.
func TextContent(text string) Content {
	return Content{
		Size: int64(len(text)),
		Hash: ContentHash(text),
		Open: func() (io.ReadCloser, error) { return io.NopCloser(strings.NewReader(text)), nil },
	}
}

// Embedder turns text into vectors, reporting the token usage the call incurred
// and the identity of the vector space it resolved to. The composition root
// adapts it to the intelligence embedding endpoint under a fixed cast.
type Embedder interface {
	Embed(ctx context.Context, texts []string) (Embedded, error)
}

// Store persists the lattice. One SQLite store implements it; an in-memory store
// backs tests.
type Store interface {
	// SourceByOrigin returns the source registered for a (type, id) origin.
	SourceByOrigin(projectID, sourceType, sourceID string) (Source, bool, error)
	// SourcesUnder returns the origin of every source of the given type whose
	// SourceID starts with sourceIDPrefix — the lattice enumeration primitive a
	// connector kind uses to list its current sub-keys (e.g. its files), order
	// unspecified.
	SourcesUnder(projectID, sourceType, sourceIDPrefix string) ([]Origin, error)
	// Sources returns every source record in this generation for a Project,
	// ordered by public origin. Re-embed manifests use it without loading vector
	// or literal evidence payloads.
	Sources(projectID string) ([]Source, error)
	// ReplaceSources atomically replaces every given source's snapshot, windows and
	// nodes, keyed by LocalRefID, and in the same transaction DROPS the project's
	// corpus tier and bumps its dirty sequence. All writes must belong to one
	// project.
	//
	// It does not rebuild. The rebuild is O(F²) in the project's whole frontier —
	// 7.8s at 4,000 artifacts — and running it here meant holding a write
	// transaction for its duration, serializing every other write in the project.
	// It is now RebuildCorpus, driven off the write path.
	//
	// The tier is dropped rather than left stale because this same transaction may
	// have deleted node and window ids the old tier references: descent would
	// follow corpus roots into dangling members and silently return less. With no
	// tier at all, retrieval enters at the source frontiers — a path the design
	// already declares valid — which is an honest degradation rather than a hole.
	ReplaceSources(writes []SourceWrite) error
	// DeleteSource removes a source (snapshot, windows, nodes, memberships) by
	// origin, dropping the corpus tier and bumping the dirty sequence the same way.
	// It reports whether the source existed; removing an unknown origin is a no-op.
	DeleteSource(projectID, sourceType, sourceID string) (bool, error)

	// CorpusSeq returns the project's (dirty, built) sequence pair. They are equal
	// when the corpus tier is current.
	CorpusSeq(projectID string) (dirty, built int64, err error)
	// RebuildCorpus stores a freshly computed corpus tier and marks it built at
	// seq. It also replaces the project's persisted level indexes WHOLESALE with
	// the given ones (nil clears them): tier, indexes and built seq land in one
	// transaction, so they can never describe different frontiers.
	//
	// The caller reads the frontier, computes outside any transaction (that is the
	// expensive part), and hands the result here to be written in one short
	// transaction. Passing the seq it computed against is what keeps that safe: a
	// write landing mid-computation bumps dirty past seq, so the tier is stored but
	// still reads as stale and the next rebuild picks it up. Nothing is lost, and
	// no write waited on the clustering.
	RebuildCorpus(projectID string, corpus []Node, seq int64, indexes []CorpusLevelIndex) error
	// CorpusIndexes returns the project's persisted level indexes, ascending by
	// level, with each level's artifacts ascending by id. Empty is a valid
	// answer meaning no index survives — the next rebuild builds in full.
	//
	// Note the indexes are NOT dropped when a write invalidates the corpus tier.
	// The tier is dropped because descent would follow it into dangling members;
	// the index is only ever read by the next rebuild, which diffs it against the
	// live frontier by artifact id — a stale index is exactly the input a repair
	// wants.
	CorpusIndexes(projectID string) ([]CorpusLevelIndex, error)
	// CorpusIndexHeader returns one persisted level's machinery — threshold, k,
	// basis, centroids — WITHOUT its artifacts. It exists for the retrieval
	// probe, which must place a query among the cells on every request and
	// cannot drag the whole edge set along to do it.
	CorpusIndexHeader(projectID string, level int) (CorpusLevelIndex, bool, error)
	// EntryFrontierProbed is EntryFrontier narrowed by a level index: the entry
	// artifacts the index assigned to the given cells, PLUS every entry
	// artifact the index does not cover at all (corpus roots above the level,
	// anything written since it was stored). The rule that keeps the probe
	// honest: approximation may narrow the indexed mass, never hide the
	// unindexed remainder.
	EntryFrontierProbed(projectID string, level int, cells []int) ([]FrontierEntry, error)

	// Retrieval reads, kept deliberately narrow so descent loads only what it
	// walks: the entry frontier, then members batch by batch as nodes are
	// expanded, then just the sources the final regions resolve against. Only the
	// exact scan (production path and audit oracle) reads every window.
	//
	// SourceFrontier returns every source's frontier — the source-tier roots and
	// the never-clustered orphan windows — which is what the corpus tier clusters.
	SourceFrontier(projectID string) ([]FrontierEntry, error)
	// Identities returns each source's vector identity, without its text.
	Identities(projectID string) (map[string]VectorIdentity, error)
	// EntryFrontier returns every artifact — either tier — that is no node's
	// member: corpus roots, corpus-unabsorbed source roots, orphan windows.
	EntryFrontier(projectID string) ([]FrontierEntry, error)
	// NodesByID and WindowsByID batch-fetch artifacts by id, silently skipping
	// unknown ids (an id is either a node or a window; callers probe both).
	NodesByID(ids []string) ([]Node, error)
	WindowsByID(ids []string) ([]Window, error)
	// ProjectWindows returns every window of the project, for the exact scan.
	ProjectWindows(projectID string) ([]Window, error)
	// WindowContent returns the citable content — own text, covered block refs — of
	// the given windows, keyed by id. Separate from the window reads above because
	// those handle whole projects and candidate sets and need only vectors: text is
	// loaded once, for the windows that reached an answer.
	WindowContent(ids []string) (map[string]WindowContent, error)
	// SourceWindows returns one source's current windows (with embeddings and text,
	// which the reuse map is keyed by), so a
	// re-sync can reuse the embeddings of windows whose text did not change.
	SourceWindows(localRefID string) ([]Window, error)
	// SourcesByRef returns the source records for the given local reference ids —
	// origin identity and metadata, no content. A region needs to say which origin
	// it came from to be citable; its text comes from the windows.
	SourcesByRef(refs []string) (map[string]Source, error)
	// ArtifactCounts reports how many artifacts — windows plus nodes — the project
	// holds, keyed by the local reference that owns them, with "" for the
	// corpus-tier nodes no single source owns.
	//
	// Counts rather than a read, because the pre-flight ceiling check runs before
	// every ingest and a guard that had to load the frontier to size it would
	// allocate the very thing it exists to prevent. Per source rather than one
	// total, because the check measures a batch's NET effect: a re-synced source's
	// existing artifacts are being replaced, and counting them on both sides is
	// what made a large project unable to re-sync at all.
	ArtifactCounts(projectID string) (map[string]int, error)
	// AdmitAndReplaceSources is the authoritative source-tier admission. It
	// computes current - exact replacement + exact candidate windows/nodes and
	// writes the replacement in the same transaction/critical section.
	AdmitAndReplaceSources(maxArtifacts int, writes []SourceWrite) (ArtifactCounts, error)
	// AdmitCorpus is the matching authoritative admission for the deferred
	// corpus tier, whose nodes are not knowable until the rebuild has run.
	AdmitCorpus(projectID string, maxArtifacts int, corpus []Node, seq int64, indexes []CorpusLevelIndex) (ArtifactCounts, error)
	// ProjectChangedSince reports whether any source in the project has a SyncedAt
	// after t — a cheap add/update signal for callers that cache retrieval results.
	ProjectChangedSince(projectID string, t time.Time) (bool, error)
}

// Knowledge is the lattice service, scoped per project by every method.
type Knowledge struct {
	store            ArtifactStore
	generations      GenerationStore
	embedder         Embedder
	cluster          clusterConfig
	windowTarget     int
	windowOverlap    int
	descentBeam      int
	descentThreshold float64
	charBudget       int
	commitBudget     int
	maxArtifacts     int
	maxSourceBytes   int64
	maxRunBytes      int64
	log              logging.Logger
	enqueuer         job.Enqueuer
	locators         ResourceLocatorResolver
	reembedAuth      ReembedAuthorizer
	reembedSources   ReembedSourceReader
	generationID     string
	now              func() time.Time
}

// UseResourceLocatorResolver supplies the composition-owned translation from a
// Knowledge origin to a Resource locator. Knowledge records evidence identity;
// Resource owns durable resource identity and later reauthorizes every read.
func (k *Knowledge) UseResourceLocatorResolver(r ResourceLocatorResolver) { k.locators = r }

// UseReembedPorts binds the administration and current-origin acquisition
// seams. They are late-bound because Resource/Document/Connector/File/Chat are
// composed after Knowledge; the final readiness gate verifies the cycle closed.
func (k *Knowledge) UseReembedPorts(auth ReembedAuthorizer, sources ReembedSourceReader) {
	k.reembedAuth = auth
	k.reembedSources = sources
}

// ValidateBoundPorts closes the Knowledge/Resource lookup cycle for production
// before any search tool can return an unresolvable canonical locator.
func (k *Knowledge) ValidateBoundPorts() error {
	if k.locators == nil {
		return errors.New("knowledge: resource locator resolver port is required")
	}
	if k.generations == nil {
		return errors.New("knowledge: generation lifecycle store is required")
	}
	if k.reembedAuth == nil {
		return errors.New("knowledge: re-embed authorizer port is required")
	}
	if k.reembedSources == nil {
		return errors.New("knowledge: re-embed source reader port is required")
	}
	return nil
}

// New builds the service over a store and embedder; zero-valued Options fields
// take the defaults.
func New(store Store, embedder Embedder, opts Options) *Knowledge {
	cluster := defaultClusterConfig()
	if opts.ClusterPercentile > 0 {
		cluster.percentile = opts.ClusterPercentile
	}
	if opts.ClusterFloor > 0 {
		cluster.floor = opts.ClusterFloor
	}
	if opts.MaxClusterPool > 0 {
		cluster.maxPool = opts.MaxClusterPool
	}
	if opts.NeighborsK > 0 {
		cluster.neighbors.k = opts.NeighborsK
	}
	if opts.NeighborsCells > 0 {
		cluster.neighbors.cells = opts.NeighborsCells
	}
	if opts.NeighborsPCADims != 0 {
		// Negative reaches fitProjection as "none": candidates are scored at
		// full dimension.
		cluster.neighbors.pcaDims = opts.NeighborsPCADims
	}
	if opts.NeighborsRepairMaxFraction != 0 {
		// Negative reaches repairDecision as "repair disabled".
		cluster.neighbors.repairMaxFraction = opts.NeighborsRepairMaxFraction
	}
	if opts.NeighborsRepairMaxDrift != 0 {
		cluster.neighbors.repairMaxDrift = opts.NeighborsRepairMaxDrift
	}
	target := opts.WindowTargetRunes
	if target <= 0 {
		target = defaultWindowTargetRunes
	}
	overlap := opts.WindowOverlapRunes
	if overlap <= 0 {
		overlap = defaultWindowOverlapRunes
	}
	beam := opts.DescentBeam
	if beam <= 0 {
		beam = defaultDescentBeam
	}
	threshold := opts.DescentThreshold
	if threshold <= 0 {
		threshold = defaultDescentThreshold
	}
	budget := opts.CharBudget
	if budget <= 0 {
		budget = defaultCharBudget
	}
	commitBudget := opts.CommitWindowBudget
	if commitBudget <= 0 {
		commitBudget = defaultCommitWindowBudget
	}
	k := &Knowledge{
		store: store, embedder: embedder, cluster: cluster,
		windowTarget: target, windowOverlap: overlap,
		descentBeam: beam, descentThreshold: threshold,
		charBudget:   budget,
		commitBudget: commitBudget,
		// Not defaulted: no number knowledge could pick here would be right on
		// both a container and a workstation, and picking one would bound a
		// project by the wrong machine's memory. Unset is unbounded, and the
		// composition root derives the real ceiling from the memory budget.
		maxArtifacts: opts.MaxArtifacts,
		maxSourceBytes: func() int64 {
			if opts.MaxSourceBytes != 0 {
				return opts.MaxSourceBytes
			}
			return defaultMaxSourceBytes
		}(),
		maxRunBytes: func() int64 {
			if opts.MaxRunBytes != 0 {
				return opts.MaxRunBytes
			}
			return defaultMaxRunBytes
		}(),
		log:      logging.OrNop(opts.Logger),
		enqueuer: opts.Enqueuer,
		now:      time.Now,
	}
	if generations, ok := any(store).(GenerationStore); ok {
		k.generations = generations
	}
	return k
}

// MaxSourceBytes is the resolved decoded-byte cap. A non-positive value is an
// explicit deployment opt-out; composition adapters may use a trusted local
// size to avoid materializing a File that cannot fit.
func (k *Knowledge) MaxSourceBytes() int64 { return k.maxSourceBytes }

// MaxRunBytes is the resolved decoded-byte cap for one AddBatch run.
func (k *Knowledge) MaxRunBytes() int64 { return k.maxRunBytes }

// ChangedSince reports whether the project's knowledge changed (any source added
// or re-synced) after t. It is the cheap signal a prompt-block refresh uses to
// decide whether re-resolution is warranted — no retrieval, no model call. It is
// deliberately project-granular ("has anything changed"), so an unrelated add
// also reports true; that favors freshness over minimal churn, and a source
// *removal* is not reflected (the row is gone), which a reload still catches.
func (k *Knowledge) ChangedSince(projectID string, t time.Time) (bool, error) {
	if k.generations != nil {
		return k.generations.ChangedSince(projectID, LatticeText, t)
	}
	if legacy, ok := k.store.(interface {
		ProjectChangedSince(string, time.Time) (bool, error)
	}); ok {
		return legacy.ProjectChangedSince(projectID, t)
	}
	return false, nil
}

// SourcesUnder lists the origins currently registered under a (sourceType,
// sourceID-prefix) — the lattice enumeration primitive a connector uses to
// prune vanished files (diff the current listing against this) and to expand
// itself to its files.
func (k *Knowledge) SourcesUnder(projectID, sourceType, sourceIDPrefix string) ([]Origin, error) {
	if k.generations != nil {
		token, _, _, err := k.generations.Active(projectID, LatticeText)
		if errors.Is(err, ErrEmbeddingSpaceUnavailable) {
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		return k.generations.ForGeneration(token.GenerationID).SourcesUnder(projectID, sourceType, sourceIDPrefix)
	}
	return k.store.SourcesUnder(projectID, sourceType, sourceIDPrefix)
}

// Origin names one source by its public (type, id) identity — the addressing the
// caller knows, before the lattice's internal LocalRefID.
//
// Label carries the source's human name alongside it. That is what makes the
// lattice the registry: a caller that knows a member by name — a connector
// diffing the files its watcher just reported — recovers the id it minted last
// sync by looking the name up here, instead of keeping a second table in step
// with this one.
type Origin struct {
	SourceType string
	SourceID   string
	Label      string
}

// coveredBlocks returns the origin components a byte range touches, in source
// order.
// CoveredBlocks is exported for one reason: the migration that backfills a window's
// own block refs has to answer exactly the same question this does. Two definitions
// of "which origin components does this byte range touch" would be two chances to
// disagree, and a disagreement here is a citation pointing at the wrong component.
func CoveredBlocks(blocks []BlockSpan, start, end int) []BlockRef {
	return coveredBlocks(blocks, start, end)
}

func coveredBlocks(blocks []BlockSpan, start, end int) []BlockRef {
	var out []BlockRef
	for _, b := range blocks {
		if b.Start < end && start < b.End {
			out = append(out, BlockRef{RowID: b.RowID, BlockID: b.BlockID})
		}
	}
	return out
}

func newID() string {
	b := make([]byte, 16)
	// crypto/rand.Read never returns an error on the platforms we target.
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
