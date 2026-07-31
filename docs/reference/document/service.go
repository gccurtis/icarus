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
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"sync/atomic"
	"time"

	"github.com/gccurtis/taurus-omega/core/platform/job"
)

type Documents struct {
	store            Store
	rebaseThreshold  int
	historyLimit     int
	trashRetention   time.Duration
	pageLayout       PageLayout
	layoutRules      LayoutRules
	enqueuer         job.Enqueuer
	promptModel      PromptModel
	attributor       Attributor
	retriever        Retriever
	personaResolver  PersonaResolver
	scopeResolver    ScopeResolver
	scopeReferences  ScopeReferences
	formulaEvaluator FormulaEvaluator
	referenceIndexer ReferenceIndexer
	prompts          promptTemplates
	promptTopK       int
	promptMaxQueries int
	now              func() time.Time
	// One stable counter corresponds to StyleValidationCode. It counts rejected
	// domain admissions without retaining the submitted value.
	styleValidationRejections atomic.Uint64
}

// FormulaEvaluator is the formula evaluation port. Evaluate runs one expression
// against the current dependency snapshot and returns the typed result and the
// refreshed dependency timestamps. It is satisfied by the formula capability at
// composition; when nil, formula refresh is not configured.
type FormulaEvaluator interface {
	Evaluate(ctx context.Context, expression string, deps []FormulaDep) (FormulaResult, []FormulaDep, error)
}

// Default prompt-resolution knobs, used when Options leaves them zero.
const (
	defaultPromptTopK       = 5
	defaultPromptMaxQueries = 4
	defaultTrashRetention   = 720 * time.Hour
)

// Options configures a Documents service.
type Options struct {
	// RebaseThreshold is the number of pending change sets that triggers a
	// re-base. Values below 1 fall back to DefaultRebaseThreshold.
	RebaseThreshold int
	// HistoryLimit caps retained summary History after re-base; 0 keeps all
	// summaries and detailed revisions. A positive limit still pins pending
	// reconstruction detail and the current undo/redo recipe.
	HistoryLimit int
	// PageLayout is the default geometry for newly created documents. A zero
	// value uses the built-in US Letter layout.
	PageLayout PageLayout
	// LayoutRules are the row metrics captured by newly created documents. Zero
	// fields use the built-in row metrics.
	LayoutRules LayoutRules
	// Enqueuer schedules the re-base and resolve jobs. When nil, re-basing is
	// skipped (reads still resolve pending change sets, just without ever folding
	// them in).
	Enqueuer job.Enqueuer
	// PromptModel and Retriever back prompt-block resolution. When either is nil,
	// ResolveBlock reports that resolution is not configured. The composition root
	// supplies them over intelligence and knowledge under configured casts.
	PromptModel PromptModel
	Retriever   Retriever
	// Attributor tags a context with the unit of work its provider calls belong
	// to, so a resolution's model spend is attributable to the block that caused
	// it. It is a function rather than an interface because it is one operation,
	// and it is a port at all so this capability keeps importing neither
	// intelligence nor telemetry. Nil leaves calls unattributed.
	Attributor Attributor
	// PersonaResolver turns a prompt block's persona selection into instruction
	// text overlaid on resolution. When nil, a block's persona is ignored. The
	// composition root supplies it over the persona capability.
	PersonaResolver PersonaResolver
	// FormulaEvaluator backs formula atom refresh. When nil, RefreshFormula
	// reports that evaluation is not configured. The composition root supplies it
	// over the formula capability.
	FormulaEvaluator FormulaEvaluator
	// ReferenceIndexer records outgoing links after a document is created or
	// changed, keeping the reference graph current. When nil, extraction is
	// skipped. The composition root supplies it over the reference capability.
	ReferenceIndexer ReferenceIndexer
	// PromptTemplates overrides the plan/synthesis prompt strings; blank fields
	// use the built-in defaults.
	PromptTemplates PromptTemplates
	// PromptTopK is how many spans each retrieval query pulls; PromptMaxQueries
	// caps the plan step's queries. Values below 1 fall back to the defaults.
	PromptTopK       int
	PromptMaxQueries int
	// TrashRetention is how long a trashed document lives before PurgeStale
	// removes it permanently. Zero or negative uses defaultTrashRetention.
	TrashRetention time.Duration
}

// New builds a Documents service over the given store.
func New(store Store, opts Options) *Documents {
	if opts.RebaseThreshold < 1 {
		opts.RebaseThreshold = DefaultRebaseThreshold
	}
	if opts.PromptTopK < 1 {
		opts.PromptTopK = defaultPromptTopK
	}
	if opts.PromptMaxQueries < 1 {
		opts.PromptMaxQueries = defaultPromptMaxQueries
	}
	if opts.TrashRetention <= 0 {
		opts.TrashRetention = defaultTrashRetention
	}
	opts.PageLayout = normalizePageLayout(opts.PageLayout)
	opts.LayoutRules = normalizeLayoutRules(opts.LayoutRules)
	if !validPageLayout(opts.PageLayout, opts.LayoutRules) {
		opts.PageLayout = defaultPageLayout()
	}
	return &Documents{
		store:            store,
		rebaseThreshold:  opts.RebaseThreshold,
		historyLimit:     opts.HistoryLimit,
		trashRetention:   opts.TrashRetention,
		pageLayout:       opts.PageLayout,
		layoutRules:      opts.LayoutRules,
		enqueuer:         opts.Enqueuer,
		promptModel:      opts.PromptModel,
		attributor:       opts.Attributor,
		retriever:        opts.Retriever,
		personaResolver:  opts.PersonaResolver,
		formulaEvaluator: opts.FormulaEvaluator,
		referenceIndexer: opts.ReferenceIndexer,
		prompts:          parsePromptTemplates(opts.PromptTemplates),
		promptTopK:       opts.PromptTopK,
		promptMaxQueries: opts.PromptMaxQueries,
		now:              time.Now,
	}
}

// StyleValidationRejections returns the number of writes this service instance
// rejected with StyleValidationCode.
func (d *Documents) StyleValidationRejections() uint64 {
	return d.styleValidationRejections.Load()
}

func (d *Documents) recordStyleValidationRejection(err error, projectID, documentID string) {
	var styleErr *StyleValidationError
	if errors.As(err, &styleErr) {
		styleErr.ProjectID = projectID
		styleErr.DocumentID = documentID
		d.styleValidationRejections.Add(1)
	}
}

// UseScopeResolver sets the port that expands a prompt block's context selection
// to leaf origins. Wired after construction because it composes over the
// contexts capability, which is built after the document service. Nil (default)
// keeps origin-level scope.
func (d *Documents) UseScopeResolver(r ScopeResolver) { d.scopeResolver = r }

// UseScopeReferences sets the port that lets DependentPrompts see a change
// reached THROUGH a context: a block selecting context C is a dependent of
// origin O when C transitively references O. Wired after construction because
// it composes over the contexts capability, which is built after the document
// service. Nil (default) keeps the direct-origin-only cascade.
func (d *Documents) UseScopeReferences(r ScopeReferences) { d.scopeReferences = r }

// ValidateBoundPorts closes the document/contexts construction cycle for a
// production composition. Focused tests may intentionally leave these ports
// absent; the process readiness gate may not.
func (d *Documents) ValidateBoundPorts() error {
	if d.scopeResolver == nil {
		return errors.New("document: scope resolver port is required")
	}
	if d.scopeReferences == nil {
		return errors.New("document: scope references port is required")
	}
	return nil
}

const (
	SystemActorID   = "system"
	SystemActorName = "system"
)

func selectedActor(actors []Actor) Actor {
	if len(actors) == 0 {
		return SystemActor
	}
	actor := actors[0]
	actor.ID = strings.TrimSpace(actor.ID)
	actor.Name = strings.TrimSpace(actor.Name)
	if actor.ID == "" {
		return SystemActor
	}
	if actor.Name == "" {
		actor.Name = actor.ID
	}
	return actor
}

func newActivityFact(doc Document, actor Actor, action string, occurredAt time.Time, sourceKind, sourceID string) ActivityFact {
	return ActivityFact{
		ID: newID(), ProjectID: doc.ProjectID, Actor: selectedActor([]Actor{actor}), Action: action,
		TargetID: doc.ID, TargetName: doc.Name, OccurredAt: occurredAt,
		SourceKind: sourceKind, SourceID: sourceID,
	}
}

// assignIDs gives every row, block, atom and mark that lacks one a fresh
// identifier, and fills in default kinds, so every unit has a stable identifier
// the change ops can reference.
func assignIDs(base *Base) {
	for i := range base.Rows {
		if base.Rows[i].ID == "" {
			base.Rows[i].ID = newID()
		}
		for j := range base.Rows[i].Blocks {
			normalizeBlock(&base.Rows[i].Blocks[j])
		}
	}
}

// normalizeBlock fills in a block's missing ids and default kinds, along with
// those of its atoms and marks. A prompt block is normalized to always carry a
// PromptData and to be marked Inferred: its content is generated, so it is kept
// out of the source text fed to knowledge.
func normalizeBlock(b *Block) {
	if b.ID == "" {
		b.ID = newID()
	}
	if b.Kind == "" {
		b.Kind = BlockKindText
	}
	if b.Kind == BlockKindText {
		if b.SubKind == "" {
			b.SubKind = SubKindBody
		}
	} else {
		b.SubKind = ""
	}
	normalizeBlockStyle(&b.Style)
	if b.Kind == BlockKindPrompt {
		b.Inferred = true
		if b.Data == nil {
			b.Data = PromptData{}
		}
	}
	normalizeBlockStyleRef(&b.StyleRef)
	for i := range b.Atoms {
		if b.Atoms[i].ID == "" {
			b.Atoms[i].ID = newID()
		}
		if b.Atoms[i].Kind == "" {
			b.Atoms[i].Kind = AtomKindText
		}
	}
	for i := range b.Marks {
		if b.Marks[i].ID == "" {
			b.Marks[i].ID = newID()
		}
	}
}

func newID() string {
	b := make([]byte, 16)
	// crypto/rand.Read never returns an error on the platforms we target.
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
