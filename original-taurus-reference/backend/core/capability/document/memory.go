package document

import (
	"sort"
	"sync"
	"time"
)

// MemoryStore is an in-memory implementation of Store, used in tests. It is safe
// for concurrent use.
type MemoryStore struct {
	mu          sync.Mutex
	docs        map[string]Document
	changesets  map[string][]ChangeSet // by document ID, in Seq order
	submissions map[string]map[string]ChangeSet
	history     map[string][]HistoryEntry
	anchors     map[string][]DocumentAnchor // by document ID
	activity    []ActivityFact
}

// NewMemoryStore returns an empty in-memory document store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		docs:        make(map[string]Document),
		changesets:  make(map[string][]ChangeSet),
		submissions: make(map[string]map[string]ChangeSet),
		history:     make(map[string][]HistoryEntry),
		anchors:     make(map[string][]DocumentAnchor),
	}
}

func (s *MemoryStore) CreateDocument(d Document, fact ActivityFact) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.docs[d.ID] = d
	s.activity = append(s.activity, fact)
	return nil
}

func (s *MemoryStore) DocumentByID(projectID, id string) (Document, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	d, ok := s.docs[id]
	if !ok || d.ProjectID != projectID {
		return Document{}, ErrNotFound
	}
	d.Base = cloneStoredBase(d.Base)
	return d, nil
}

func (s *MemoryStore) DocumentsByProject(projectID string) ([]Document, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Document
	for _, d := range s.docs {
		if d.ProjectID == projectID && d.Lifecycle == LifecycleActive {
			d.Base = cloneStoredBase(d.Base)
			out = append(out, d)
		}
	}
	return out, nil
}

func (s *MemoryStore) DocumentSummaries(projectID string, before *SummaryBoundary, limit int) ([]Summary, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Summary
	for _, d := range s.docs {
		if d.ProjectID != projectID {
			continue
		}
		if before != nil {
			afterBoundary := d.UpdatedAt.Before(before.UpdatedAt)
			if !before.SkipEqualTime {
				afterBoundary = afterBoundary || (d.UpdatedAt.Equal(before.UpdatedAt) && d.ID > before.ID)
			}
			if !afterBoundary {
				continue
			}
		}
		out = append(out, Summary{ID: d.ID, Name: d.Name, CreatorID: d.CreatorID, CreatorName: d.CreatorName, CreatedAt: d.CreatedAt, UpdatedAt: d.UpdatedAt})
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].UpdatedAt.Equal(out[j].UpdatedAt) {
			return out[i].UpdatedAt.After(out[j].UpdatedAt)
		}
		return out[i].ID < out[j].ID
	})
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func (s *MemoryStore) RenameDocument(id, name string, updatedAt time.Time, fact ActivityFact) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	doc, ok := s.docs[id]
	if !ok {
		return ErrNotFound
	}
	doc.Name = name
	doc.UpdatedAt = updatedAt
	s.docs[id] = doc
	s.activity = append(s.activity, fact)
	return nil
}

func (s *MemoryStore) DeleteDocument(id string, fact ActivityFact) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.docs[id]; !ok {
		return ErrNotFound
	}
	delete(s.docs, id)
	delete(s.changesets, id)
	delete(s.submissions, id)
	delete(s.history, id)
	s.activity = append(s.activity, fact)
	return nil
}

func (s *MemoryStore) SetLifecycle(id, lifecycle string, trashedAt time.Time, updatedAt time.Time, fact ActivityFact) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	doc, ok := s.docs[id]
	if !ok {
		return ErrNotFound
	}
	doc.Lifecycle = lifecycle
	doc.TrashedAt = trashedAt
	doc.UpdatedAt = updatedAt
	s.docs[id] = doc
	s.activity = append(s.activity, fact)
	return nil
}

func (s *MemoryStore) TrashedDocumentsOlderThan(before time.Time) ([]Document, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Document
	for _, d := range s.docs {
		if d.Lifecycle == LifecycleTrashed && !d.TrashedAt.IsZero() && d.TrashedAt.Before(before) {
			out = append(out, d)
		}
	}
	return out, nil
}

func (s *MemoryStore) AppendChangeSet(cs ChangeSet, expectedRevision int64, fact ActivityFact) (ChangeSet, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	doc, ok := s.docs[cs.DocumentID]
	if !ok {
		return ChangeSet{}, ErrNotFound
	}
	if cs.SubmissionID != "" {
		if existing, ok := s.submissions[cs.DocumentID][submissionKey(cs.AuthorID, cs.SubmissionID)]; ok {
			if existing.SubmissionHash != cs.SubmissionHash {
				return ChangeSet{}, ErrSubmissionConflict
			}
			return cloneChangeSet(existing), nil
		}
	}
	if doc.Revision != expectedRevision {
		return ChangeSet{}, ErrRevisionConflict
	}
	cs.PriorRevision = expectedRevision
	cs.Seq = expectedRevision + 1
	stored := cloneChangeSet(cs)
	s.changesets[cs.DocumentID] = append(s.changesets[cs.DocumentID], stored)
	s.history[cs.DocumentID] = append(s.history[cs.DocumentID], HistoryEntryForChangeSet(stored))
	if cs.SubmissionID != "" {
		if s.submissions[cs.DocumentID] == nil {
			s.submissions[cs.DocumentID] = make(map[string]ChangeSet)
		}
		s.submissions[cs.DocumentID][submissionKey(cs.AuthorID, cs.SubmissionID)] = stored
	}
	doc.UpdatedAt = cs.CreatedAt
	doc.Revision = cs.Seq
	s.docs[cs.DocumentID] = doc
	s.activity = append(s.activity, fact)
	return cloneChangeSet(stored), nil
}

// ActivityFacts returns a copy of the semantic facts committed by this store.
func (s *MemoryStore) ActivityFacts() []ActivityFact {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]ActivityFact(nil), s.activity...)
}

func (s *MemoryStore) ChangeSetsSince(documentID string, afterSeq int64) ([]ChangeSet, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []ChangeSet
	for _, cs := range s.changesets[documentID] {
		if cs.Seq > afterSeq {
			out = append(out, cloneChangeSet(cs))
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Seq < out[j].Seq })
	return out, nil
}

func (s *MemoryStore) ChangeSetByID(documentID, changeSetID string) (ChangeSet, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, cs := range s.changesets[documentID] {
		if cs.ID == changeSetID {
			return cloneChangeSet(cs), nil
		}
	}
	return ChangeSet{}, ErrChangeSetNotFound
}

func (s *MemoryStore) ChangeSetBySubmission(documentID, authorID, submissionID string) (ChangeSet, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if cs, ok := s.submissions[documentID][submissionKey(authorID, submissionID)]; ok {
		return cloneChangeSet(cs), nil
	}
	return ChangeSet{}, ErrChangeSetNotFound
}

func submissionKey(authorID, submissionID string) string {
	return authorID + "\x00" + submissionID
}

func (s *MemoryStore) ListChangeSetHistory(documentID string, beforeRevision int64, limit int) ([]HistoryEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.docs[documentID]; !ok {
		return nil, ErrNotFound
	}
	var out []HistoryEntry
	for i := len(s.history[documentID]) - 1; i >= 0 && len(out) < limit; i-- {
		entry := cloneHistoryEntry(s.history[documentID][i])
		if beforeRevision > 0 && entry.Revision >= beforeRevision {
			continue
		}
		entry.DetailAvailable = false
		entry.HasInverse = false
		for _, cs := range s.changesets[documentID] {
			if cs.ID == entry.ID {
				entry.DetailAvailable = true
				entry.HasInverse = len(cs.InverseOps) > 0
				break
			}
		}
		out = append(out, entry)
	}
	return out, nil
}

func (s *MemoryStore) PruneChangeSets(documentID string, keep int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	doc, ok := s.docs[documentID]
	if !ok {
		return ErrNotFound
	}
	// Pending detail reconstructs the current document. Of the folded detail,
	// only the current head is an eligible undo/redo recipe.
	var detailed []ChangeSet
	for _, cs := range s.changesets[documentID] {
		if cs.Seq > doc.BaseSeq || cs.Seq == doc.Revision {
			detailed = append(detailed, cs)
		}
	}
	sort.Slice(detailed, func(i, j int) bool { return detailed[i].Seq < detailed[j].Seq })
	s.changesets[documentID] = detailed

	history := s.history[documentID]
	if keep < len(history) {
		history = history[len(history)-keep:]
	}
	s.history[documentID] = history
	return nil
}

func (s *MemoryStore) RebaseDocument(documentID string, base Base, baseSeq int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	doc, ok := s.docs[documentID]
	if !ok {
		return ErrNotFound
	}
	// Only advance the watermark; a stale or duplicate rebase is a no-op, matching
	// the SQLite store's guarded update.
	if baseSeq <= doc.BaseSeq {
		return nil
	}
	doc.Base = base
	doc.BaseSeq = baseSeq
	s.docs[documentID] = doc
	return nil
}

func (s *MemoryStore) CreateAnchor(docID string, a DocumentAnchor) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.anchors[docID] = append(s.anchors[docID], a)
	return nil
}

func (s *MemoryStore) ListAnchors(docID string) ([]DocumentAnchor, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	list := s.anchors[docID]
	if list == nil {
		return []DocumentAnchor{}, nil
	}
	return append([]DocumentAnchor(nil), list...), nil
}

func (s *MemoryStore) DeleteAnchor(docID, anchorID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	list := s.anchors[docID]
	for i, a := range list {
		if a.ID == anchorID {
			s.anchors[docID] = append(list[:i], list[i+1:]...)
			return nil
		}
	}
	return nil
}

func (s *MemoryStore) UpdateAnchor(docID string, a DocumentAnchor) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	list := s.anchors[docID]
	for i, existing := range list {
		if existing.ID == a.ID {
			list[i] = a
			return nil
		}
	}
	return nil
}
