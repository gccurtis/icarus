package comment

import (
	"sort"
	"sync"
)

// MemoryStore is an in-memory Store for tests and single-process runs. Comments
// and replies are kept in insertion order per their parent.
type MemoryStore struct {
	mu       sync.Mutex
	comments map[string]Comment
	order    []string           // comment ids in creation order
	replies  map[string][]Reply // commentID -> replies in creation order
}

// NewMemoryStore returns an empty in-memory Store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{comments: map[string]Comment{}, replies: map[string][]Reply{}}
}

func (s *MemoryStore) CreateComment(c Comment) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.comments[c.ID] = c
	s.order = append(s.order, c.ID)
	return nil
}

func (s *MemoryStore) CommentByID(projectID, id string) (Comment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.comments[id]
	if !ok || c.ProjectID != projectID {
		return Comment{}, ErrNotFound
	}
	return c, nil
}

func (s *MemoryStore) CommentsByDocument(projectID, documentID string, resolved *bool) ([]Comment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Comment
	for _, id := range s.order {
		c := s.comments[id]
		if c.ProjectID != projectID || c.DocumentID != documentID {
			continue
		}
		if resolved != nil && c.Resolved != *resolved {
			continue
		}
		out = append(out, c)
	}
	return out, nil
}

func (s *MemoryStore) UpdateComment(c Comment) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.comments[c.ID]; !ok {
		return ErrNotFound
	}
	s.comments[c.ID] = c
	return nil
}

func (s *MemoryStore) DeleteComment(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.comments, id)
	delete(s.replies, id)
	kept := s.order[:0:0]
	for _, existing := range s.order {
		if existing != id {
			kept = append(kept, existing)
		}
	}
	s.order = kept
	return nil
}

func (s *MemoryStore) AddReply(r Reply) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.replies[r.CommentID] = append(s.replies[r.CommentID], r)
	return nil
}

func (s *MemoryStore) RepliesByComment(commentID string) ([]Reply, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.threadLocked(commentID), nil
}

// RepliesByComments is the batched form used by comment listing: it returns the
// same thread RepliesByComment would for each id, keyed by comment, and omits
// comments that have none.
func (s *MemoryStore) RepliesByComments(commentIDs []string) (map[string][]Reply, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make(map[string][]Reply, len(commentIDs))
	for _, id := range commentIDs {
		if thread := s.threadLocked(id); len(thread) > 0 {
			out[id] = thread
		}
	}
	return out, nil
}

// threadLocked returns a copy of one comment's replies, oldest first. The caller
// holds s.mu.
func (s *MemoryStore) threadLocked(commentID string) []Reply {
	replies := append([]Reply(nil), s.replies[commentID]...)
	sort.SliceStable(replies, func(i, j int) bool { return replies[i].CreatedAt.Before(replies[j].CreatedAt) })
	return replies
}
