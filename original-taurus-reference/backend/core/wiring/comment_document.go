// Document -> comment adapter.
//
// Anchored comments need to validate and create document anchors; this adapter
// serves the comment capability's AnchorReader port over the document service,
// so comment never imports document.
package wiring

import (
	"github.com/gccurtis/taurus-omega/core/capability/comment"
	"github.com/gccurtis/taurus-omega/core/capability/document"
)

// commentAnchors satisfies the comment AnchorReader port over the document
// service: it validates that an anchor belongs to a document (reporting whether
// its target is still live) and creates inline anchors, so the comment
// capability never imports document.
type commentAnchors struct{ docs *document.Documents }

func (a commentAnchors) AnchorInProject(projectID, documentID, anchorID string) (comment.AnchorInfo, error) {
	anchors, err := a.docs.ListAnchors(projectID, documentID)
	if err != nil {
		return comment.AnchorInfo{}, err
	}
	for _, an := range anchors {
		if an.ID == anchorID {
			return comment.AnchorInfo{ID: an.ID, Orphaned: an.State == document.AnchorOrphaned}, nil
		}
	}
	// A genuinely missing anchor is a distinct sentinel (not an infra error), so
	// the comment service can tell "orphaned" from "the DB is down".
	return comment.AnchorInfo{}, comment.ErrAnchorNotFound
}

func (a commentAnchors) CreateAnchor(projectID, documentID string, ref comment.AnchorRef) (comment.AnchorInfo, error) {
	created, err := a.docs.CreateAnchor(projectID, documentID, document.DocumentAnchor{
		RowID: ref.RowID, BlockID: ref.BlockID, AtomID: ref.AtomID, Start: ref.Start, End: ref.End,
	})
	if err != nil {
		return comment.AnchorInfo{}, err
	}
	return comment.AnchorInfo{ID: created.ID}, nil
}
