# model.go

Core data model types: Atom, Block, Row, Base, Document, DocumentAnchor,
formula/prompt/list/image data, marks, anchors, activity types, Store interface,
Diff types, and all constants.

## Code breakdown

### Project scoping of `Store.DocumentByID` (DEF-1)

`DocumentByID` takes the project id as its first parameter. The store filters on
it — in SQLite it joins the `WHERE` clause — so a document owned by another
project is `ErrNotFound` rather than a row returned for the caller to inspect.
This finishes DEF-1 for documents, extending the in-SQL scoping record 0115
introduced for `file.Meta`/`file.Content`.

Every service method that loads a document already had the project id in hand, so
threading it through was mechanical: `Get`, `Summary`, `Rename`, `Duplicate`,
`Delete`, `Restore`, `Purge`, `GetAtRevision`, `Undo`, `Redo`, the anchor
methods, `History`, `ChangeSet`, `submitChangesAt`, `Rebase`, and
`sourcesChanged` all pass their own `projectID`.

Those services still compare `doc.ProjectID != projectID` after loading and still
return `ErrNotFound`. The comparison is **deliberately redundant** with the
store's filter and must not be removed as "now unnecessary" — one layer covers a
store that does not scope, the other covers a caller that forgets to check.

```go
// Package document is the document resource: a document is a named piece of
// revisioned content that lives within a project, with document-wide page
// geometry and an ordered list of styled rows containing typed blocks.
//
// A document is stored as a base plus an append-only list of change sets. Reads
// resolve pending sets over the base; re-base folds them into a new base. The
// capability also owns prompt-block resolution and emits bounded Activity facts
// for canonical user-visible mutations.
package document

import (
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// Atom is one inline content unit within a block. Every atom carries display
// Text; Kind selects how that text is produced. Only AtomKindText is supported
// now — formula and prompt atom kinds are the seam for a later increment.
type Atom struct {
	ID   string   `json:"id"`
	Kind string   `json:"kind"`
	Text string   `json:"text"`
	Data AtomData `json:"data,omitempty"`
}

// AtomData is an atom kind's typed, kind-specific payload — the "subtype" over
// the shared Atom base. A text atom carries none; a formula atom carries
// FormulaData.
type AtomData interface {
	atomKind() string
}

// FormulaResult holds the evaluated output of a formula atom: a typed value and
// an optional error. One of Value or Error is always set after evaluation.
type FormulaResult struct {
	Value string `json:"value,omitempty"`
	Type  string `json:"type,omitempty"`
	Error string `json:"error,omitempty"`
}

// FormulaDep records one name dependency and the time it was last evaluated.
type FormulaDep struct {
	NameID      string    `json:"nameId"`
	EvaluatedAt time.Time `json:"evaluatedAt"`
}

// FormulaData is the formula atom's payload: the expression, the latest
// evaluation result (denormalized from History for quick access), an
// append-only history of every evaluation, the dependency snapshot, and
// the evaluation state.
type FormulaData struct {
	Expression   string                `json:"expression"`
	Result       FormulaResult         `json:"result,omitempty"`
	Dependencies []FormulaDep          `json:"dependencies,omitempty"`
	State        string                `json:"state"`
	History      []FormulaHistoryEntry `json:"history,omitempty"`
}

// FormulaHistoryEntry is one evaluation record: the result, dependencies at
// evaluation time, the outcome state, and the wall-clock time it was evaluated.
type FormulaHistoryEntry struct {
	Result       FormulaResult `json:"result"`
	Dependencies []FormulaDep  `json:"dependencies,omitempty"`
	State        string        `json:"state"`
	EvaluatedAt  time.Time     `json:"evaluatedAt"`
}

func (FormulaData) atomKind() string { return AtomKindFormula }

// Formula atom evaluation states.
const (
	FormulaStatePending = "pending"
	FormulaStateOK      = "ok"
	FormulaStateError   = "error"
)

// AtomKindText is the only atom kind currently supported: literal text.
const AtomKindText = "text"

// AtomKindFormula is a formula atom: its display text is the rendered result,
// and its Data carries the expression, evaluation state, and dependency versions.
const AtomKindFormula = "formula"

// UnmarshalJSON decodes an atom, selecting the concrete AtomData subtype from
// the atom's Kind.
func (a *Atom) UnmarshalJSON(data []byte) error {
	var raw struct {
		ID   string          `json:"id"`
		Kind string          `json:"kind"`
		Text string          `json:"text"`
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	a.ID, a.Kind, a.Text = raw.ID, raw.Kind, raw.Text
	if len(raw.Data) > 0 && string(raw.Data) != "null" {
		switch raw.Kind {
		case AtomKindFormula:
			var fd FormulaData
			if err := json.Unmarshal(raw.Data, &fd); err != nil {
				return err
			}
			a.Data = fd
		}
	}
	return nil
}

// Anchor points at a position inside an atom: a UTF-8 byte offset into the
// atom's text that must land on a rune boundary.
type Anchor struct {
	AtomID string `json:"atomId"`
	Offset int    `json:"offset"`
}

// Mark applies inline styling (bold, italic, a link, and so on) to the range
// that runs from Start to End across a block's atoms.
type Mark struct {
	ID    string            `json:"id"`
	Kind  string            `json:"kind"`
	Attrs map[string]string `json:"attrs,omitempty"`
	Start Anchor            `json:"start"`
	End   Anchor            `json:"end"`
}

// Block is a structural unit with a kind (paragraph, heading, and so on) and
// block-level alignment. Its content is an ordered list of atoms — a block's
// display text is the concatenation of its atoms' text — and marks style ranges
// across those atoms.
//
// Every block shares this base shape; a kind that needs kind-specific state
// carries it in Data, a typed BlockData "subtype" (nil for text and code
// blocks). Inferred marks a block whose content was produced by the
// system rather than authored — a prompt block's generated text — so that
// generated content can be excluded where only source text belongs (it is left
// out of the text fed to the knowledge lattice).
//
// SubKind applies only to the text kind: it names the block's semantic role —
// a built-in (body, heading_1…heading_6) or a user-defined style definition in
// the document's registry. A non-text block carries no sub-kind; a text block
// defaults to body.
type Block struct {
	ID       string         `json:"id"`
	Kind     string         `json:"kind"`
	SubKind  string         `json:"subKind,omitempty"`
	Style    BlockStyle     `json:"style"`
	StyleRef *BlockStyleRef `json:"styleRef,omitempty"`
	Inferred bool           `json:"inferred,omitempty"`
	Atoms    []Atom         `json:"atoms"`
	Marks    []Mark         `json:"marks,omitempty"`
	Data     BlockData      `json:"data,omitempty"`
	// Context is the block's per-block retrieval scope selection over the
	// document's declared context variables (nil means whole-project retrieval).
	Context *BlockContext `json:"context,omitempty"`
}

// BlockData is a block kind's typed, kind-specific payload — the "subtype" over
// the shared Block base. A plain text or heading block has none; a prompt block
// carries PromptData. blockKind ties an instance back to the kind it belongs to,
// which is how a decoded block validates that its Data matches its Kind.
type BlockData interface {
	blockKind() string
}

// Prompt resolution outcomes. Insufficient and Contradiction are first-class,
// stable answers: when the evidence does not support a confident response, the
// block says so rather than fabricating one.
const (
	PromptStatusOK            = "ok"
	PromptStatusInsufficient  = "insufficient"
	PromptStatusContradiction = "contradiction"
)

// PromptData is the prompt block's payload. Instruction is the authored prompt;
// the rest is the last resolution's result — its status, the evidence spans that
// grounded it, the source versions it was built from (so a refresh can tell
// whether anything changed), and the text the model last produced (fed back in
// as the prior value so refreshes stay stable). The block's *display* text lives
// in its Atoms like any other block, not here. OutputHistory is an append-only
// list of every generated output revision.
type PromptData struct {
	Instruction     string                 `json:"instruction"`
	Status          string                 `json:"status,omitempty"`
	Evidence        []EvidenceSpan         `json:"evidence,omitempty"`
	Sources         []SourceVersion        `json:"sources,omitempty"`
	LastInstruction string                 `json:"lastInstruction,omitempty"`
	LastOutput      string                 `json:"lastOutput,omitempty"`
	Usage           Usage                  `json:"usage,omitempty"`
	ResolvedAt      time.Time              `json:"resolvedAt,omitempty"`
	OutputHistory   []PromptOutputRevision `json:"outputHistory,omitempty"`
	// Persona selects the project-local persona whose instructions overlay this
	// block's resolution (nil means no persona overlay). Set via set_block_persona.
	Persona *PersonaRef `json:"persona,omitempty"`
}

// PersonaRef selects a project-local persona for a prompt block's resolution, by
// id and version — the same coordinates a chat turn or agent ask uses. The
// capability carries only the reference; a PersonaResolver port turns it into
// instruction text at resolution, so document imports no persona types.
type PersonaRef struct {
	ID      string `json:"id"`
	Version int    `json:"version"`
}

// PromptOutputRevision is one immutable presentation revision of a prompt
// block's generated output: the atoms and marks that were displayed, plus the
// time they were produced.
type PromptOutputRevision struct {
	ID        string    `json:"id"`
	Atoms     []Atom    `json:"atoms"`
	Marks     []Mark    `json:"marks"`
	CreatedAt time.Time `json:"createdAt"`
}

func (PromptData) blockKind() string { return BlockKindPrompt }

// ListType selects a list block's marker style.
type ListType string

const (
	ListBullet  ListType = "bullet"  // an unordered bullet list
	ListOrdered ListType = "ordered" // a numbered list, counting from Start
	ListCheck   ListType = "check"   // a checkbox list, each item Checked or not
)

// List bounds. A list holds its items internally (not as sibling blocks), so
// these cap one block's payload rather than the document.
const (
	MaxListItems     = 256 // most items one list block may hold
	MaxListItemLevel = 8   // deepest item nesting level (0 = top level)
)

// ListItem is one entry in a list block: its nesting Level, its Checked state
// (meaningful only for a check list), and its inline content — atoms and marks,
// exactly like a text block's, so bold/italic/links render inside an item.
type ListItem struct {
	Level   int    `json:"level"`
	Checked bool   `json:"checked,omitempty"`
	Atoms   []Atom `json:"atoms"`
	Marks   []Mark `json:"marks,omitempty"`
}

// ListBlockData is the list block's payload: its marker Type, the Start ordinal
// for an ordered list (1 when unset), and the ordered Items it contains.
type ListBlockData struct {
	Type  ListType   `json:"type"`
	Start int        `json:"start,omitempty"`
	Items []ListItem `json:"items"`
}

func (ListBlockData) blockKind() string { return BlockKindList }

// ImageData carries an image block's payload: the exact file identity, alt text,
// and display dimensions in typographic points.
type ImageData struct {
	FileID string     `json:"fileId"`
	Alt    string     `json:"alt"`
	Width  LayoutUnit `json:"width"`
	Height LayoutUnit `json:"height"`
}

func (ImageData) blockKind() string { return BlockKindImage }

// EvidenceSpan is one supporting span behind a prompt block's output: the origin
// it came from — by id, not resolved name — plus the byte range and the span
// text. This is the grounding a reader can trace the answer back to.
//
// Relevance is the span's retrieval score — how well it matched the query that
// surfaced it (higher is closer). It scores the span against the retrieval query,
// not against the final synthesis, so it ranks provenance rather than proving
// use; when the same span is surfaced by more than one query, the highest score
// is kept. No span is ever dropped on the strength of this score — provenance
// stays complete, and the score only ranks it.
type EvidenceSpan struct {
	SourceType string  `json:"sourceType"`
	SourceID   string  `json:"sourceId"`
	Start      int     `json:"start"`
	End        int     `json:"end"`
	Text       string  `json:"text"`
	Relevance  float64 `json:"relevance"`
	Revision   int64   `json:"revision,omitempty"`
}

// SourceVersion snapshots a source's version at resolution, so a refresh can
// detect whether the evidence a block was built from has changed by comparing
// the stored revision against the current document head.
type SourceVersion struct {
	SourceType string    `json:"sourceType"`
	SourceID   string    `json:"sourceId"`
	SyncedAt   time.Time `json:"syncedAt"`
	Revision   int64     `json:"revision,omitempty"`
}

// Block kinds. Text carries prose under a semantic sub-kind (body, heading_N, or
// a user-defined style); code is a monospace preformatted block. Divider and
// image hold no atoms; prompt is generated content grounded by knowledge
// retrieval. An unknown kind fails closed (see blockKinds).
const (
	BlockKindText    = "text"    // prose, text-bearing, carries a SubKind
	BlockKindCode    = "code"    // monospace preformatted, text-bearing, no sub-kind
	BlockKindCallout = "callout" // highlighted box, text-bearing, no sub-kind
	BlockKindList    = "list"    // a list, items held internally, carries ListBlockData
	BlockKindDivider = "divider" // horizontal rule, no atoms
	BlockKindImage   = "image"   // image block, no atoms, carries ImageData
	BlockKindPrompt  = "prompt"  // generated content grounded by knowledge retrieval
)

// blockKinds is the set of supported block kinds; an unknown kind is rejected.
var blockKinds = map[string]bool{
	BlockKindText:    true,
	BlockKindCode:    true,
	BlockKindCallout: true,
	BlockKindList:    true,
	BlockKindDivider: true,
	BlockKindImage:   true,
	BlockKindPrompt:  true,
}

// Text sub-kinds. A text block's SubKind names its semantic role: a built-in
// (body or heading_1…heading_6) or the id of a user-defined style definition in
// the document's style registry. Body is the default.
const (
	SubKindBody     = "body"
	SubKindHeading1 = "heading_1"
	SubKindHeading2 = "heading_2"
	SubKindHeading3 = "heading_3"
	SubKindHeading4 = "heading_4"
	SubKindHeading5 = "heading_5"
	SubKindHeading6 = "heading_6"
)

// builtinTextSubKinds is the set of sub-kinds shipped for every document. A
// text block may also carry a custom sub-kind — the id of a style definition
// that applies to the text kind (validated against the registry).
var builtinTextSubKinds = map[string]bool{
	SubKindBody:     true,
	SubKindHeading1: true,
	SubKindHeading2: true,
	SubKindHeading3: true,
	SubKindHeading4: true,
	SubKindHeading5: true,
	SubKindHeading6: true,
}

// headingSubKindLevels maps a heading sub-kind to its level (1…6); the ok result
// is false for any non-heading sub-kind.
var headingSubKindLevels = map[string]int{
	SubKindHeading1: 1, SubKindHeading2: 2, SubKindHeading3: 3,
	SubKindHeading4: 4, SubKindHeading5: 5, SubKindHeading6: 6,
}

// headingSubKindForLevel returns the heading sub-kind for a level 1…6, clamping
// out-of-range levels to the nearest bound.
func headingSubKindForLevel(level int) string {
	switch {
	case level <= 1:
		return SubKindHeading1
	case level == 2:
		return SubKindHeading2
	case level == 3:
		return SubKindHeading3
	case level == 4:
		return SubKindHeading4
	case level == 5:
		return SubKindHeading5
	default:
		return SubKindHeading6
	}
}

// UnmarshalJSON decodes a block, selecting the concrete BlockData subtype from
// the block's Kind. encoding/json cannot unmarshal into the BlockData interface
// on its own, so Data is read as raw JSON and decoded into the type the kind
// implies — PromptData for a prompt block, nothing for the others. (Marshaling
// needs no custom method: the interface's concrete value encodes directly, and
// a nil Data is omitted.)
func (b *Block) UnmarshalJSON(data []byte) error {
	var raw struct {
		ID       string          `json:"id"`
		Kind     string          `json:"kind"`
		SubKind  string          `json:"subKind"`
		Style    BlockStyle      `json:"style"`
		StyleRef *BlockStyleRef  `json:"styleRef"`
		Inferred bool            `json:"inferred"`
		Atoms    []Atom          `json:"atoms"`
		Marks    []Mark          `json:"marks"`
		Data     json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	b.ID, b.Kind, b.SubKind, b.Style, b.StyleRef, b.Inferred = raw.ID, raw.Kind, raw.SubKind, raw.Style, raw.StyleRef, raw.Inferred
	normalizeBlockStyle(&b.Style)
	normalizeBlockStyleRef(&b.StyleRef)
	b.Atoms, b.Marks, b.Data = raw.Atoms, raw.Marks, nil
	if len(raw.Data) > 0 && string(raw.Data) != "null" {
		switch raw.Kind {
		case BlockKindPrompt:
			var pd PromptData
			if err := json.Unmarshal(raw.Data, &pd); err != nil {
				return err
			}
			b.Data = pd
		case BlockKindList:
			var ld ListBlockData
			if err := json.Unmarshal(raw.Data, &ld); err != nil {
				return err
			}
			b.Data = ld
		case BlockKindImage:
			var id ImageData
			if err := json.Unmarshal(raw.Data, &id); err != nil {
				return err
			}
			b.Data = id
		}
	}
	return nil
}

// DisplayText is a block's plain-text content: its atoms' text, concatenated.
func (b Block) DisplayText() string {
	var sb strings.Builder
	for _, a := range b.Atoms {
		sb.WriteString(a.Text)
	}
	return sb.String()
}

// Row is a horizontal group of blocks with a bounded extra-height style and an
// optional track list that defines proportional widths, gaps and minimum widths.
// A document's content is a vertical list of rows.
type Row struct {
	ID     string   `json:"id"`
	Style  RowStyle `json:"style"`
	Tracks []Track  `json:"tracks,omitempty"`
	Blocks []Block  `json:"blocks"`
}

// Base is the resolved, revisioned document content: document-wide page geometry
// and row metrics plus optional recurring Header/Footer rows and the ordered
// content rows.
type Base struct {
	PageLayout    PageLayout    `json:"pageLayout"`
	LayoutRules   LayoutRules   `json:"layoutRules"`
	StyleRegistry StyleRegistry `json:"styleRegistry,omitempty"`
	// DefaultTypography is the document-wide default free-form typography — the
	// lowest custom level of the typography cascade, under any sub-kind default,
	// block override, or inline mark. Nil means the document sets no default.
	DefaultTypography *CustomTypography `json:"defaultTypography,omitempty"`
	Template          *TemplateInfo     `json:"template,omitempty"`
	Header            []Row             `json:"header,omitempty"`
	Footer            []Row             `json:"footer,omitempty"`
	Rows              []Row             `json:"rows"`
}

// Document is a named content resource within a project.
type Document struct {
	ID          string    `json:"id"`
	ProjectID   string    `json:"projectId"`
	Name        string    `json:"name"`
	Base        Base      `json:"base"`
	CreatorID   string    `json:"creatorId"`
	CreatorName string    `json:"creatorName"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	// Revision is the latest accepted change-set sequence. It advances once for
	// every user-visible content change and is unchanged by re-base, which only
	// rewrites the stored representation.
	Revision int64 `json:"revision"`
	// BaseSeq is the highest change-set Seq already folded into Base. It is an
	// internal watermark, not part of the API representation.
	BaseSeq int64 `json:"-"`
	// Lifecycle is the current lifecycle state. Defaults to LifecycleActive.
	Lifecycle string `json:"lifecycle,omitempty"`
	// TrashedAt records when the document was moved to trash. Zero when active.
	TrashedAt time.Time `json:"trashedAt,omitempty"`
}

const (
	LifecycleActive  = "active"
	LifecycleTrashed = "trashed"
)

// Actor is the trusted identity snapshot attached to a visible Document effect.
type Actor struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// ActivityFact is the bounded, safe semantic fact a Document store commits with
// its canonical mutation. It deliberately contains no content or arbitrary data.
type ActivityFact struct {
	ID         string
	ProjectID  string
	Actor      Actor
	Action     string
	TargetID   string
	TargetName string
	OccurredAt time.Time
	SourceKind string
	SourceID   string
}

// Summary is the Document-owned metadata projected into cross-family catalogs and
// the lightweight listing view: identity and metadata, never the body. A body
// must have pending change sets folded in (only Get does that), so a listing
// deliberately carries no base — fetch content with Get.
type Summary struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	CreatorID   string    `json:"creatorId"`
	CreatorName string    `json:"creatorName"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// SummaryBoundary is an exclusive keyset boundary for updatedAt-descending,
// id-ascending Document summary traversal.
type SummaryBoundary struct {
	UpdatedAt     time.Time
	ID            string
	SkipEqualTime bool
}

const (
	ActivityCreated    = "created"
	ActivityEdited     = "edited"
	ActivityRenamed    = "renamed"
	ActivityDeleted    = "deleted"
	ActivityTrashed    = "trashed"
	ActivityRestored   = "restored"
	ActivityPurged     = "purged"
	ActivityDuplicated = "duplicated"
)

// SystemActor is used for generated user-visible edits that have no human actor.
var SystemActor = Actor{ID: "system", Name: "Taurus"}

// Sentinel errors returned by the store and the service.
var (
	ErrNotFound          = errors.New("document not found")
	ErrInvalidName       = errors.New("document name must not be empty")
	ErrInvalidContent    = errors.New("document content or layout is invalid")
	ErrChangeSetNotFound = errors.New("change set not found")
	ErrUndoForbidden     = errors.New("only the revision author may undo it")
	ErrUndoConflict      = errors.New("only the current head revision can be undone")
	ErrUndoIneligible    = errors.New("an undo revision must be redone explicitly")
	ErrUndoUnavailable   = errors.New("change set has no retained inverse")
	ErrRedoForbidden     = errors.New("only the undo revision author may redo it")
	ErrRedoConflict      = errors.New("only the current head undo revision can be redone")
	ErrRedoIneligible    = errors.New("only an undo revision can be redone")
	ErrRedoUnavailable   = errors.New("undo revision has no retained inverse")
	// ErrRevisionConflict means revision admission could not prove a stale edit
	// safe, or the canonical head changed during the append CAS. The caller must
	// resync before constructing a new submission.
	ErrRevisionConflict = errors.New("document revision changed")
	// ErrAnchorInvalid means an anchor's target does not exist in the document.
	ErrAnchorInvalid = errors.New("anchor target does not exist")
)

// Store persists documents and their change sets. A document's base and a change
// set's ops are opaque values the store serializes whole; it never interprets
// rows, blocks, or ops.
type Store interface {
	CreateDocument(d Document, fact ActivityFact) error
	// DocumentByID returns one document scoped to its project: a document owned
	// by another project is ErrNotFound. The service compares ProjectID after
	// loading anyway — the two checks are deliberately redundant.
	DocumentByID(projectID, id string) (Document, error)
	DocumentsByProject(projectID string) ([]Document, error)
	DocumentSummaries(projectID string, before *SummaryBoundary, limit int) ([]Summary, error)
	RenameDocument(id, name string, updatedAt time.Time, fact ActivityFact) error
	DeleteDocument(id string, fact ActivityFact) error
	// SetLifecycle records a lifecycle transition (active→trashed or trashed→active)
	// together with the activity fact for the transition.
	SetLifecycle(id, lifecycle string, trashedAt time.Time, updatedAt time.Time, fact ActivityFact) error
	// TrashedDocumentsOlderThan returns documents in the trashed state whose
	// TrashedAt timestamp is before the given cutoff.
	TrashedDocumentsOlderThan(before time.Time) ([]Document, error)

	// AppendChangeSet first deduplicates a non-empty scoped SubmissionID, then
	// stores cs only when the document is still at expectedRevision. It atomically
	// advances the revision, assigns the matching next Seq, and commits Activity.
	AppendChangeSet(cs ChangeSet, expectedRevision int64, fact ActivityFact) (ChangeSet, error)
	// ChangeSetByID returns one retained revision scoped to its document.
	ChangeSetByID(documentID, changeSetID string) (ChangeSet, error)
	// ChangeSetBySubmission returns one retained revision by the idempotency key
	// scoped to its document and trusted author.
	ChangeSetBySubmission(documentID, authorID, submissionID string) (ChangeSet, error)
	// ListChangeSetHistory returns retained bounded summaries newest-first. A
	// positive beforeRevision is an exclusive sequence boundary.
	ListChangeSetHistory(documentID string, beforeRevision int64, limit int) ([]HistoryEntry, error)
	// ChangeSetsSince returns a document's change sets with Seq greater than
	// afterSeq, ordered by Seq.
	ChangeSetsSince(documentID string, afterSeq int64) ([]ChangeSet, error)
	// RebaseDocument replaces a document's base and advances its base-seq
	// watermark. It only ever moves the watermark forward: a rebase whose baseSeq
	// does not exceed the stored one is a no-op, so a stale or duplicate rebase
	// cannot wind the base backward or clobber a newer one. The change sets
	// themselves are kept, so history is preserved.
	RebaseDocument(documentID string, base Base, baseSeq int64) error
	// PruneChangeSets retains detailed operations required for reconstruction and
	// current-head compensation, and bounds summary History to keep entries.
	PruneChangeSets(documentID string, keep int) error

	// CreateAnchor stores a new external anchor on a document.
	CreateAnchor(docID string, a DocumentAnchor) error
	// ListAnchors returns all anchors on a document.
	ListAnchors(docID string) ([]DocumentAnchor, error)
	// DeleteAnchor removes one anchor from a document.
	DeleteAnchor(docID, anchorID string) error
	// UpdateAnchor replaces one anchor's state (used after rebase).
	UpdateAnchor(docID string, a DocumentAnchor) error
}

// DiffChange is one structural difference between two document revisions:
// a row, block, atom, or mark that was added, removed, moved, or had its
// content changed. It reports identity and position, not full payloads.
type DiffChange struct {
	Kind     string `json:"kind"`               // "added", "removed", "moved", "content-changed"
	Level    string `json:"level"`              // "row", "block", "atom", "mark"
	ID       string `json:"id"`                 // stable entity ID
	ParentID string `json:"parentId,omitempty"` // row ID for block, block ID for atom/mark
	OldPos   int    `json:"oldPos,omitempty"`   // ordinal index in old head (for moved)
	NewPos   int    `json:"newPos,omitempty"`   // ordinal index in new head (for moved)
	OldKind  string `json:"oldKind,omitempty"`  // old block/atom kind (for content-changed)
	NewKind  string `json:"newKind,omitempty"`  // new block/atom kind (for content-changed)
	OldText  string `json:"oldText,omitempty"`  // old atom display text excerpt (capped)
	NewText  string `json:"newText,omitempty"`  // new atom display text excerpt (capped)
}

// DiffBounds limits how many changes a diff reports and how long text excerpts
// are. Zero values mean no limit.
type DiffBounds struct {
	MaxChanges int
	MaxTextLen int
}

// DiffResult is the outcome of comparing two document revision heads.
type DiffResult struct {
	OldRevision int64        `json:"oldRevision"`
	NewRevision int64        `json:"newRevision"`
	Changes     []DiffChange `json:"changes"`
	Truncated   bool         `json:"truncated,omitempty"`
}

// ErrInvalidDiffRevisions is returned when old and new revisions for a diff are
// equal or inverted.
var ErrInvalidDiffRevisions = errors.New("diff requires old revision < new revision")

// DocumentAnchor is a stable structural reference into a document, usable by
// external systems (comments, notes, citations) to point at specific content.
// The anchor follows its target through moves and marks itself orphaned when the
// target is deleted — it never silently reattaches to different content.
// Thread content, replies, and resolution state are not stored here.
type DocumentAnchor struct {
	ID         string    `json:"id"`               // stable anchor ID
	DocumentID string    `json:"documentId"`       // owning document
	RowID      string    `json:"rowId"`            // stable row ID
	BlockID    string    `json:"blockId"`          // stable block ID
	AtomID     string    `json:"atomId,omitempty"` // optional: specific atom
	Start      int       `json:"start,omitempty"`  // byte offset within atom
	End        int       `json:"end,omitempty"`    // byte offset within atom
	State      string    `json:"state"`            // "valid" or "orphaned"
	CreatedAt  time.Time `json:"createdAt"`
}

const (
	AnchorValid    = "valid"
	AnchorOrphaned = "orphaned"
)

// JobTypeRebase is the job type for re-basing a document off the request path.
const JobTypeRebase = "document.rebase"

// rebasePayload is the JSON payload of a JobTypeRebase job. It carries the
// project id as well as the document id, so the job stays scoped to its project.
type rebasePayload struct {
	ProjectID  string `json:"projectId"`
	DocumentID string `json:"documentId"`
}

// DefaultRebaseThreshold is the number of pending change sets at which a document
// is re-based — its base rewritten to include them, so reads stop replaying an
// ever-growing op log. The change sets are retained afterward.
const DefaultRebaseThreshold = 50

// Documents is the document resource service. Every method is scoped by a
// project ID, so a project can only ever reach its own documents.
```
