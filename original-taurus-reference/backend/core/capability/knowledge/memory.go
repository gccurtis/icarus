package knowledge

import (
	"errors"
	"reflect"
	"sort"
	"strings"
	"sync"
	"time"
)

// MemoryStore is both the in-memory lifecycle root and the compatibility
// artifact store used by tests. Generation views share this mutex, matching the
// transaction boundaries of the durable store: active artifact mutation,
// source-cursor advancement, checkpoint publication and pointer changes are
// each indivisible.
type MemoryStore struct {
	mu sync.Mutex

	// legacy holds artifacts written without a lifecycle. Direct ArtifactStore
	// calls continue to work for focused lattice tests; once a Project has an
	// active generation, direct calls for that Project resolve to its active set.
	legacy    memoryArtifacts
	artifacts map[string]*memoryArtifacts

	spaces      map[string]EmbeddingSpace
	generations map[string]LatticeGeneration
	states      map[memoryLatticeKey]ProjectLatticeState
	changes     map[memoryLatticeKey][]SourceChange

	previews         map[string]ReembedPreview
	runs             map[string]ReembedRun
	runByIdempotency map[string]string
	checkpoints      map[string]map[string]ReembedCheckpoint

	events        map[string][]GenerationEvent
	eventSequence int64
}

type memoryArtifacts struct {
	sources []Source
	windows []Window
	nodes   []Node
	corpus  map[string]corpusSeq
	indexes map[string][]CorpusLevelIndex
}

type memoryLatticeKey struct {
	projectID string
	kind      LatticeKind
}

type memoryArtifactView struct {
	root         *MemoryStore
	generationID string
}

// corpusSeq is one project's corpus freshness: dirty is bumped by every source
// write, while built records the frontier sequence of the stored corpus tier.
type corpusSeq struct{ dirty, built int64 }

// NewMemoryStore returns an empty in-memory lifecycle and lattice store.
func NewMemoryStore() *MemoryStore { return &MemoryStore{} }

func (s *MemoryStore) dataLocked(generationID string) *memoryArtifacts {
	if generationID == "" {
		return &s.legacy
	}
	if s.artifacts == nil {
		s.artifacts = map[string]*memoryArtifacts{}
	}
	if s.artifacts[generationID] == nil {
		s.artifacts[generationID] = &memoryArtifacts{}
	}
	return s.artifacts[generationID]
}

func (s *MemoryStore) activeGenerationLocked(projectID string, kind LatticeKind) string {
	return s.states[memoryLatticeKey{projectID: projectID, kind: kind}].ActiveGenerationID
}

func (s *MemoryStore) compatibleDataLocked(projectID string) *memoryArtifacts {
	return s.dataLocked(s.activeGenerationLocked(projectID, LatticeText))
}

func (s *MemoryStore) activeDataLocked() []*memoryArtifacts {
	out := []*memoryArtifacts{&s.legacy}
	seen := map[string]bool{"": true}
	for _, state := range s.states {
		if state.ActiveGenerationID != "" && !seen[state.ActiveGenerationID] {
			out = append(out, s.dataLocked(state.ActiveGenerationID))
			seen[state.ActiveGenerationID] = true
		}
	}
	return out
}

// --- compatibility ArtifactStore surface ---

func (s *MemoryStore) SourceByOrigin(projectID, sourceType, sourceID string) (Source, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	source, found := sourceByOriginLocked(s.compatibleDataLocked(projectID), projectID, sourceType, sourceID)
	return source, found, nil
}

func (s *MemoryStore) SourcesUnder(projectID, sourceType, sourceIDPrefix string) ([]Origin, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return sourcesUnderLocked(s.compatibleDataLocked(projectID), projectID, sourceType, sourceIDPrefix), nil
}

func (s *MemoryStore) Sources(projectID string) ([]Source, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return sourcesLocked(s.compatibleDataLocked(projectID), projectID), nil
}

func (s *MemoryStore) ReplaceSources(writes []SourceWrite) error {
	if len(writes) == 0 {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return replaceSourcesLocked(s.compatibleDataLocked(writes[0].Source.ProjectID), writes)
}

func (s *MemoryStore) AdmitAndReplaceSources(maxArtifacts int, writes []SourceWrite) (ArtifactCounts, error) {
	if len(writes) == 0 {
		return ArtifactCounts{}, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return admitAndReplaceSourcesLocked(s.compatibleDataLocked(writes[0].Source.ProjectID), maxArtifacts, writes)
}

func (s *MemoryStore) DeleteSource(projectID, sourceType, sourceID string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return deleteSourceLocked(s.compatibleDataLocked(projectID), projectID, sourceType, sourceID)
}

func (s *MemoryStore) SourceFrontier(projectID string) ([]FrontierEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return sourceFrontierLocked(s.compatibleDataLocked(projectID), projectID), nil
}

func (s *MemoryStore) CorpusSeq(projectID string) (dirty, built int64, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	c := s.compatibleDataLocked(projectID).corpus[projectID]
	return c.dirty, c.built, nil
}

func (s *MemoryStore) RebuildCorpus(projectID string, corpus []Node, seq int64, indexes []CorpusLevelIndex) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	rebuildCorpusLocked(s.compatibleDataLocked(projectID), projectID, corpus, seq, indexes)
	return nil
}

func (s *MemoryStore) AdmitCorpus(projectID string, maxArtifacts int, corpus []Node, seq int64, indexes []CorpusLevelIndex) (ArtifactCounts, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return admitCorpusLocked(s.compatibleDataLocked(projectID), projectID, maxArtifacts, corpus, seq, indexes)
}

func (s *MemoryStore) CorpusIndexes(projectID string) ([]CorpusLevelIndex, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return cloneIndexes(s.compatibleDataLocked(projectID).indexes[projectID]), nil
}

func (s *MemoryStore) ArtifactCounts(projectID string) (map[string]int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return artifactCountsLocked(s.compatibleDataLocked(projectID), projectID), nil
}

func (s *MemoryStore) Identities(projectID string) (map[string]VectorIdentity, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return identitiesLocked(s.compatibleDataLocked(projectID), projectID), nil
}

func (s *MemoryStore) EntryFrontier(projectID string) ([]FrontierEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return entryFrontierLocked(s.compatibleDataLocked(projectID), projectID), nil
}

func (s *MemoryStore) CorpusIndexHeader(projectID string, level int) (CorpusLevelIndex, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return corpusIndexHeaderLocked(s.compatibleDataLocked(projectID), projectID, level)
}

func (s *MemoryStore) EntryFrontierProbed(projectID string, level int, cells []int) ([]FrontierEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return entryFrontierProbedLocked(s.compatibleDataLocked(projectID), projectID, level, cells), nil
}

func (s *MemoryStore) NodesByID(ids []string) ([]Node, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return nodesByIDLocked(s.activeDataLocked(), ids), nil
}

func (s *MemoryStore) WindowsByID(ids []string) ([]Window, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return windowsByIDLocked(s.activeDataLocked(), ids), nil
}

func (s *MemoryStore) WindowContent(ids []string) (map[string]WindowContent, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return windowContentLocked(s.activeDataLocked(), ids), nil
}

func (s *MemoryStore) ProjectWindows(projectID string) ([]Window, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return projectWindowsLocked(s.compatibleDataLocked(projectID), projectID), nil
}

func (s *MemoryStore) SourceWindows(localRefID string) ([]Window, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return sourceWindowsLocked(s.activeDataLocked(), localRefID), nil
}

// ProjectChangedSince is retained for the legacy Store interface. Lifecycle
// callers use ChangedSince, whose tombstone stream also observes removals.
func (s *MemoryStore) ProjectChangedSince(projectID string, at time.Time) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, src := range s.compatibleDataLocked(projectID).sources {
		if src.ProjectID == projectID && src.SyncedAt.After(at) {
			return true, nil
		}
	}
	return false, nil
}

func (s *MemoryStore) SourcesByRef(refs []string) (map[string]Source, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return sourcesByRefLocked(s.activeDataLocked(), refs), nil
}

// --- generation-pinned ArtifactStore view ---

func (s *MemoryStore) ForGeneration(generationID string) ArtifactStore {
	return &memoryArtifactView{root: s, generationID: generationID}
}

func (v *memoryArtifactView) withData(fn func(*memoryArtifacts) error) error {
	v.root.mu.Lock()
	defer v.root.mu.Unlock()
	return fn(v.root.dataLocked(v.generationID))
}

func (v *memoryArtifactView) SourceByOrigin(projectID, sourceType, sourceID string) (out Source, found bool, err error) {
	err = v.withData(func(d *memoryArtifacts) error {
		out, found = sourceByOriginLocked(d, projectID, sourceType, sourceID)
		return nil
	})
	return
}

func (v *memoryArtifactView) SourcesUnder(projectID, sourceType, prefix string) (out []Origin, err error) {
	err = v.withData(func(d *memoryArtifacts) error {
		out = sourcesUnderLocked(d, projectID, sourceType, prefix)
		return nil
	})
	return
}

func (v *memoryArtifactView) Sources(projectID string) (out []Source, err error) {
	err = v.withData(func(d *memoryArtifacts) error {
		out = sourcesLocked(d, projectID)
		return nil
	})
	return
}

func (v *memoryArtifactView) ReplaceSources(writes []SourceWrite) error {
	if len(writes) == 0 {
		return nil
	}
	return v.withData(func(d *memoryArtifacts) error { return replaceSourcesLocked(d, writes) })
}

func (v *memoryArtifactView) DeleteSource(projectID, sourceType, sourceID string) (removed bool, err error) {
	err = v.withData(func(d *memoryArtifacts) error {
		removed, _ = deleteSourceLocked(d, projectID, sourceType, sourceID)
		return nil
	})
	return
}

func (v *memoryArtifactView) CorpusSeq(projectID string) (dirty, built int64, err error) {
	err = v.withData(func(d *memoryArtifacts) error {
		c := d.corpus[projectID]
		dirty, built = c.dirty, c.built
		return nil
	})
	return
}

func (v *memoryArtifactView) RebuildCorpus(projectID string, corpus []Node, seq int64, indexes []CorpusLevelIndex) error {
	return v.withData(func(d *memoryArtifacts) error {
		rebuildCorpusLocked(d, projectID, corpus, seq, indexes)
		return nil
	})
}

func (v *memoryArtifactView) CorpusIndexes(projectID string) (out []CorpusLevelIndex, err error) {
	err = v.withData(func(d *memoryArtifacts) error {
		out = cloneIndexes(d.indexes[projectID])
		return nil
	})
	return
}

func (v *memoryArtifactView) CorpusIndexHeader(projectID string, level int) (out CorpusLevelIndex, found bool, err error) {
	err = v.withData(func(d *memoryArtifacts) error {
		out, found, _ = corpusIndexHeaderLocked(d, projectID, level)
		return nil
	})
	return
}

func (v *memoryArtifactView) EntryFrontierProbed(projectID string, level int, cells []int) (out []FrontierEntry, err error) {
	err = v.withData(func(d *memoryArtifacts) error {
		out = entryFrontierProbedLocked(d, projectID, level, cells)
		return nil
	})
	return
}

func (v *memoryArtifactView) SourceFrontier(projectID string) (out []FrontierEntry, err error) {
	err = v.withData(func(d *memoryArtifacts) error {
		out = sourceFrontierLocked(d, projectID)
		return nil
	})
	return
}

func (v *memoryArtifactView) Identities(projectID string) (out map[string]VectorIdentity, err error) {
	err = v.withData(func(d *memoryArtifacts) error {
		out = identitiesLocked(d, projectID)
		return nil
	})
	return
}

func (v *memoryArtifactView) EntryFrontier(projectID string) (out []FrontierEntry, err error) {
	err = v.withData(func(d *memoryArtifacts) error {
		out = entryFrontierLocked(d, projectID)
		return nil
	})
	return
}

func (v *memoryArtifactView) NodesByID(ids []string) (out []Node, err error) {
	err = v.withData(func(d *memoryArtifacts) error {
		out = nodesByIDLocked([]*memoryArtifacts{d}, ids)
		return nil
	})
	return
}

func (v *memoryArtifactView) WindowsByID(ids []string) (out []Window, err error) {
	err = v.withData(func(d *memoryArtifacts) error {
		out = windowsByIDLocked([]*memoryArtifacts{d}, ids)
		return nil
	})
	return
}

func (v *memoryArtifactView) ProjectWindows(projectID string) (out []Window, err error) {
	err = v.withData(func(d *memoryArtifacts) error {
		out = projectWindowsLocked(d, projectID)
		return nil
	})
	return
}

func (v *memoryArtifactView) WindowContent(ids []string) (out map[string]WindowContent, err error) {
	err = v.withData(func(d *memoryArtifacts) error {
		out = windowContentLocked([]*memoryArtifacts{d}, ids)
		return nil
	})
	return
}

func (v *memoryArtifactView) SourceWindows(localRefID string) (out []Window, err error) {
	err = v.withData(func(d *memoryArtifacts) error {
		out = sourceWindowsLocked([]*memoryArtifacts{d}, localRefID)
		return nil
	})
	return
}

func (v *memoryArtifactView) SourcesByRef(refs []string) (out map[string]Source, err error) {
	err = v.withData(func(d *memoryArtifacts) error {
		out = sourcesByRefLocked([]*memoryArtifacts{d}, refs)
		return nil
	})
	return
}

func (v *memoryArtifactView) ArtifactCounts(projectID string) (out map[string]int, err error) {
	err = v.withData(func(d *memoryArtifacts) error {
		out = artifactCountsLocked(d, projectID)
		return nil
	})
	return
}

func (v *memoryArtifactView) AdmitAndReplaceSources(maxArtifacts int, writes []SourceWrite) (out ArtifactCounts, err error) {
	if len(writes) == 0 {
		return ArtifactCounts{}, nil
	}
	err = v.withData(func(d *memoryArtifacts) error {
		out, err = admitAndReplaceSourcesLocked(d, maxArtifacts, writes)
		return err
	})
	return
}

func (v *memoryArtifactView) AdmitCorpus(projectID string, maxArtifacts int, corpus []Node, seq int64, indexes []CorpusLevelIndex) (out ArtifactCounts, err error) {
	err = v.withData(func(d *memoryArtifacts) error {
		out, err = admitCorpusLocked(d, projectID, maxArtifacts, corpus, seq, indexes)
		return err
	})
	return
}

// --- GenerationStore lifecycle root ---

func (s *MemoryStore) Active(projectID string, kind LatticeKind) (ReadToken, LatticeGeneration, EmbeddingSpace, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, ok := s.states[memoryLatticeKey{projectID: projectID, kind: kind}]
	if !ok {
		return ReadToken{}, LatticeGeneration{}, EmbeddingSpace{}, ErrGenerationNotInitialized
	}
	if state.ActiveGenerationID == "" {
		return ReadToken{}, LatticeGeneration{}, EmbeddingSpace{}, ErrEmbeddingSpaceUnavailable
	}
	generation, ok := s.generations[state.ActiveGenerationID]
	if !ok || generation.State != GenerationActive {
		return ReadToken{}, LatticeGeneration{}, EmbeddingSpace{}, ErrEmbeddingSpaceUnavailable
	}
	space, ok := s.spaces[generation.SpaceIdentity]
	if !ok {
		return ReadToken{}, LatticeGeneration{}, EmbeddingSpace{}, ErrEmbeddingSpaceUnavailable
	}
	return tokenFor(state), generation, space, nil
}

func (s *MemoryStore) ReembedBase(projectID string, kind LatticeKind) (ReadToken, LatticeGeneration, EmbeddingSpace, error) {
	return s.Active(projectID, kind)
}

func (s *MemoryStore) EnsureActive(projectID string, kind LatticeKind, generation LatticeGeneration, space EmbeddingSpace) (ReadToken, LatticeGeneration, error) {
	if projectID == "" || kind == "" || generation.ID == "" || space.Validate() != nil {
		return ReadToken{}, LatticeGeneration{}, ErrGenerationConflict
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	key := memoryLatticeKey{projectID: projectID, kind: kind}
	if state, ok := s.states[key]; ok {
		if state.ActiveGenerationID == "" {
			return ReadToken{}, LatticeGeneration{}, ErrEmbeddingSpaceChangeRequired
		}
		active := s.generations[state.ActiveGenerationID]
		if active.SpaceIdentity != space.Identity() {
			return ReadToken{}, LatticeGeneration{}, ErrEmbeddingSpaceChangeRequired
		}
		return tokenFor(state), active, nil
	}
	if existing, ok := s.generations[generation.ID]; ok {
		if existing.ProjectID != projectID || existing.Kind != kind || existing.SpaceIdentity != space.Identity() {
			return ReadToken{}, LatticeGeneration{}, ErrGenerationConflict
		}
	}
	identity := space.Identity()
	if existing, ok := s.spaces[identity]; ok && !reflect.DeepEqual(existing, space) {
		return ReadToken{}, LatticeGeneration{}, ErrGenerationConflict
	}
	if generation.CreatedAt.IsZero() {
		generation.CreatedAt = time.Now().UTC()
	}
	generation.ProjectID = projectID
	generation.Kind = kind
	generation.SpaceIdentity = identity
	generation.State = GenerationActive
	at := generation.CreatedAt
	generation.PromotedAt = &at
	if s.spaces == nil {
		s.spaces = map[string]EmbeddingSpace{}
	}
	if s.generations == nil {
		s.generations = map[string]LatticeGeneration{}
	}
	if s.states == nil {
		s.states = map[memoryLatticeKey]ProjectLatticeState{}
	}
	s.spaces[identity] = space
	s.generations[generation.ID] = generation
	s.dataLocked(generation.ID)
	state := ProjectLatticeState{
		ProjectID: projectID, Kind: kind, ActiveGenerationID: generation.ID,
		Revision: 1, UpdatedAt: at,
	}
	s.states[key] = state
	return tokenFor(state), generation, nil
}

func (s *MemoryStore) Current(token ReadToken) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, ok := s.states[memoryLatticeKey{projectID: token.ProjectID, kind: token.Kind}]
	return ok && token.Equal(tokenFor(state)), nil
}

func (s *MemoryStore) AdmitAndReplaceActive(token ReadToken, maxArtifacts int, writes []SourceWrite, at time.Time) (ArtifactCounts, ReadToken, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.requireCurrentLocked(token)
	if err != nil {
		return ArtifactCounts{}, ReadToken{}, err
	}
	if len(writes) == 0 {
		return ArtifactCounts{}, tokenFor(state), nil
	}
	data := s.dataLocked(state.ActiveGenerationID)
	operations := make([]string, len(writes))
	for i, write := range writes {
		if write.Source.ProjectID != token.ProjectID {
			return ArtifactCounts{}, ReadToken{}, ErrGenerationConflict
		}
		_, found := sourceByOriginLocked(data, token.ProjectID, write.Source.SourceType, write.Source.SourceID)
		if found {
			operations[i] = SourceUpdated
		} else {
			operations[i] = SourceAdded
		}
	}
	counts, err := admitAndReplaceSourcesLocked(data, maxArtifacts, writes)
	if err != nil {
		return counts, ReadToken{}, err
	}
	for i, write := range writes {
		state.SourceCursor++
		s.appendSourceChangeLocked(memoryLatticeKey{token.ProjectID, token.Kind}, SourceChange{
			ProjectID: token.ProjectID, Kind: token.Kind, Cursor: state.SourceCursor,
			Operation: operations[i], SourceType: write.Source.SourceType, SourceID: write.Source.SourceID,
			Revision: write.Source.Revision, ContentHash: write.Source.ContentHash, OccurredAt: at,
		})
	}
	state.UpdatedAt = at
	s.states[memoryLatticeKey{token.ProjectID, token.Kind}] = state
	s.refreshGenerationCountsLocked(state.ActiveGenerationID, state.SourceCursor)
	return counts, tokenFor(state), nil
}

func (s *MemoryStore) DeleteActive(token ReadToken, sourceType, sourceID string, at time.Time) (bool, ReadToken, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.requireCurrentLocked(token)
	if err != nil {
		return false, ReadToken{}, err
	}
	data := s.dataLocked(state.ActiveGenerationID)
	source, found := sourceByOriginLocked(data, token.ProjectID, sourceType, sourceID)
	if !found {
		return false, tokenFor(state), nil
	}
	if _, err := deleteSourceLocked(data, token.ProjectID, sourceType, sourceID); err != nil {
		return false, ReadToken{}, err
	}
	state.SourceCursor++
	state.UpdatedAt = at
	key := memoryLatticeKey{token.ProjectID, token.Kind}
	s.states[key] = state
	s.appendSourceChangeLocked(key, SourceChange{
		ProjectID: token.ProjectID, Kind: token.Kind, Cursor: state.SourceCursor,
		Operation: SourceRemoved, SourceType: sourceType, SourceID: sourceID,
		Revision: source.Revision, ContentHash: source.ContentHash, OccurredAt: at,
	})
	s.refreshGenerationCountsLocked(state.ActiveGenerationID, state.SourceCursor)
	return true, tokenFor(state), nil
}

func (s *MemoryStore) ChangedSince(projectID string, kind LatticeKind, since time.Time) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if state, ok := s.states[memoryLatticeKey{projectID: projectID, kind: kind}]; ok &&
		state.UpdatedAt.After(since) {
		return true, nil
	}
	for _, change := range s.changes[memoryLatticeKey{projectID: projectID, kind: kind}] {
		if change.OccurredAt.After(since) {
			return true, nil
		}
	}
	return false, nil
}

func (s *MemoryStore) SourceChangesAfter(projectID string, kind LatticeKind, cursor int64, limit int) ([]SourceChange, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []SourceChange
	for _, change := range s.changes[memoryLatticeKey{projectID: projectID, kind: kind}] {
		if change.Cursor <= cursor {
			continue
		}
		out = append(out, change)
		if limit > 0 && len(out) == limit {
			break
		}
	}
	return out, nil
}

func (s *MemoryStore) SaveReembedPreview(preview ReembedPreview) error {
	if preview.ID == "" || preview.ProjectID == "" || preview.Kind == "" || preview.ToSpace.Validate() != nil {
		return ErrGenerationConflict
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.previews == nil {
		s.previews = map[string]ReembedPreview{}
	}
	if existing, ok := s.previews[preview.ID]; ok {
		if reflect.DeepEqual(existing, preview) {
			return nil
		}
		return ErrGenerationConflict
	}
	s.previews[preview.ID] = preview
	return nil
}

func (s *MemoryStore) ReembedPreview(projectID, previewID string) (ReembedPreview, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	preview, ok := s.previews[previewID]
	if !ok || preview.ProjectID != projectID {
		return ReembedPreview{}, ErrReembedNotFound
	}
	return preview, nil
}

func (s *MemoryStore) StartReembed(previewID string, run ReembedRun, generation LatticeGeneration) (ReembedRun, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	preview, ok := s.previews[previewID]
	if !ok {
		return ReembedRun{}, false, ErrReembedNotFound
	}
	idempotencyKey := preview.ProjectID + "\x00" + string(preview.Kind) + "\x00" + run.IdempotencyKey
	if existingID := s.runByIdempotency[idempotencyKey]; existingID != "" {
		return s.runs[existingID], true, nil
	}
	state, ok := s.states[memoryLatticeKey{preview.ProjectID, preview.Kind}]
	if !ok || state.Revision != preview.ExpectedStateRevision || state.SourceCursor != preview.SourceCursor ||
		state.ActiveGenerationID != preview.FromGenerationID {
		return ReembedRun{}, false, ErrReembedPreviewStale
	}
	startedAt := run.CreatedAt
	if startedAt.IsZero() {
		startedAt = generation.CreatedAt
	}
	if startedAt.IsZero() {
		startedAt = time.Now().UTC()
	}
	if !preview.ExpiresAt.IsZero() && !startedAt.Before(preview.ExpiresAt) {
		return ReembedRun{}, false, ErrReembedPreviewStale
	}
	if run.ID == "" || run.IdempotencyKey == "" || generation.ID == "" {
		return ReembedRun{}, false, ErrGenerationConflict
	}
	if existing, ok := s.generations[generation.ID]; ok && existing.ID != "" {
		return ReembedRun{}, false, ErrGenerationConflict
	}
	if s.runs == nil {
		s.runs = map[string]ReembedRun{}
	}
	if s.runByIdempotency == nil {
		s.runByIdempotency = map[string]string{}
	}
	if s.generations == nil {
		s.generations = map[string]LatticeGeneration{}
	}
	if s.spaces == nil {
		s.spaces = map[string]EmbeddingSpace{}
	}
	run.ProjectID = preview.ProjectID
	run.Kind = preview.Kind
	run.PreviewID = preview.ID
	run.TargetGenerationID = generation.ID
	run.TargetSpace = preview.ToSpace
	run.Status = ReembedQueued
	run.ExpectedRevision = preview.ExpectedStateRevision
	run.StartCursor = preview.SourceCursor
	run.CaughtUpCursor = preview.SourceCursor
	run.Policy = preview.Policy
	run.SourcesTotal = preview.Sources
	run.CreatedAt = startedAt
	run.UpdatedAt = run.CreatedAt
	generation.ProjectID = preview.ProjectID
	generation.Kind = preview.Kind
	generation.SpaceIdentity = preview.ToSpace.Identity()
	generation.State = GenerationBuilding
	generation.SourceWatermark = preview.SourceCursor
	if generation.CreatedAt.IsZero() {
		generation.CreatedAt = run.CreatedAt
	}
	s.spaces[generation.SpaceIdentity] = preview.ToSpace
	s.generations[generation.ID] = generation
	s.dataLocked(generation.ID)
	s.runs[run.ID] = run
	s.runByIdempotency[idempotencyKey] = run.ID
	return run, false, nil
}

func (s *MemoryStore) ReembedRun(projectID, runID string) (ReembedRun, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	run, ok := s.runs[runID]
	if !ok || run.ProjectID != projectID {
		return ReembedRun{}, ErrReembedNotFound
	}
	return run, nil
}

func (s *MemoryStore) SetReembedControl(projectID, runID string, control ReembedControl, at time.Time) (ReembedRun, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	run, ok := s.runs[runID]
	if !ok || run.ProjectID != projectID {
		return ReembedRun{}, ErrReembedNotFound
	}
	switch control {
	case ControlPause:
		switch run.Status {
		case ReembedQueued:
			run.Status = ReembedPaused
		case ReembedRunning:
			run.Status = ReembedPausing
		case ReembedPausing:
			run.Status = ReembedPaused
		case ReembedPaused:
			return run, nil
		default:
			return ReembedRun{}, ErrGenerationConflict
		}
	case ControlResume:
		if run.Status != ReembedPaused && run.Status != ReembedPausing {
			return ReembedRun{}, ErrGenerationConflict
		}
		run.Status = ReembedQueued
	case ControlCancel:
		if run.Status == ReembedCancelled {
			return run, nil
		}
		if reembedTerminal(run.Status) {
			return ReembedRun{}, ErrGenerationConflict
		}
		run.Status = ReembedCancelled
		generation := s.generations[run.TargetGenerationID]
		generation.State = GenerationFailed
		s.generations[generation.ID] = generation
	default:
		return ReembedRun{}, ErrGenerationConflict
	}
	run.UpdatedAt = at
	s.runs[runID] = run
	return run, nil
}

func (s *MemoryStore) ClaimReembed(runID string, at time.Time) (ReembedRun, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	run, ok := s.runs[runID]
	if !ok {
		return ReembedRun{}, false, ErrReembedNotFound
	}
	switch run.Status {
	case ReembedQueued:
		run.Status = ReembedRunning
		run.UpdatedAt = at
		s.runs[runID] = run
		return run, true, nil
	case ReembedPausing:
		run.Status = ReembedPaused
		run.UpdatedAt = at
		s.runs[runID] = run
		return run, false, nil
	case ReembedCancelled, ReembedCancelling:
		return run, false, nil
	default:
		return run, false, nil
	}
}

func (s *MemoryStore) RecoverReembeds(at time.Time) ([]ReembedRun, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var queued []ReembedRun
	for id, run := range s.runs {
		switch run.Status {
		case ReembedRunning, ReembedValidating:
			run.Status = ReembedQueued
			run.UpdatedAt = at
			s.runs[id] = run
		case ReembedPausing:
			run.Status = ReembedPaused
			run.UpdatedAt = at
			s.runs[id] = run
		}
		if run.Status == ReembedQueued {
			queued = append(queued, run)
		}
	}
	sort.Slice(queued, func(i, j int) bool {
		if !queued[i].CreatedAt.Equal(queued[j].CreatedAt) {
			return queued[i].CreatedAt.Before(queued[j].CreatedAt)
		}
		return queued[i].ID < queued[j].ID
	})
	return queued, nil
}

func (s *MemoryStore) ReembedCheckpoints(runID string) ([]ReembedCheckpoint, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.runs[runID]; !ok {
		return nil, ErrReembedNotFound
	}
	var out []ReembedCheckpoint
	for _, checkpoint := range s.checkpoints[runID] {
		out = append(out, checkpoint)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].SourceType != out[j].SourceType {
			return out[i].SourceType < out[j].SourceType
		}
		return out[i].SourceID < out[j].SourceID
	})
	return out, nil
}

func (s *MemoryStore) CommitReembedCheckpoint(runID string, checkpoint ReembedCheckpoint, write *SourceWrite, maxArtifacts int, at time.Time) (ReembedRun, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	run, ok := s.runs[runID]
	if !ok {
		return ReembedRun{}, ErrReembedNotFound
	}
	if run.Status == ReembedCancelled || run.Status == ReembedCancelling {
		return ReembedRun{}, ErrReembedCancelled
	}
	if run.Status != ReembedRunning {
		return ReembedRun{}, ErrGenerationConflict
	}
	if checkpoint.SourceType == "" || checkpoint.SourceID == "" {
		return ReembedRun{}, ErrGenerationConflict
	}
	if checkpoint.Status != "complete" && checkpoint.Status != "skipped" && checkpoint.Status != "failed" {
		return ReembedRun{}, ErrGenerationConflict
	}
	if (checkpoint.Status == "complete") != (write != nil) {
		return ReembedRun{}, ErrGenerationConflict
	}
	key := sourceCheckpointKey(checkpoint.SourceType, checkpoint.SourceID)
	old, existed := s.checkpoints[runID][key]
	if existed && old.Status == "complete" && checkpoint.Status == "complete" &&
		old.Revision == checkpoint.Revision && old.ContentHash == checkpoint.ContentHash {
		return run, nil
	}
	next := run
	if existed {
		removeCheckpointTotals(&next, old)
	}
	checkpoint.RunID = runID
	checkpoint.UpdatedAt = at
	addCheckpointTotals(&next, checkpoint)
	data := s.dataLocked(run.TargetGenerationID)
	if write != nil {
		if write.Source.ProjectID != run.ProjectID || write.Source.SourceType != checkpoint.SourceType ||
			write.Source.SourceID != checkpoint.SourceID || write.Source.Identity != run.TargetSpace.VectorIdentity() ||
			write.Source.Revision != checkpoint.Revision || write.Source.ContentHash != checkpoint.ContentHash {
			return ReembedRun{}, ErrGenerationConflict
		}
		if _, err := admitAndReplaceSourcesLocked(data, maxArtifacts, []SourceWrite{*write}); err != nil {
			return ReembedRun{}, err
		}
	}
	if s.checkpoints == nil {
		s.checkpoints = map[string]map[string]ReembedCheckpoint{}
	}
	if s.checkpoints[runID] == nil {
		s.checkpoints[runID] = map[string]ReembedCheckpoint{}
	}
	s.checkpoints[runID][key] = checkpoint
	if distinct := len(s.checkpoints[runID]); distinct > next.SourcesTotal {
		next.SourcesTotal = distinct
	}
	next.UpdatedAt = at
	s.runs[runID] = next
	s.refreshGenerationCountsLocked(run.TargetGenerationID, run.CaughtUpCursor)
	return next, nil
}

func (s *MemoryStore) DeleteReembedCheckpoint(runID, sourceType, sourceID string, at time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	run, ok := s.runs[runID]
	if !ok {
		return ErrReembedNotFound
	}
	if run.Status != ReembedRunning && run.Status != ReembedValidating {
		return ErrGenerationConflict
	}
	key := sourceCheckpointKey(sourceType, sourceID)
	checkpoint, found := s.checkpoints[runID][key]
	if found {
		removeCheckpointTotals(&run, checkpoint)
		delete(s.checkpoints[runID], key)
		if run.SourcesTotal > 0 {
			run.SourcesTotal--
		}
	}
	_, _ = deleteSourceLocked(s.dataLocked(run.TargetGenerationID), run.ProjectID, sourceType, sourceID)
	run.UpdatedAt = at
	s.runs[runID] = run
	s.refreshGenerationCountsLocked(run.TargetGenerationID, run.CaughtUpCursor)
	return nil
}

func (s *MemoryStore) MarkReembedReady(runID string, sourceWatermark int64, validation Validation, corpus []Node, indexes []CorpusLevelIndex, at time.Time) (ReembedRun, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	run, ok := s.runs[runID]
	if !ok {
		return ReembedRun{}, ErrReembedNotFound
	}
	if run.Status == ReembedCancelled || run.Status == ReembedCancelling {
		return ReembedRun{}, ErrReembedCancelled
	}
	if run.Status != ReembedRunning && run.Status != ReembedValidating {
		return ReembedRun{}, ErrGenerationConflict
	}
	state := s.states[memoryLatticeKey{run.ProjectID, run.Kind}]
	if sourceWatermark != state.SourceCursor {
		return ReembedRun{}, ErrReembedSourceChanged
	}
	data := s.dataLocked(run.TargetGenerationID)
	sources, windows, sourceNodes := exactSourceCounts(data, run.ProjectID)
	nodes := sourceNodes + len(corpus)
	complete := 0
	for _, checkpoint := range s.checkpoints[runID] {
		if checkpoint.Status != "complete" {
			continue
		}
		source, found := sourceByOriginLocked(data, run.ProjectID, checkpoint.SourceType, checkpoint.SourceID)
		if !found || source.Revision != checkpoint.Revision || source.ContentHash != checkpoint.ContentHash {
			return ReembedRun{}, ErrReembedIncomplete
		}
		complete++
	}
	if complete != sources || run.SourcesCompleted != sources {
		return ReembedRun{}, ErrReembedIncomplete
	}
	if !validation.Complete || validation.SpaceIdentity != run.TargetSpace.Identity() ||
		validation.SourceWatermark != sourceWatermark ||
		validation.SourceCount != sources || validation.WindowCount != windows ||
		validation.NodeCount != nodes || validation.ArtifactCount != windows+nodes ||
		(sources > 0 && validation.ProbeCount <= 0) {
		return ReembedRun{}, ErrReembedValidationFailed
	}
	if run.Policy.MaxVectors > 0 && validation.ArtifactCount > run.Policy.MaxVectors {
		return ReembedRun{}, ArtifactLimitExceeded(run.ProjectID, int64(run.Policy.MaxVectors), int64(validation.ArtifactCount))
	}
	dirty := data.corpus[run.ProjectID].dirty
	rebuildCorpusLocked(data, run.ProjectID, corpus, dirty, indexes)
	run.Status = ReembedReady
	run.CaughtUpCursor = sourceWatermark
	run.SourcesTotal = run.SourcesCompleted + run.SourcesSkipped
	run.Validation = validation
	run.UpdatedAt = at
	s.runs[runID] = run
	generation := s.generations[run.TargetGenerationID]
	generation.State = GenerationReady
	generation.SourceWatermark = sourceWatermark
	generation.SourceCount = sources
	generation.ArtifactCount = windows + nodes
	generation.Validation = validation
	s.generations[generation.ID] = generation
	return run, nil
}

func (s *MemoryStore) FailReembed(runID string, code, detail string, at time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	run, ok := s.runs[runID]
	if !ok {
		return ErrReembedNotFound
	}
	if run.Status == ReembedPromoted || run.Status == ReembedRolledBack {
		return ErrGenerationConflict
	}
	run.Status = ReembedFailed
	run.LastErrorCode = code
	run.LastError = detail
	run.UpdatedAt = at
	s.runs[runID] = run
	generation := s.generations[run.TargetGenerationID]
	generation.State = GenerationFailed
	s.generations[generation.ID] = generation
	return nil
}

func (s *MemoryStore) PromoteReembed(projectID, runID, actorID string, expectedRevision int64, rollbackUntil, at time.Time) (ProjectLatticeState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	run, ok := s.runs[runID]
	if !ok || run.ProjectID != projectID {
		return ProjectLatticeState{}, ErrReembedNotFound
	}
	key := memoryLatticeKey{projectID, run.Kind}
	state, ok := s.states[key]
	if !ok || state.Revision != expectedRevision || run.ExpectedRevision != expectedRevision {
		return ProjectLatticeState{}, ErrGenerationConflict
	}
	if run.Status != ReembedReady || !run.Validation.Complete {
		return ProjectLatticeState{}, ErrReembedIncomplete
	}
	if state.SourceCursor != run.CaughtUpCursor || run.Validation.SourceWatermark != state.SourceCursor {
		return ProjectLatticeState{}, ErrReembedSourceChanged
	}
	target := s.generations[run.TargetGenerationID]
	if target.State != GenerationReady || target.SourceWatermark != state.SourceCursor {
		return ProjectLatticeState{}, ErrReembedValidationFailed
	}
	previous := s.generations[state.ActiveGenerationID]
	if previous.ID != "" {
		previous.State = GenerationRetired
		previous.RetiredAt = timePointer(at)
		previous.RollbackExpiresAt = timePointer(rollbackUntil)
		s.generations[previous.ID] = previous
	}
	target.State = GenerationActive
	target.PromotedAt = timePointer(at)
	target.RetiredAt = nil
	target.RollbackExpiresAt = nil
	s.generations[target.ID] = target
	state.PreviousGenerationID = state.ActiveGenerationID
	state.ActiveGenerationID = target.ID
	state.Revision++
	state.UpdatedAt = at
	s.states[key] = state
	run.Status = ReembedPromoted
	run.UpdatedAt = at
	s.runs[runID] = run
	s.appendGenerationEventLocked(GenerationEvent{
		ID: newID(), ProjectID: projectID, Kind: run.Kind, GenerationID: target.ID,
		Type: "promoted", ActorID: actorID, StateRevision: state.Revision, OccurredAt: at,
	})
	return state, nil
}

func (s *MemoryStore) RollbackGeneration(projectID string, kind LatticeKind, actorID string, expectedRevision int64, at time.Time) (ProjectLatticeState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := memoryLatticeKey{projectID, kind}
	state, ok := s.states[key]
	if !ok || state.Revision != expectedRevision || state.PreviousGenerationID == "" {
		return ProjectLatticeState{}, ErrGenerationConflict
	}
	previous := s.generations[state.PreviousGenerationID]
	if previous.State != GenerationRetired || previous.RollbackExpiresAt == nil {
		return ProjectLatticeState{}, ErrGenerationConflict
	}
	if !at.Before(*previous.RollbackExpiresAt) {
		return ProjectLatticeState{}, ErrRollbackExpired
	}
	if previous.SourceWatermark != state.SourceCursor {
		return ProjectLatticeState{}, ErrReembedSourceChanged
	}
	current := s.generations[state.ActiveGenerationID]
	current.State = GenerationRetired
	current.RetiredAt = timePointer(at)
	current.RollbackExpiresAt = nil
	s.generations[current.ID] = current
	previous.State = GenerationActive
	previous.PromotedAt = timePointer(at)
	previous.RetiredAt = nil
	previous.RollbackExpiresAt = nil
	s.generations[previous.ID] = previous
	state.ActiveGenerationID, state.PreviousGenerationID = previous.ID, current.ID
	state.Revision++
	state.UpdatedAt = at
	s.states[key] = state
	for id, run := range s.runs {
		if run.ProjectID == projectID && run.Kind == kind && run.TargetGenerationID == current.ID &&
			run.Status == ReembedPromoted {
			run.Status = ReembedRolledBack
			run.UpdatedAt = at
			s.runs[id] = run
		}
	}
	s.appendGenerationEventLocked(GenerationEvent{
		ID: newID(), ProjectID: projectID, Kind: kind, GenerationID: previous.ID,
		Type: "rolled_back", ActorID: actorID, StateRevision: state.Revision, OccurredAt: at,
	})
	return state, nil
}

func (s *MemoryStore) GenerationEvents(projectID string, after int64, limit int) ([]GenerationEvent, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []GenerationEvent
	for _, event := range s.events[projectID] {
		if event.Sequence <= after {
			continue
		}
		out = append(out, event)
		if limit > 0 && len(out) == limit {
			break
		}
	}
	return out, nil
}

// --- locked artifact mechanics ---

func sourceByOriginLocked(d *memoryArtifacts, projectID, sourceType, sourceID string) (Source, bool) {
	for _, source := range d.sources {
		if source.ProjectID == projectID && source.SourceType == sourceType && source.SourceID == sourceID {
			return source, true
		}
	}
	return Source{}, false
}

func sourcesUnderLocked(d *memoryArtifacts, projectID, sourceType, prefix string) []Origin {
	var out []Origin
	for _, source := range d.sources {
		if source.ProjectID == projectID && source.SourceType == sourceType && strings.HasPrefix(source.SourceID, prefix) {
			out = append(out, Origin{SourceType: source.SourceType, SourceID: source.SourceID, Label: source.Label})
		}
	}
	return out
}

func sourcesLocked(d *memoryArtifacts, projectID string) []Source {
	var out []Source
	for _, source := range d.sources {
		if source.ProjectID == projectID {
			out = append(out, source)
		}
	}
	return out
}

func replaceSourcesLocked(d *memoryArtifacts, writes []SourceWrite) error {
	if len(writes) == 0 {
		return nil
	}
	projectID := writes[0].Source.ProjectID
	for _, write := range writes {
		if write.Source.ProjectID != projectID {
			return errors.New("knowledge: one admission cannot span Projects")
		}
		ref := write.Source.LocalRefID
		d.sources = filterSources(d.sources, func(source Source) bool { return source.LocalRefID != ref })
		d.windows = filterWindows(d.windows, func(window Window) bool { return window.LocalRefID != ref })
		d.nodes = filterNodes(d.nodes, func(node Node) bool { return node.LocalRefID != ref })
		d.sources = append(d.sources, write.Source)
		d.windows = append(d.windows, write.Windows...)
		d.nodes = append(d.nodes, write.Nodes...)
	}
	invalidateCorpusLocked(d, projectID)
	return nil
}

func admitAndReplaceSourcesLocked(d *memoryArtifacts, maxArtifacts int, writes []SourceWrite) (ArtifactCounts, error) {
	if len(writes) == 0 {
		return ArtifactCounts{}, nil
	}
	projectID := writes[0].Source.ProjectID
	for _, write := range writes {
		if write.Source.ProjectID != projectID {
			return ArtifactCounts{}, errors.New("knowledge: one admission cannot span Projects")
		}
	}
	counts := sourceArtifactCountsLocked(d, projectID)
	var out ArtifactCounts
	for _, count := range counts {
		out.Current += count
	}
	replacing := map[string]bool{}
	for _, write := range writes {
		if !replacing[write.Source.LocalRefID] {
			out.Replaced += counts[write.Source.LocalRefID]
			replacing[write.Source.LocalRefID] = true
		}
		out.Candidate += int64(len(write.Windows) + len(write.Nodes))
	}
	out.Total = out.Current - out.Replaced + out.Candidate
	if maxArtifacts > 0 && out.Total > int64(maxArtifacts) {
		return out, ArtifactLimitExceeded(projectID, int64(maxArtifacts), out.Total)
	}
	return out, replaceSourcesLocked(d, writes)
}

func deleteSourceLocked(d *memoryArtifacts, projectID, sourceType, sourceID string) (bool, error) {
	source, found := sourceByOriginLocked(d, projectID, sourceType, sourceID)
	if !found {
		return false, nil
	}
	ref := source.LocalRefID
	d.sources = filterSources(d.sources, func(candidate Source) bool { return candidate.LocalRefID != ref })
	d.windows = filterWindows(d.windows, func(window Window) bool { return window.LocalRefID != ref })
	d.nodes = filterNodes(d.nodes, func(node Node) bool { return node.LocalRefID != ref })
	invalidateCorpusLocked(d, projectID)
	return true, nil
}

func invalidateCorpusLocked(d *memoryArtifacts, projectID string) {
	d.nodes = filterNodes(d.nodes, func(node Node) bool {
		return !(node.ProjectID == projectID && node.LocalRefID == "")
	})
	if d.corpus == nil {
		d.corpus = map[string]corpusSeq{}
	}
	corpus := d.corpus[projectID]
	corpus.dirty++
	d.corpus[projectID] = corpus
}

func sourceFrontierLocked(d *memoryArtifacts, projectID string) []FrontierEntry {
	var projectNodes []Node
	var projectWindows []Window
	refs := map[string]bool{}
	for _, source := range d.sources {
		if source.ProjectID == projectID {
			refs[source.LocalRefID] = true
		}
	}
	for _, node := range d.nodes {
		if node.ProjectID == projectID {
			projectNodes = append(projectNodes, node)
		}
	}
	for _, window := range d.windows {
		if refs[window.LocalRefID] {
			projectWindows = append(projectWindows, window)
		}
	}
	return sourceFrontier(projectNodes, projectWindows)
}

func rebuildCorpusLocked(d *memoryArtifacts, projectID string, corpus []Node, seq int64, indexes []CorpusLevelIndex) {
	d.nodes = filterNodes(d.nodes, func(node Node) bool {
		return !(node.ProjectID == projectID && node.LocalRefID == "")
	})
	d.nodes = append(d.nodes, corpus...)
	if d.corpus == nil {
		d.corpus = map[string]corpusSeq{}
	}
	state := d.corpus[projectID]
	state.built = seq
	d.corpus[projectID] = state
	if d.indexes == nil {
		d.indexes = map[string][]CorpusLevelIndex{}
	}
	if len(indexes) == 0 {
		delete(d.indexes, projectID)
	} else {
		d.indexes[projectID] = cloneIndexes(indexes)
	}
}

func admitCorpusLocked(d *memoryArtifacts, projectID string, maxArtifacts int, corpus []Node, seq int64, indexes []CorpusLevelIndex) (ArtifactCounts, error) {
	counts := sourceArtifactCountsLocked(d, projectID)
	var out ArtifactCounts
	for _, count := range counts {
		out.Current += count
	}
	out.Candidate = int64(len(corpus))
	out.Total = out.Current + out.Candidate
	if maxArtifacts > 0 && out.Total > int64(maxArtifacts) {
		return out, ArtifactLimitExceeded(projectID, int64(maxArtifacts), out.Total)
	}
	rebuildCorpusLocked(d, projectID, corpus, seq, indexes)
	return out, nil
}

func artifactCountsLocked(d *memoryArtifacts, projectID string) map[string]int {
	refs := map[string]bool{}
	for _, source := range d.sources {
		if source.ProjectID == projectID {
			refs[source.LocalRefID] = true
		}
	}
	out := map[string]int{}
	for _, window := range d.windows {
		if refs[window.LocalRefID] {
			out[window.LocalRefID]++
		}
	}
	for _, node := range d.nodes {
		if node.ProjectID == projectID {
			out[node.LocalRefID]++
		}
	}
	return out
}

func sourceArtifactCountsLocked(d *memoryArtifacts, projectID string) map[string]int64 {
	refs := map[string]bool{}
	for _, source := range d.sources {
		if source.ProjectID == projectID {
			refs[source.LocalRefID] = true
		}
	}
	out := map[string]int64{}
	for _, window := range d.windows {
		if refs[window.LocalRefID] {
			out[window.LocalRefID]++
		}
	}
	for _, node := range d.nodes {
		if node.ProjectID == projectID && node.LocalRefID != "" && refs[node.LocalRefID] {
			out[node.LocalRefID]++
		}
	}
	return out
}

func identitiesLocked(d *memoryArtifacts, projectID string) map[string]VectorIdentity {
	out := map[string]VectorIdentity{}
	for _, source := range d.sources {
		if source.ProjectID == projectID {
			out[source.LocalRefID] = source.Identity
		}
	}
	return out
}

func entryFrontierLocked(d *memoryArtifacts, projectID string) []FrontierEntry {
	refs := map[string]bool{}
	for _, source := range d.sources {
		if source.ProjectID == projectID {
			refs[source.LocalRefID] = true
		}
	}
	members := map[string]bool{}
	for _, node := range d.nodes {
		if node.ProjectID == projectID {
			for _, member := range node.MemberIDs {
				members[member] = true
			}
		}
	}
	var out []FrontierEntry
	for _, node := range d.nodes {
		if node.ProjectID == projectID && !members[node.ID] {
			out = append(out, FrontierEntry{ID: node.ID, Vector: node.Centroid})
		}
	}
	for _, window := range d.windows {
		if refs[window.LocalRefID] && !members[window.ID] {
			out = append(out, FrontierEntry{ID: window.ID, Vector: window.Embedding, IsWindow: true})
		}
	}
	return out
}

func corpusIndexHeaderLocked(d *memoryArtifacts, projectID string, level int) (CorpusLevelIndex, bool, error) {
	for _, index := range d.indexes[projectID] {
		if index.Level == level {
			header := index
			header.Artifacts = nil
			return header, true, nil
		}
	}
	return CorpusLevelIndex{}, false, nil
}

func entryFrontierProbedLocked(d *memoryArtifacts, projectID string, level int, cells []int) []FrontierEntry {
	probe := map[int]bool{}
	for _, cell := range cells {
		probe[cell] = true
	}
	cellOf := map[string]int{}
	for _, index := range d.indexes[projectID] {
		if index.Level == level {
			for _, artifact := range index.Artifacts {
				cellOf[artifact.ID] = artifact.Cell
			}
		}
	}
	var out []FrontierEntry
	for _, frontier := range entryFrontierLocked(d, projectID) {
		if cell, covered := cellOf[frontier.ID]; covered && !probe[cell] {
			continue
		}
		out = append(out, frontier)
	}
	return out
}

func nodesByIDLocked(data []*memoryArtifacts, ids []string) []Node {
	want := stringSet(ids)
	var out []Node
	seen := map[string]bool{}
	for _, d := range data {
		for _, node := range d.nodes {
			if want[node.ID] && !seen[node.ID] {
				out = append(out, node)
				seen[node.ID] = true
			}
		}
	}
	return out
}

func windowsByIDLocked(data []*memoryArtifacts, ids []string) []Window {
	want := stringSet(ids)
	var out []Window
	seen := map[string]bool{}
	for _, d := range data {
		for _, window := range d.windows {
			if want[window.ID] && !seen[window.ID] {
				out = append(out, window)
				seen[window.ID] = true
			}
		}
	}
	return out
}

func windowContentLocked(data []*memoryArtifacts, ids []string) map[string]WindowContent {
	want := stringSet(ids)
	out := make(map[string]WindowContent, len(ids))
	for _, d := range data {
		for _, window := range d.windows {
			if want[window.ID] {
				out[window.ID] = WindowContent{Text: window.Text, Blocks: window.Blocks}
			}
		}
	}
	return out
}

func projectWindowsLocked(d *memoryArtifacts, projectID string) []Window {
	refs := map[string]bool{}
	for _, source := range d.sources {
		if source.ProjectID == projectID {
			refs[source.LocalRefID] = true
		}
	}
	var out []Window
	for _, window := range d.windows {
		if refs[window.LocalRefID] {
			out = append(out, window)
		}
	}
	return out
}

func sourceWindowsLocked(data []*memoryArtifacts, localRefID string) []Window {
	var out []Window
	seen := map[string]bool{}
	for _, d := range data {
		for _, window := range d.windows {
			if window.LocalRefID == localRefID && !seen[window.ID] {
				out = append(out, window)
				seen[window.ID] = true
			}
		}
	}
	return out
}

func sourcesByRefLocked(data []*memoryArtifacts, refs []string) map[string]Source {
	want := stringSet(refs)
	out := map[string]Source{}
	for _, d := range data {
		for _, source := range d.sources {
			if want[source.LocalRefID] {
				out[source.LocalRefID] = source
			}
		}
	}
	return out
}

func exactGenerationCounts(d *memoryArtifacts, projectID string) (sources, windows, nodes int) {
	refs := map[string]bool{}
	for _, source := range d.sources {
		if source.ProjectID == projectID {
			sources++
			refs[source.LocalRefID] = true
		}
	}
	for _, window := range d.windows {
		if refs[window.LocalRefID] {
			windows++
		}
	}
	for _, node := range d.nodes {
		if node.ProjectID == projectID {
			nodes++
		}
	}
	return
}

func exactSourceCounts(d *memoryArtifacts, projectID string) (sources, windows, nodes int) {
	refs := map[string]bool{}
	for _, source := range d.sources {
		if source.ProjectID == projectID {
			sources++
			refs[source.LocalRefID] = true
		}
	}
	for _, window := range d.windows {
		if refs[window.LocalRefID] {
			windows++
		}
	}
	for _, node := range d.nodes {
		if node.ProjectID == projectID && node.LocalRefID != "" {
			nodes++
		}
	}
	return
}

// --- locked lifecycle helpers ---

func tokenFor(state ProjectLatticeState) ReadToken {
	return ReadToken{
		ProjectID: state.ProjectID, Kind: state.Kind, GenerationID: state.ActiveGenerationID,
		StateRevision: state.Revision, SourceCursor: state.SourceCursor,
	}
}

func (s *MemoryStore) requireCurrentLocked(token ReadToken) (ProjectLatticeState, error) {
	state, ok := s.states[memoryLatticeKey{token.ProjectID, token.Kind}]
	// Ordinary writers CAS the identity of the active generation and the pointer
	// revision, then serialize under the store transaction/mutex and allocate the
	// next source cursor. Requiring cursor equality here would reject the second
	// of two otherwise independent writes instead of recomputing exact admission
	// against the first one's committed artifacts. Retrieval's Current method
	// deliberately remains stricter and compares the whole token.
	if !ok || token.GenerationID != state.ActiveGenerationID || token.StateRevision != state.Revision {
		return ProjectLatticeState{}, ErrGenerationConflict
	}
	return state, nil
}

func (s *MemoryStore) appendSourceChangeLocked(key memoryLatticeKey, change SourceChange) {
	if s.changes == nil {
		s.changes = map[memoryLatticeKey][]SourceChange{}
	}
	s.changes[key] = append(s.changes[key], change)
}

func (s *MemoryStore) refreshGenerationCountsLocked(generationID string, watermark int64) {
	generation, ok := s.generations[generationID]
	if !ok {
		return
	}
	sources, windows, nodes := exactGenerationCounts(s.dataLocked(generationID), generation.ProjectID)
	generation.SourceWatermark = watermark
	generation.SourceCount = sources
	generation.ArtifactCount = windows + nodes
	s.generations[generationID] = generation
}

func (s *MemoryStore) appendGenerationEventLocked(event GenerationEvent) {
	if s.events == nil {
		s.events = map[string][]GenerationEvent{}
	}
	s.eventSequence++
	event.Sequence = s.eventSequence
	s.events[event.ProjectID] = append(s.events[event.ProjectID], event)
}

func sourceCheckpointKey(sourceType, sourceID string) string {
	return sourceType + "\x00" + sourceID
}

func addCheckpointTotals(run *ReembedRun, checkpoint ReembedCheckpoint) {
	if checkpoint.Status == "complete" {
		run.SourcesCompleted++
	}
	if checkpoint.Status == "skipped" {
		run.SourcesSkipped++
	}
	run.BytesRead += checkpoint.BytesRead
	run.Vectors += checkpoint.Vectors
	run.Usage.PromptTokens += checkpoint.Usage.PromptTokens
	run.Usage.TotalTokens += checkpoint.Usage.TotalTokens
	run.Usage.Requests += checkpoint.Usage.Requests
	run.Usage.CostUSD += checkpoint.Usage.CostUSD
}

func removeCheckpointTotals(run *ReembedRun, checkpoint ReembedCheckpoint) {
	if checkpoint.Status == "complete" {
		run.SourcesCompleted--
	}
	if checkpoint.Status == "skipped" {
		run.SourcesSkipped--
	}
	run.BytesRead -= checkpoint.BytesRead
	run.Vectors -= checkpoint.Vectors
	run.Usage.PromptTokens -= checkpoint.Usage.PromptTokens
	run.Usage.TotalTokens -= checkpoint.Usage.TotalTokens
	run.Usage.Requests -= checkpoint.Usage.Requests
	run.Usage.CostUSD -= checkpoint.Usage.CostUSD
}

func reembedTerminal(status ReembedStatus) bool {
	switch status {
	case ReembedCancelled, ReembedReady, ReembedPromoted, ReembedRolledBack, ReembedFailed:
		return true
	default:
		return false
	}
}

func timePointer(at time.Time) *time.Time {
	value := at
	return &value
}

func cloneIndexes(in []CorpusLevelIndex) []CorpusLevelIndex {
	return append([]CorpusLevelIndex(nil), in...)
}

func stringSet(values []string) map[string]bool {
	out := make(map[string]bool, len(values))
	for _, value := range values {
		out[value] = true
	}
	return out
}

func filterSources(in []Source, keep func(Source) bool) []Source {
	out := in[:0:0]
	for _, value := range in {
		if keep(value) {
			out = append(out, value)
		}
	}
	return out
}

func filterWindows(in []Window, keep func(Window) bool) []Window {
	out := in[:0:0]
	for _, value := range in {
		if keep(value) {
			out = append(out, value)
		}
	}
	return out
}

func filterNodes(in []Node, keep func(Node) bool) []Node {
	out := in[:0:0]
	for _, value := range in {
		if keep(value) {
			out = append(out, value)
		}
	}
	return out
}

var _ GenerationStore = (*MemoryStore)(nil)
var _ ArtifactStore = (*MemoryStore)(nil)
var _ ArtifactStore = (*memoryArtifactView)(nil)
