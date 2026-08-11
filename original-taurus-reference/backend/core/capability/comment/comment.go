// Package comment owns project-scoped, anchor-bound discussion on documents: a
// Comment is pinned to a document anchor and carries an ordered thread of
// Replies. Anchors live in the document capability, so this package reaches them
// only through an injected AnchorReader port and never imports document.
package comment

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"
)

// Scope is trusted application context set after access selects a Project.
type Scope struct{ ProjectID string }

var (
	ErrNotFound      = errors.New("comment: not found")
	ErrInvalid       = errors.New("comment: invalid request")
	ErrInvalidScope  = errors.New("comment: Project scope is required")
	ErrAnchorMissing = errors.New("comment: an anchor is required")
	// ErrAnchorNotFound is returned by an AnchorReader when the target anchor does
	// not exist (as opposed to an infrastructure failure). At read time it means
	// the thread is orphaned; at create time it means the request is invalid.
	ErrAnchorNotFound = errors.New("comment: anchor not found")
)

// Reply is one message in a comment's thread.
type Reply struct {
	ID         string    `json:"id"`
	CommentID  string    `json:"commentId"`
	ProjectID  string    `json:"projectId"`
	AuthorID   string    `json:"authorId"`
	AuthorName string    `json:"authorName"`
	Body       string    `json:"body"`
	CreatedAt  time.Time `json:"createdAt"`
}

// Comment is an anchor-bound note on a document. AnchorOrphaned is resolved at
// read time from the AnchorReader — true when the anchored target no longer
// exists — so the client can flag stranded threads.
type Comment struct {
	ID             string    `json:"id"`
	ProjectID      string    `json:"projectId"`
	DocumentID     string    `json:"documentId"`
	AnchorID       string    `json:"anchorId"`
	AuthorID       string    `json:"authorId"`
	AuthorName     string    `json:"authorName"`
	Body           string    `json:"body"`
	Resolved       bool      `json:"resolved"`
	AnchorOrphaned bool      `json:"anchorOrphaned"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
	Replies        []Reply   `json:"replies"`
}

// AnchorRef selects a target inside a document for an inline anchor a comment
// creates on the fly. Start/End are UTF-8 byte offsets into AtomID's text (both
// zero pins the whole block).
type AnchorRef struct {
	RowID   string
	BlockID string
	AtomID  string
	Start   int
	End     int
}

// AnchorSelector points a new comment at its target: an existing anchor by id,
// or an inline target the service materializes into one.
type AnchorSelector struct {
	AnchorID string
	Inline   *AnchorRef
}

// AnchorInfo is the AnchorReader's view of a document anchor.
type AnchorInfo struct {
	ID       string
	Orphaned bool
}

// AnchorReader is how comment reaches document anchors without importing
// document: validate that an anchor belongs to a document in the project, and
// create an inline anchor. The composition root supplies it over the document
// capability. AnchorInProject must return ErrAnchorNotFound (not a generic
// error) when the anchor simply does not exist, so the service can tell a missing
// anchor from an infrastructure failure.
type AnchorReader interface {
	AnchorInProject(projectID, documentID, anchorID string) (AnchorInfo, error)
	CreateAnchor(projectID, documentID string, ref AnchorRef) (AnchorInfo, error)
}

// Store persists comments and their replies, keyed by project and document.
type Store interface {
	CreateComment(c Comment) error
	// CommentByID returns one comment scoped to its project: a comment owned by
	// another project is ErrNotFound. load compares ProjectID afterwards anyway —
	// the two checks are deliberately redundant.
	CommentByID(projectID, id string) (Comment, error)
	CommentsByDocument(projectID, documentID string, resolved *bool) ([]Comment, error)
	UpdateComment(c Comment) error
	DeleteComment(id string) error // cascades the comment's replies
	AddReply(r Reply) error
	RepliesByComment(commentID string) ([]Reply, error)
	// RepliesByComments loads several threads at once, keyed by comment id, so
	// listing a document's comments costs one query rather than one per comment.
	// Comments with no replies may be absent from the map.
	RepliesByComments(commentIDs []string) (map[string][]Reply, error)
}

// Comments is the anchored-comment service.
type Comments struct {
	store   Store
	anchors AnchorReader
	now     func() time.Time
}

// New constructs the service.
func New(store Store, anchors AnchorReader) (*Comments, error) {
	if store == nil || anchors == nil {
		return nil, errors.New("comment: store and anchor reader are required")
	}
	return &Comments{store: store, anchors: anchors, now: time.Now}, nil
}

// Create opens a comment bound to a document anchor — an existing anchor or one
// materialized from an inline target — authored by the requester.
func (c *Comments) Create(scope Scope, documentID, authorID, authorName, body string, sel AnchorSelector) (Comment, error) {
	if strings.TrimSpace(scope.ProjectID) == "" {
		return Comment{}, ErrInvalidScope
	}
	documentID = strings.TrimSpace(documentID)
	body = strings.TrimSpace(body)
	if documentID == "" || body == "" || strings.TrimSpace(authorID) == "" {
		return Comment{}, ErrInvalid
	}
	anchorID, err := c.resolveAnchor(scope.ProjectID, documentID, sel)
	if err != nil {
		return Comment{}, err
	}
	now := c.now().UTC()
	comment := Comment{
		ID:         newID(),
		ProjectID:  scope.ProjectID,
		DocumentID: documentID,
		AnchorID:   anchorID,
		AuthorID:   authorID,
		AuthorName: strings.TrimSpace(authorName),
		Body:       body,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if comment.AuthorName == "" {
		comment.AuthorName = authorID
	}
	if err := c.store.CreateComment(comment); err != nil {
		return Comment{}, err
	}
	comment.Replies = []Reply{}
	return comment, nil
}

func (c *Comments) resolveAnchor(projectID, documentID string, sel AnchorSelector) (string, error) {
	switch {
	case strings.TrimSpace(sel.AnchorID) != "":
		info, err := c.anchors.AnchorInProject(projectID, documentID, strings.TrimSpace(sel.AnchorID))
		switch {
		case errors.Is(err, ErrAnchorNotFound):
			return "", ErrNotFound // the client anchored to something that does not exist
		case err != nil:
			return "", err // infrastructure failure — surface it, do not mask as 404
		}
		return info.ID, nil
	case sel.Inline != nil:
		info, err := c.anchors.CreateAnchor(projectID, documentID, *sel.Inline)
		if err != nil {
			return "", ErrInvalid
		}
		return info.ID, nil
	default:
		return "", ErrAnchorMissing
	}
}

// List returns a document's comments — optionally filtered to open or resolved —
// each with its reply thread loaded and its anchor-orphaned flag resolved.
func (c *Comments) List(scope Scope, documentID string, resolved *bool) ([]Comment, error) {
	if strings.TrimSpace(scope.ProjectID) == "" {
		return nil, ErrInvalidScope
	}
	comments, err := c.store.CommentsByDocument(scope.ProjectID, strings.TrimSpace(documentID), resolved)
	if err != nil {
		return nil, err
	}
	if len(comments) == 0 {
		return comments, nil
	}
	// One batched reply load for the whole page instead of one per comment.
	ids := make([]string, len(comments))
	for i := range comments {
		ids[i] = comments[i].ID
	}
	threads, err := c.store.RepliesByComments(ids)
	if err != nil {
		return nil, err
	}
	for i := range comments {
		if err := c.hydrateWith(&comments[i], threads[comments[i].ID]); err != nil {
			return nil, err
		}
	}
	return comments, nil
}

// Get returns one comment (with replies), scoped to the project.
func (c *Comments) Get(scope Scope, commentID string) (Comment, error) {
	comment, err := c.load(scope, commentID)
	if err != nil {
		return Comment{}, err
	}
	if err := c.hydrate(&comment); err != nil {
		return Comment{}, err
	}
	return comment, nil
}

// Patch updates a comment's body and/or resolved state. Nil fields are left
// unchanged; a normalized no-op still returns the current comment.
func (c *Comments) Patch(scope Scope, commentID string, body *string, resolved *bool) (Comment, error) {
	comment, err := c.load(scope, commentID)
	if err != nil {
		return Comment{}, err
	}
	changed := false
	if body != nil {
		trimmed := strings.TrimSpace(*body)
		if trimmed == "" {
			return Comment{}, ErrInvalid
		}
		if trimmed != comment.Body {
			comment.Body = trimmed
			changed = true
		}
	}
	if resolved != nil && *resolved != comment.Resolved {
		comment.Resolved = *resolved
		changed = true
	}
	if changed {
		comment.UpdatedAt = c.now().UTC()
		if err := c.store.UpdateComment(comment); err != nil {
			return Comment{}, err
		}
	}
	if err := c.hydrate(&comment); err != nil {
		return Comment{}, err
	}
	return comment, nil
}

// Delete removes a comment and its whole reply thread.
func (c *Comments) Delete(scope Scope, commentID string) error {
	comment, err := c.load(scope, commentID)
	if err != nil {
		return err
	}
	return c.store.DeleteComment(comment.ID)
}

// Reply appends a message to a comment's thread.
func (c *Comments) Reply(scope Scope, commentID, authorID, authorName, body string) (Reply, error) {
	comment, err := c.load(scope, commentID)
	if err != nil {
		return Reply{}, err
	}
	body = strings.TrimSpace(body)
	if body == "" || strings.TrimSpace(authorID) == "" {
		return Reply{}, ErrInvalid
	}
	reply := Reply{
		ID:         newID(),
		CommentID:  comment.ID,
		ProjectID:  comment.ProjectID,
		AuthorID:   authorID,
		AuthorName: strings.TrimSpace(authorName),
		Body:       body,
		CreatedAt:  c.now().UTC(),
	}
	if reply.AuthorName == "" {
		reply.AuthorName = authorID
	}
	if err := c.store.AddReply(reply); err != nil {
		return Reply{}, err
	}
	return reply, nil
}

// load fetches a comment and enforces project scope: a comment in another
// project is reported as not found, so a project can neither read nor confirm
// the existence of another project's threads.
func (c *Comments) load(scope Scope, commentID string) (Comment, error) {
	if strings.TrimSpace(scope.ProjectID) == "" {
		return Comment{}, ErrInvalidScope
	}
	comment, err := c.store.CommentByID(strings.TrimSpace(scope.ProjectID), strings.TrimSpace(commentID))
	if err != nil {
		return Comment{}, ErrNotFound
	}
	if comment.ProjectID != scope.ProjectID {
		return Comment{}, ErrNotFound
	}
	return comment, nil
}

// hydrate loads one comment's replies and finishes it. An infrastructure error
// is returned rather than silently producing wrong data (an empty thread, or a
// live anchor flagged orphaned).
func (c *Comments) hydrate(comment *Comment) error {
	replies, err := c.store.RepliesByComment(comment.ID)
	if err != nil {
		return err
	}
	return c.hydrateWith(comment, replies)
}

// hydrateWith attaches an already-loaded thread and resolves the comment's
// anchor-orphaned flag. Splitting this out is what lets List load every thread
// in one batched query and still finish each comment exactly as the
// single-comment path does; only a genuinely missing anchor (ErrAnchorNotFound)
// sets the orphaned flag, while an infrastructure error surfaces.
func (c *Comments) hydrateWith(comment *Comment, replies []Reply) error {
	if replies == nil {
		replies = []Reply{}
	}
	comment.Replies = replies
	info, err := c.anchors.AnchorInProject(comment.ProjectID, comment.DocumentID, comment.AnchorID)
	switch {
	case errors.Is(err, ErrAnchorNotFound):
		comment.AnchorOrphaned = true
	case err != nil:
		return err
	default:
		comment.AnchorOrphaned = info.Orphaned
	}
	return nil
}

func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
