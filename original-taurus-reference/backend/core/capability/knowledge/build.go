package knowledge

// build.go is the ingest half of the lattice: registering or re-syncing a
// source — snapshot, windows, embeddings, KLR ascent into the source's own
// forest — removing one, and rebuilding the corpus tier from every source's
// frontier after either. It is the only write path into the store.

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"time"
)

// Add registers (or re-syncs) a source into the project's lattice: it snapshots
// the text, windows it, embeds the windows, clusters them into the source's
// forest, and rebuilds the corpus tier from every source's frontier. Re-adding
// an existing origin replaces its data and preserves its original AddedAt, and —
// this is the smart-update path — reuses the stored embedding of every window
// whose text is unchanged, embedding only what actually changed. Appending to a
// document therefore re-embeds only the new tail; the untouched body is free.
// revision is the origin's current version at sync time.
//
// label is the source's human name, stored beside the id so a caller can find a
// member by the name it knows (see Origin.Label). Empty is legitimate: a
// document's id is already the identity its caller uses.
func (k *Knowledge) Add(ctx context.Context, projectID, sourceType, sourceID, label, text string, blocks []BlockSpan, revision int64) (AddResult, error) {
	results, err := k.AddBatch(ctx, projectID, []AddItem{{
		SourceType: sourceType, SourceID: sourceID, Label: label,
		Content: TextContent(text), Blocks: blocks, Revision: revision,
	}})
	if err != nil {
		return AddResult{}, err
	}
	return results[0], nil
}

// AddBatch registers (or re-syncs) several sources at once, and is the real
// implementation — Add is this with one item, so there is one code path rather
// than two that drift.
//
// Batching changes two costs that per-source adds could not avoid:
//
//   - **One embedding call per slice.** The sources in a slice have their changed
//     windows collected into a single Embed call. Per-source, a connector's first
//     sync over N files made N provider requests in a tight loop, which is the
//     shape a per-minute rate limit exists to stop. (Embed chunks internally, so
//     "one call" is one call per max_batch_inputs windows, not one enormous
//     request.)
//   - **One corpus rebuild.** The rebuild is O(F²) in the project's whole
//     frontier, so per-source a 200-file sync paid for 200 project-scale rebuilds
//     to reach one final state. However many slices a sync commits, exactly one
//     rebuild is scheduled at the end.
//
// # Slices
//
// Planned sources accumulate until they hold commitBudget windows, then that
// slice is embedded, clustered, written and released before the next source is
// planned. Peak memory is therefore O(slice) rather than O(sync), which is what
// lets a sync be larger than RAM.
//
// It also changes what a failure means. Embedding everything and then writing
// everything meant one failed chunk discarded the whole batch — and since sync
// state is recorded only on success, the detector re-synced and re-embedded from
// zero, forever, at provider rates. Now the slices that landed stay landed and
// the retry's unchangedFrom skips them: forward progress instead of another lap.
//
// Results are returned in item order. An item whose stored snapshot already
// matches is skipped without being written at all.
//
// **Results are returned on failure too**, populated for the slices that committed
// before it. That is not a courtesy: those slices spent provider tokens, and
// returning nil left the caller no way to learn what it had already paid for — the
// connector recorded no cost for a sync that had genuinely bought embeddings, so
// the spend was invisible in exactly the case worth watching. Entries for items
// that never committed are zero.
func (k *Knowledge) AddBatch(ctx context.Context, projectID string, items []AddItem) ([]AddResult, error) {
	if len(items) == 0 {
		return nil, nil
	}
	work := k
	var token ReadToken
	var active LatticeGeneration
	var activeSpace EmbeddingSpace
	if k.generations != nil {
		resolved, generation, space, err := k.generations.Active(projectID, LatticeText)
		switch {
		case err == nil:
			token, active, activeSpace = resolved, generation, space
			clone := *k
			clone.store = k.generations.ForGeneration(token.GenerationID)
			clone.generationID = token.GenerationID
			work = &clone
			if reporter, ok := k.embedder.(ConfiguredSpaceReporter); ok {
				configured, reportErr := reporter.ConfiguredSpace(ctx)
				if reportErr != nil {
					return nil, reportErr
				}
				// Some providers discover dimensions only on their first response;
				// provider/model drift is still knowable without paying for a call.
				if configured.Provider != "" && configured.Model != "" &&
					(configured.Provider != space.Provider || configured.Model != space.Model ||
						(configured.Dimensions > 0 && configured.Dimensions != space.Dimensions)) {
					return nil, ErrEmbeddingSpaceChangeRequired
				}
			}
		case errors.Is(err, ErrGenerationNotInitialized):
			// Reserve the generation id before planning so candidate artifacts are
			// written through one generation-pinned view. Content-derived ids remain
			// reproducible across generations; composite persistence keys provide
			// isolation. The active pointer is created only after the first
			// embedding call freezes a complete space.
			token = ReadToken{ProjectID: projectID, Kind: LatticeText, GenerationID: newID()}
			clone := *k
			clone.store = k.generations.ForGeneration(token.GenerationID)
			clone.generationID = token.GenerationID
			work = &clone
		default:
			return nil, err
		}
	}
	now := k.now().UTC()
	results := make([]AddResult, len(items))
	sync := &syncState{
		projectID: projectID, now: now, token: token,
		generation: active, space: activeSpace,
	}

	// One pass to resolve what is already stored, and to drop the no-ops.
	//
	// It happens before the ceiling check so the check can measure the batch's net
	// effect: which sources are actually being written, and what each of them is
	// replacing. Nothing here reads content — SourceByOrigin is a row — so the pass
	// costs a query per item and no bytes.
	pending := make([]plannedItem, 0, len(items))
	for i, item := range items {
		prev, existed, err := work.store.SourceByOrigin(projectID, item.SourceType, item.SourceID)
		if err != nil {
			return nil, err
		}
		// Nothing to do. Everything below — windowing, the reuse map, the ascent, the
		// corpus rebuild — would reproduce the lattice this source already has, and a
		// connector re-syncs every one of its files whenever any one of them changes,
		// so without this the cost of a one-file edit scales with the whole connector.
		//
		// The comparison is against the hash the CALLER supplied, so an unchanged
		// source is skipped without being opened. That is what makes a re-sync cost a
		// listing rather than a corpus: the provider already knows each file's hash
		// from the pass that produced the fingerprint.
		if existed && item.Content.Hash != "" && unchangedFrom(prev, item.Label, item.Content.Hash, item.Blocks) {
			results[i] = AddResult{Source: prev, Skipped: true}
			continue
		}
		pending = append(pending, plannedItem{at: i, item: item, prev: prev, existed: existed})
	}
	if len(pending) == 0 {
		return results, nil
	}

	// Provider metadata makes preflight only advisory. The authoritative count is
	// the exact window/node candidate, admitted with publication in commitSlice;
	// a missing or dishonest Size must never buy an unbounded read or an unchecked
	// commit. Keeping planning separate still lets unchanged content avoid an open.

	// Any slice that committed has already dropped the corpus tier, so the rebuild
	// must be scheduled even when a later slice fails. Otherwise a failed sync
	// would leave the project with no corpus tier and nothing queued to rebuild
	// one, and retrieval would stay degraded until some unrelated write happened.
	defer func() {
		if sync.committed > 0 {
			work.queueCorpusRebuild(projectID)
		}
	}()

	for _, p := range pending {
		plan, err := work.planAdd(ctx, projectID, p.item, p.prev, p.existed, now, sync.bytes)
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return results, sync.withProgress(err)
		}
		if errors.Is(err, ErrUnreadable) {
			// Reported, not fatal, and reported per item rather than logged: one
			// unreadable file must not abandon the sync of everything beside it, and a
			// file that silently failed to arrive looks exactly like one that arrived.
			work.log.Warnf("knowledge: skipping %s/%s: %v", p.item.SourceType, p.item.SourceID, err)
			results[p.at] = AddResult{Source: p.prev, Skipped: true, Unreadable: err}
			continue
		}
		if err != nil {
			return results, sync.withProgress(err)
		}
		// A caller that could not supply a hash up front gets the same skip, one read
		// later: the windowing is wasted but nothing is written or embedded.
		if p.existed && unchangedFrom(p.prev, p.item.Label, plan.source.ContentHash, plan.source.Blocks) {
			results[p.at] = AddResult{Source: p.prev, Skipped: true}
			continue
		}
		if plan.source.SizeBytes > 0 {
			// windowContent has already enforced this cap while it read, including
			// the byte after the remaining allowance. This is only progress
			// bookkeeping for a successfully planned source.
			sync.bytes += int64(plan.source.SizeBytes)
		}
		sync.add(p.at, plan)

		// At or past the budget rather than exactly at it: a single source may hold
		// more windows than the whole budget, and it is admitted whole. The budget
		// bounds what is held between commits, and is not a limit on what may enter.
		if sync.windows >= work.commitBudget {
			if err := work.commitSlice(ctx, sync, results); err != nil {
				sync.recordPendingUsage(results)
				return results, sync.withProgress(err)
			}
		}
	}
	if err := work.commitSlice(ctx, sync, results); err != nil {
		sync.recordPendingUsage(results)
		return results, sync.withProgress(err)
	}
	return results, nil
}

// plannedItem is one item that survived the no-op check, with what was already
// stored for it.
//
// The prev record is carried rather than re-read because two things need it: the
// capacity check, which measures what this batch replaces as well as what it adds,
// and planAdd, which inherits the source's local ref and AddedAt from it.
type plannedItem struct {
	at      int // position in the caller's items, so results stay in order
	item    AddItem
	prev    Source
	existed bool
}

// syncState is one AddBatch's progress across its slices: the slice being filled,
// how many windows it holds, and the embedding identity the whole sync is pinned
// to.
type syncState struct {
	projectID  string
	now        time.Time
	token      ReadToken
	generation LatticeGeneration
	space      EmbeddingSpace

	// slice is the plans awaiting a commit, at is their positions in the caller's
	// item slice, and windows is their combined window count — the quantity the
	// budget is measured in.
	slice   []*addPlan
	at      []int
	windows int

	// identity is the embedding space the first committed slice landed in. Every
	// later slice must agree with it.
	identity VectorIdentity
	pinned   bool

	committed int
	bytes     int64
}

// partialAddError makes forward progress explicit. A caller can preserve usage
// and tell an operator that earlier sources landed while the failed source did
// not; errors.Is/errors.As still reach the typed cause through Unwrap.
type partialAddError struct {
	cause     error
	completed int
	bytes     int64
}

func (e *partialAddError) Error() string {
	return fmt.Sprintf("knowledge: %d source(s) committed before this run stopped after %d byte(s): %v", e.completed, e.bytes, e.cause)
}
func (e *partialAddError) Unwrap() error         { return e.cause }
func (e *partialAddError) PartialProgress() bool { return true }
func (e *partialAddError) CompletedSources() int { return e.completed }
func (e *partialAddError) BytesRead() int64      { return e.bytes }

func (s *syncState) withProgress(err error) error {
	if err == nil || s.committed == 0 {
		return err
	}
	return &partialAddError{cause: err, completed: s.committed, bytes: s.bytes}
}

// recordPendingUsage gives a caller the usage that a failed, uncommitted slice
// still spent. It deliberately does not report windows/nodes: no partial source
// was published, but provider accounting must not be lost with it.
func (s *syncState) recordPendingUsage(results []AddResult) {
	for i, p := range s.slice {
		if p.usage == (Usage{}) {
			continue
		}
		results[s.at[i]] = AddResult{
			Source: p.source, Reused: p.reused, Embedded: p.embedded, Usage: p.usage,
		}
	}
}

func (s *syncState) add(i int, p *addPlan) {
	s.slice = append(s.slice, p)
	s.at = append(s.at, i)
	s.windows += len(p.spans)
}

func (s *syncState) reset() {
	s.slice, s.at, s.windows = nil, nil, 0
}

// commitSlice embeds, clusters and writes the slice currently accumulated, then
// releases it. An empty slice is a no-op, so the flush after the loop needs no
// guard at the call site.
//
// The order is the whole argument: embed, then check the identity, then write.
// Checking after writing would be checking after the damage.
func (k *Knowledge) commitSlice(ctx context.Context, sync *syncState, results []AddResult) error {
	if len(sync.slice) == 0 {
		return nil
	}
	if err := k.embedPending(ctx, sync.slice); err != nil {
		return err
	}
	if err := sync.checkIdentity(); err != nil {
		return err
	}
	if k.generations != nil {
		if sync.identity == (VectorIdentity{}) {
			return ErrEmbeddingSpaceUnavailable
		}
		resolvedSpace := SpaceForIdentity(sync.identity)
		if err := resolvedSpace.Validate(); err != nil {
			return fmt.Errorf("%w: %v", ErrEmbeddingSpaceUnavailable, err)
		}
		if sync.generation.ID == "" {
			generation := LatticeGeneration{
				ID: sync.token.GenerationID, ProjectID: sync.projectID, Kind: LatticeText,
				SpaceIdentity: resolvedSpace.Identity(), State: GenerationActive,
				CreatedAt: sync.now, PromotedAt: &sync.now,
			}
			token, active, err := k.generations.EnsureActive(sync.projectID, LatticeText, generation, resolvedSpace)
			if err != nil {
				return err
			}
			sync.token, sync.generation, sync.space = token, active, resolvedSpace
			k.store = k.generations.ForGeneration(token.GenerationID)
			k.generationID = token.GenerationID
		} else if sync.space.Identity() != resolvedSpace.Identity() {
			return ErrEmbeddingSpaceChangeRequired
		}
	}

	// Cluster each source's own forest, then commit the slice in one write. The
	// write drops the corpus tier and marks it stale; rebuilding it is deferred, so
	// no caller waits on a project-scale clustering to finish an add.
	writes := make([]SourceWrite, 0, len(sync.slice))
	for _, p := range sync.slice {
		p.cluster(k, sync.now)
		writes = append(writes, SourceWrite{Source: p.source, Windows: p.windows, Nodes: p.nodes})
	}
	if k.generations != nil {
		counts, token, err := k.generations.AdmitAndReplaceActive(sync.token, k.maxArtifacts, writes, sync.now)
		_ = counts
		if err != nil {
			return err
		}
		sync.token = token
	} else {
		if _, err := k.store.AdmitAndReplaceSources(k.maxArtifacts, writes); err != nil {
			return err
		}
	}
	for j, p := range sync.slice {
		results[sync.at[j]] = AddResult{
			Source: p.source, Windows: len(p.windows), Nodes: len(p.nodes),
			Reused: p.reused, Embedded: p.embedded, Usage: p.usage,
		}
	}
	sync.committed += len(sync.slice)
	sync.reset()
	return nil
}

// checkIdentity pins the sync to the embedding space its first slice resolved to,
// and refuses any later slice that comes back from a different one.
//
// This is the failure slicing introduces, and the reason it has to be caught
// here. Vectors from two embedding spaces share no basis: they do not fail, they
// silently retrieve nothing. Committing slice 1 under one model and slice 2 under
// another would leave a project that retrieval refuses outright
// (ErrIdentityMismatch) and that only re-buying every vector can repair.
//
// Aborting is the honest outcome. The slices already committed all share the
// pinned identity, so what is on disk stays coherent, and the sources that never
// landed are simply absent — which the next sync sees as changed and retries. A
// mid-sync route change is rare and operational; leaving a project half in each
// space is neither.
//
// Sources that reused vectors from a different space are a separate case, handled
// per-source inside embedPending: those are re-embedded in full rather than
// abandoned, because there the correct space is the one this call just resolved
// to.
//
// # Every plan, not just the ones that embedded
//
// This checked only plans with embedded > 0, and that left the hole open. A slice
// whose sources all REUSE their stored vectors makes no provider call at all —
// embedPending returns early on an empty batch — so each of those sources keeps
// the identity it was last synced under, untouched and unexamined. Under the old
// check the slice reported "nothing new was embedded" and pinned nothing, so a
// source carrying a stale identity committed happily beside slices committed under
// the current one. That is the mixed-space project the pin exists to prevent,
// reached by the one path that skipped the pin.
//
// So every plan's identity is compared, whether this sync embedded it or inherited
// it. A zero identity is the only thing ignored, and it means what it says: a
// source with no vectors — no windows at all — belongs to no embedding space.
func (s *syncState) checkIdentity() error {
	for _, p := range s.slice {
		got := p.source.Identity
		if got == (VectorIdentity{}) {
			continue
		}
		if !s.pinned {
			s.identity, s.pinned = got, true
			continue
		}
		if got != s.identity {
			return fmt.Errorf(
				"%w: source %s/%s holds embedding identity %s/%s but this sync is pinned to %s/%s; %d source(s) already committed under the pin, so the rest are left unwritten rather than split across two embedding spaces",
				ErrEmbeddingSpaceChangeRequired,
				p.source.SourceType, p.source.SourceID,
				got.Provider, got.Model, s.identity.Provider, s.identity.Model, s.committed)
		}
	}
	return nil
}

// addPlan is one source's in-flight state across the phases of an AddBatch:
// planned, embedded, clustered, written. It exists because the batch has to
// interleave — every source is windowed before any is embedded, and every source
// is embedded before any is clustered — so the per-source locals that a
// single-source Add kept on the stack have to live somewhere.
type addPlan struct {
	source Source
	prev   Source
	spans  []windowSpan
	texts  []string
	// vecs is filled in as embeddings resolve: reused entries immediately, the
	// rest once the batch call returns.
	vecs [][]float64
	// needIdx are the positions in texts still awaiting a vector, and needTexts the
	// corresponding texts — the batch's contribution from this source.
	needIdx   []int
	needTexts []string
	reused    int
	embedded  int
	usage     Usage
	windows   []Window
	nodes     []Node
}

// planAdd resolves one item into an addPlan: the source record it will become,
// its window spans, and — reusing the stored embedding of every window whose text
// did not change — exactly which texts still need embedding.
func (k *Knowledge) planAdd(ctx context.Context, projectID string, item AddItem, prev Source, existed bool, now time.Time, runBytesRead int64) (*addPlan, error) {
	// Derived from the origin, not minted. An existing source keeps whatever id it
	// was given, because rewriting one would orphan every window, node and resolved
	// citation pointing at it — so a database written before this change keeps its
	// random local refs and only new sources get derived ones. That is enough for
	// what derivation is for: a fresh ingest is reproducible, and reproducibility
	// across databases was never a property an existing row could have.
	localRef := localRefID(projectID, item.SourceType, item.SourceID)
	added := now
	if existed {
		localRef = prev.LocalRefID
		added = prev.AddedAt
	}
	p := &addPlan{
		prev: prev,
		source: Source{
			LocalRefID: localRef, SourceType: item.SourceType, SourceID: item.SourceID, Label: item.Label,
			ProjectID: projectID, Blocks: item.Blocks, AddedAt: added, SyncedAt: now,
			Revision: item.Revision,
		},
	}
	// The content is read once, in a stream, and windowed as it arrives. Nothing
	// here ever holds the whole source: what survives the read is the windows, and
	// windows are what the lattice stores anyway. That is what lets a file larger
	// than the process be indexed, and it is why the connector's per-file byte cap
	// could be deleted rather than raised.
	if err := k.windowContent(ctx, p, item.Content, runBytesRead); err != nil {
		return nil, err
	}
	p.vecs = make([][]float64, len(p.texts))
	if len(p.spans) == 0 {
		return p, nil
	}

	// One reuse map now, not two.
	//
	// There used to be a second — priorIDs, a queue of prior ids per text, popped as
	// windows claimed them — because an id is a primary key and could be inherited
	// only once, while a vector is a pure function of its text and could be shared
	// freely. That queue is gone: a window id is now derived from its text and which
	// occurrence of that text it is, so inheritance is what the id IS rather than
	// machinery that reconstructs it. Three identical windows becoming four still
	// means three keep their ids and the fourth is new, and now that falls out of
	// the hash instead of out of a queue.
	//
	// Keyed on the window's OWN text, which it carries. This used to reconstruct
	// each prior window's text by slicing the source's stored copy — which meant
	// the map depended on the range and the copy agreeing, and was silently empty
	// for any window whose range no longer fit.
	reuse := map[string][]float64{}
	if existed {
		prevWindows, err := k.store.SourceWindows(prev.LocalRefID)
		if err != nil {
			return nil, err
		}
		for _, w := range prevWindows {
			if w.Text == "" {
				continue
			}
			reuse[w.Text] = w.Embedding
		}
		p.source.Identity = prev.Identity
	}
	for i, t := range p.texts {
		if v, ok := reuse[t]; ok {
			p.vecs[i] = v
			p.reused++
		} else {
			p.needIdx = append(p.needIdx, i)
			p.needTexts = append(p.needTexts, t)
		}
	}
	return p, nil
}

// cluster builds the source's own forest over its windows. Called once every
// vector is in place.
//
// A window whose text did not change keeps the id it already had, because the id
// is DERIVED from that text (windowID). Minting a fresh id for every window on
// every add — which this once did — meant a one-character edit replaced the
// identity of every artifact in the source, so nothing downstream could tell what
// had actually changed. Stable ids are the precondition for any incremental
// scheme, and they stop the corpus tier being discarded and re-minted wholesale
// on every rebuild.
//
// Deriving rather than inheriting is what makes the ids reproducible as well as
// stable: two ingests of the same content agree, so the frontier — which both
// frontier queries order by id — arrives in the same order every time. That order
// reaches the pinned clustering threshold through the sparse path's sample, which
// is why random ids made the whole lattice irreproducible. See windowID.
func (p *addPlan) cluster(k *Knowledge, now time.Time) {
	if len(p.spans) == 0 {
		return
	}
	winIDs := make([]string, len(p.spans))
	p.windows = make([]Window, len(p.spans))
	// occurrence counts how many earlier windows in this source carry the same
	// text, which is what separates two identical windows into two ids — an id is
	// a primary key — and what reproduces the inheritance the priorIDs queue used
	// to perform by lookup.
	occurrence := map[string]int{}
	for i, s := range p.spans {
		text := p.texts[i]
		id := windowID(p.source.LocalRefID, occurrence[text], text)
		occurrence[text]++
		// The window carries its own text and the components that text covers, so
		// nothing downstream needs a second copy of the source to interpret the range.
		// Both are computed here, from the snapshot being written, which is what keeps
		// a window's text and its range from ever disagreeing.
		p.windows[i] = Window{
			ID: id, LocalRefID: p.source.LocalRefID, Ordinal: s.ordinal,
			Start: s.start, End: s.end, Embedding: p.vecs[i],
			Text:   text,
			Blocks: coveredBlocks(p.source.Blocks, s.start, s.end),
		}
		winIDs[i] = id
	}
	// Scoped to this source, with no stored index: the index store is keyed on
	// (project, level) and has no room for a source, so a source ascent always
	// builds each level in full. That is the same call the corpus tier makes
	// with an empty localRefID and the project's indexes — one ascent, two
	// scopes.
	scope := ascentScope{projectID: p.source.ProjectID, localRefID: p.source.LocalRefID}
	p.nodes = ascend(scope, winIDs, p.vecs, k.cluster, now).nodes
}

// embedWindows returns a unit-normalized vector per window text, reusing the
// stored embedding of any window whose text is unchanged from prev and embedding
// only the rest. It returns the vectors, the usage the (partial) embed cost, the
// resulting vector identity, and the reused/embedded counts. If a re-sync's embed
// call reveals the embedding space changed (the model was re-routed), the reused
// vectors would be from the old space, so everything is re-embedded under the new
// identity instead.
func (k *Knowledge) embedPending(ctx context.Context, pending []*addPlan) error {
	// Every source's outstanding texts travel in ONE call. This is the whole point
	// of batching: a connector's first sync over N files used to make N provider
	// requests back to back, and that shape is what a per-minute rate limit exists
	// to stop. (Embed chunks internally, so this is one call per max_batch_inputs
	// windows rather than one enormous request.)
	var batch []string
	for _, p := range pending {
		batch = append(batch, p.needTexts...)
	}
	if len(batch) == 0 {
		return nil
	}
	emb, err := k.embedder.Embed(ctx, batch)
	if err != nil {
		var partial *PartialEmbeddingError
		if errors.As(err, &partial) {
			recordPartialEmbeddingUsage(pending, partial.CompletedInputs, partial.Usage)
		}
		return err
	}
	// The Embedder owes one vector per input. intelligence.Embed enforces that at
	// the provider boundary, but this indexes by position, so a short list here
	// would read off the end and panic — a provider hiccup should never crash the
	// lattice. Check before indexing rather than trusting the port.
	if len(emb.Vectors) != len(batch) {
		return fmt.Errorf("knowledge: embedder returned %d vector(s) for %d window(s)", len(emb.Vectors), len(batch))
	}

	// Scatter the vectors back, splitting the usage across the sources that caused
	// it so a per-source AddResult still reports something honest.
	at := 0
	var restale []*addPlan
	for _, p := range pending {
		for j, idx := range p.needIdx {
			p.vecs[idx] = normalize(emb.Vectors[at+j])
		}
		p.embedded = len(p.needTexts)
		p.usage = shareUsage(emb.Usage, len(p.needTexts), len(batch))
		at += len(p.needTexts)

		// A source that reused vectors from a DIFFERENT space than the one this call
		// resolved to is holding stale vectors: the embedding route was re-pointed
		// since it was last synced. Mixing the two would compare vectors that have no
		// common basis, which does not fail — it silently retrieves nothing.
		if p.reused > 0 && emb.Identity != p.source.Identity {
			restale = append(restale, p)
		} else {
			p.source.Identity = emb.Identity
		}
	}
	if len(restale) == 0 {
		return nil
	}

	// Re-embed the stale sources in full, again as one batch.
	var redo []string
	for _, p := range restale {
		redo = append(redo, p.texts...)
	}
	all, err := k.embedder.Embed(ctx, redo)
	if err != nil {
		var partial *PartialEmbeddingError
		if errors.As(err, &partial) {
			recordAdditionalPartialEmbeddingUsage(restale, partial.CompletedInputs, partial.Usage)
		}
		return err
	}
	if len(all.Vectors) != len(redo) {
		return fmt.Errorf("knowledge: embedder returned %d vector(s) for %d text(s)", len(all.Vectors), len(redo))
	}
	at = 0
	for _, p := range restale {
		for i := range p.texts {
			p.vecs[i] = normalize(all.Vectors[at+i])
		}
		p.reused, p.embedded = 0, len(p.texts)
		p.usage = addUsage(p.usage, shareUsage(all.Usage, len(p.texts), len(redo)))
		p.source.Identity = all.Identity
		at += len(p.texts)
	}
	return nil
}

// recordAdditionalPartialEmbeddingUsage preserves spend from the re-embed that
// follows a vector-identity change. Those inputs are additional provider work,
// unlike the first pass, so their usage is added to the source's existing share.
func recordAdditionalPartialEmbeddingUsage(pending []*addPlan, completed int, usage Usage) {
	if completed <= 0 {
		return
	}
	remaining := completed
	for _, p := range pending {
		part := len(p.texts)
		if part > remaining {
			part = remaining
		}
		if part > 0 {
			p.embedded += part
			p.usage = addUsage(p.usage, shareUsage(usage, part, completed))
			remaining -= part
		}
		if remaining == 0 {
			return
		}
	}
}

func recordPartialEmbeddingUsage(pending []*addPlan, completed int, usage Usage) {
	if completed <= 0 {
		return
	}
	remaining := completed
	for _, p := range pending {
		part := len(p.needTexts)
		if part > remaining {
			part = remaining
		}
		if part > 0 {
			p.embedded = part
			p.usage = shareUsage(usage, part, completed)
			remaining -= part
		}
		if remaining == 0 {
			return
		}
	}
}

func addUsage(a, b Usage) Usage {
	return Usage{
		PromptTokens: a.PromptTokens + b.PromptTokens,
		TotalTokens:  a.TotalTokens + b.TotalTokens,
		Requests:     a.Requests + b.Requests,
		CostUSD:      a.CostUSD + b.CostUSD,
	}
}

// shareUsage apportions a batch's usage to one source by its share of the inputs.
//
// The provider bills the batch, not the sources in it, so any per-source figure
// is an attribution rather than a measurement. Splitting by input count is the
// honest approximation available here — the alternative, charging the whole batch
// to every source, would make a sync's reported cost scale with the number of
// files rather than the tokens actually spent.
func shareUsage(total Usage, part, whole int) Usage {
	if whole <= 0 || part <= 0 {
		return Usage{}
	}
	requests := 0
	if total.Requests > 0 {
		requests = max(1, total.Requests*part/whole)
	}
	return Usage{
		PromptTokens: total.PromptTokens * part / whole,
		TotalTokens:  total.TotalTokens * part / whole,
		Requests:     requests,
		CostUSD:      total.CostUSD * float64(part) / float64(whole),
	}
}

// ContentHash identifies a source snapshot by its bytes. Hex sha256, so it is
// safe to compare, log and store as text, and cheap to compute incrementally once
// ingest streams — the point of storing it rather than the text it summarises.
//
// It is never the empty string, not even for empty content, which is what lets a
// stored empty hash mean "not yet backfilled" and nothing else.
//
// Exported for the same reason CoveredBlocks is: the migration that fills this
// column in from the old stored text must produce the byte-identical answer this
// does, or every migrated source would compare as changed on its next sync and
// re-cluster for nothing.
func ContentHash(text string) string {
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])
}

// unchangedFrom reports whether re-adding (label, text, blocks) over prev would
// reproduce exactly what is already stored.
//
// It compares text rather than revision on purpose. A connector passes its sync
// sequence as the revision and bumps it on every sync, so a revision comparison
// would never match and the check would never fire. The snapshot is the truth
// here; the revision is only the origin's own bookkeeping.
//
// The comparison is by hash because the lattice no longer keeps the text to
// compare against — and would not want to hold both copies in memory if it did.
// A collision would skip a real change silently, which is the reason for sha256
// rather than something cheaper: at that width the case does not arise.
//
// A source stored before the hash column existed carries an empty hash and so
// never matches. That is the safe direction — it re-windows and re-clusters once,
// paying no provider tokens, because the reuse map keys on window text — but the
// migration backfills the hash anyway so the case does not arise in practice.
//
// Blocks are part of the comparison because they are part of what a retrieval
// cites. A document can be restructured into different blocks that flatten to
// byte-identical text, and skipping that would leave every stored span pointing
// at the previous structure — a citation that resolves to the wrong place is
// worse than one that costs a re-cluster.
func unchangedFrom(prev Source, label, hash string, blocks []BlockSpan) bool {
	if prev.Label != label || prev.ContentHash != hash || len(prev.Blocks) != len(blocks) {
		return false
	}
	for i, b := range blocks {
		if prev.Blocks[i] != b {
			return false
		}
	}
	return true
}

// RemoveResult reports whether a Remove deleted anything, and whether the corpus
// rebuild it triggered was skipped for size.
type RemoveResult struct {
	Removed bool `json:"removed"`
}

// Remove deletes a source from the project's lattice and marks the corpus tier
// stale. Removing an origin that was never added is a no-op that reports
// Removed=false (the caller maps that to a 404).
func (k *Knowledge) Remove(_ context.Context, projectID, sourceType, sourceID string) (RemoveResult, error) {
	if k.generations != nil {
		token, _, _, err := k.generations.Active(projectID, LatticeText)
		if errors.Is(err, ErrEmbeddingSpaceUnavailable) {
			return RemoveResult{}, nil
		}
		if err != nil {
			return RemoveResult{}, err
		}
		existed, _, err := k.generations.DeleteActive(token, sourceType, sourceID, k.now().UTC())
		if err != nil {
			return RemoveResult{}, err
		}
		if existed {
			k.queueCorpusRebuild(projectID)
		}
		return RemoveResult{Removed: existed}, nil
	}
	existed, err := k.store.DeleteSource(projectID, sourceType, sourceID)
	if err != nil {
		return RemoveResult{}, err
	}
	if existed {
		k.queueCorpusRebuild(projectID)
	}
	return RemoveResult{Removed: existed}, nil
}

// The corpus tier is clustered by the same ascend (lattice.go) this source
// forest is, scoped with an empty localRefID: the union of every source's
// frontier — all roots plus all never-clustered orphan windows — ascended by
// the same KLR rule, with persisted level indexes wherever a level runs sparse.
// An orphan that found no peers inside its own source may find them there, in
// another source.

// sourceFrontier derives the frontier of every source in a project from its
// nodes and windows: the source-tier nodes that are no source-tier node's
// member, plus the windows that are no source-tier node's member. Corpus-tier
// membership is ignored — the frontier is intrinsic to the source lattices, and
// the corpus tier is built from it.
func sourceFrontier(nodes []Node, windows []Window) []FrontierEntry {
	member := make(map[string]bool)
	for _, n := range nodes {
		if n.LocalRefID == "" {
			continue
		}
		for _, m := range n.MemberIDs {
			member[m] = true
		}
	}
	var out []FrontierEntry
	for _, n := range nodes {
		if n.LocalRefID != "" && !member[n.ID] {
			out = append(out, FrontierEntry{ID: n.ID, Vector: n.Centroid})
		}
	}
	for _, w := range windows {
		if !member[w.ID] {
			out = append(out, FrontierEntry{ID: w.ID, Vector: w.Embedding, IsWindow: true})
		}
	}
	return out
}

// ErrUnreadable reports that a source's content could not be read. It is not
// fatal to a batch: one unreadable file is a reason to leave that file out, never
// to abandon the sync of everything beside it — the same judgement the connector
// already makes about a file it cannot admit.
var ErrUnreadable = errors.New("knowledge: source content could not be read")

// windowContent reads a source once and derives from that single pass everything
// the plan needs: the windows, their text, and the size, line count and hash the
// source row keeps.
//
// One pass is the point. The batch windower needed the whole document resident —
// it indexes into it to slice each sentence and to test each window for blankness
// — so ingesting a file meant holding it. Here the bytes arrive in a fixed buffer,
// the hash and the line count accumulate as counters, and what is retained is the
// windows, which the lattice was going to store anyway.
func (k *Knowledge) windowContent(ctx context.Context, p *addPlan, c Content, runBytesRead int64) error {
	if c.Open == nil {
		return fmt.Errorf("%w: no content reader", ErrUnreadable)
	}
	rc, err := c.Open()
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUnreadable, err)
	}
	defer rc.Close()

	w := newStreamWindower(k.windowTarget, k.windowOverlap)
	hash := sha256.New()
	buf := make([]byte, 64*1024)
	size, newlines := 0, 0
	endsWithNewline := false

	take := func(pieces []windowPiece) {
		for _, piece := range pieces {
			p.spans = append(p.spans, piece.windowSpan)
			p.texts = append(p.texts, piece.text)
		}
	}
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		readBuf, limitErr := k.readBuffer(buf, p.source.SourceID, int64(size), runBytesRead)
		if limitErr != nil {
			return limitErr
		}
		n, readErr := rc.Read(readBuf)
		if n > 0 {
			chunk := buf[:n]
			next := int64(size) + int64(n)
			if next < int64(size) {
				return sourceBytesLimit(p.source.SourceID, k.maxSourceBytes, int64(^uint64(0)>>1))
			}
			if k.maxSourceBytes > 0 && next > k.maxSourceBytes {
				return sourceBytesLimit(p.source.SourceID, k.maxSourceBytes, next)
			}
			runActual := runBytesRead + next
			if runActual < runBytesRead {
				return runBytesLimit(p.source.ProjectID, k.maxRunBytes, int64(^uint64(0)>>1))
			}
			if k.maxRunBytes > 0 && runActual > k.maxRunBytes {
				return runBytesLimit(p.source.ProjectID, k.maxRunBytes, runActual)
			}
			hash.Write(chunk)
			size += n
			for _, b := range chunk {
				if b == '\n' {
					newlines++
				}
			}
			endsWithNewline = chunk[n-1] == '\n'
			take(w.write(string(chunk)))
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return fmt.Errorf("%w: %v", ErrUnreadable, readErr)
		}
		if n == 0 {
			return fmt.Errorf("%w: %v", ErrUnreadable, io.ErrNoProgress)
		}
	}
	take(w.close())

	// CountLines counts a trailing partial line, so a file not ending in a newline
	// has one more line than it has newlines. Derived here rather than by calling
	// CountLines, which would need the text this function exists not to hold.
	lines := newlines
	if size > 0 && !endsWithNewline {
		lines++
	}
	p.source.SizeBytes = size
	p.source.LineCount = lines
	// The hash of what was actually read, not the hash the provider advertised.
	// The two can differ — the source is external and may have changed between the
	// listing and the read — and the stored hash has to describe the bytes that
	// were indexed, or the next sync would skip a source it never really ingested.
	p.source.ContentHash = hex.EncodeToString(hash.Sum(nil))
	// Connector entries carry one synthetic whole-file block. Its listed Size is
	// untrusted, so its citation range must be corrected to the bytes actually
	// counted rather than making an unknown/too-small claim hide every region.
	if p.source.SourceType == SourceTypeConnector && len(p.source.Blocks) == 1 && p.source.Blocks[0].Start == 0 {
		p.source.Blocks[0].End = size
	}
	return nil
}

// readBuffer gives the source reader no more than its remaining allowance. When
// a cap is exactly reached it permits one final byte, solely to distinguish EOF
// from an over-limit stream. This keeps a lying or endless provider from making
// the process read an arbitrary buffer beyond either cap.
func (k *Knowledge) readBuffer(buf []byte, sourceID string, sourceBytes, runBytesRead int64) ([]byte, error) {
	allow := int64(len(buf))
	limitRead := func(limit, used int64) int64 {
		if limit <= 0 {
			return allow
		}
		if used >= limit {
			return 1
		}
		remaining := limit - used
		if remaining < allow {
			return remaining
		}
		return allow
	}
	allow = limitRead(k.maxSourceBytes, sourceBytes)
	if run := limitRead(k.maxRunBytes, runBytesRead+sourceBytes); run < allow {
		allow = run
	}
	if allow < 1 {
		return nil, sourceBytesLimit(sourceID, k.maxSourceBytes, sourceBytes+1)
	}
	return buf[:int(allow)], nil
}
