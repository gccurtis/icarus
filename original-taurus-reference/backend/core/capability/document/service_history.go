package document

// service_history.go holds the revision-time surface: reading a document as of
// an earlier revision, diffing two revisions, and the undo/redo pair that
// appends compensating change sets for a retained revision.

import "errors"

// GetAtRevision returns a document's resolved base at a specific revision
// sequence. Only change sets with Seq ≤ revision are applied over the stored
// base, producing a snapshot of the document at that revision.
func (d *Documents) GetAtRevision(projectID, id string, revision int64) (Document, error) {
	if revision < 0 {
		return Document{}, ErrInvalidDiffRevisions
	}
	doc, err := d.store.DocumentByID(projectID, id)
	if err != nil {
		return Document{}, err
	}
	if doc.ProjectID != projectID {
		return Document{}, ErrNotFound
	}
	if err := validateBaseStylePayloads(doc.Base); err != nil {
		return Document{}, err
	}
	if revision == 0 {
		doc.Base = normalizeStoredBase(doc.Base, d.pageLayout, d.layoutRules)
		normalizeStoredStyleState(&doc.Base)
		if err := validateContent(doc.Base); err != nil {
			return Document{}, err
		}
		doc.Revision = 0
		return doc, nil
	}
	doc.Base = normalizeStoredBase(doc.Base, d.pageLayout, d.layoutRules)
	normalizeStoredStyleState(&doc.Base)
	pending, err := d.store.ChangeSetsSince(id, doc.BaseSeq)
	if err != nil {
		return Document{}, err
	}
	filtered := make([]ChangeSet, 0, len(pending))
	for _, cs := range pending {
		if cs.Seq <= revision {
			filtered = append(filtered, cs)
		}
	}
	resolved, err := applyChangeSets(doc.Base, filtered)
	if err != nil {
		return Document{}, err
	}
	if err := validateContent(resolved); err != nil {
		return Document{}, err
	}
	doc.Base = resolved
	if len(filtered) > 0 {
		doc.Revision = filtered[len(filtered)-1].Seq
	} else {
		doc.Revision = doc.BaseSeq
	}
	return doc, nil
}

// Diff compares two revision heads of the same document and returns a bounded
// list of structural changes — rows, blocks, atoms, and marks that were added,
// removed, moved, or had their content changed between the old and new revisions.
func (d *Documents) Diff(projectID, id string, oldRev, newRev int64, bounds DiffBounds) (DiffResult, error) {
	if oldRev >= newRev {
		return DiffResult{}, ErrInvalidDiffRevisions
	}
	oldDoc, err := d.GetAtRevision(projectID, id, oldRev)
	if err != nil {
		return DiffResult{}, err
	}
	newDoc, err := d.GetAtRevision(projectID, id, newRev)
	if err != nil {
		return DiffResult{}, err
	}
	if bounds.MaxChanges <= 0 {
		bounds.MaxChanges = 100
	}
	if bounds.MaxTextLen <= 0 {
		bounds.MaxTextLen = 200
	}
	result := diffBases(oldDoc.Base, newDoc.Base, bounds)
	result.OldRevision = oldRev
	result.NewRevision = newRev
	return result, nil
}

// Undo appends a compensating change set for one retained revision. The target
// must belong to authorID and still be the document head; refusing an older
// target guarantees this first undo increment never overwrites a later
// collaborator's work.
func (d *Documents) Undo(projectID, id, authorID, changeSetID string, actorNames ...string) (ChangeSet, error) {
	doc, err := d.store.DocumentByID(projectID, id)
	if err != nil {
		return ChangeSet{}, err
	}
	if doc.ProjectID != projectID {
		return ChangeSet{}, ErrNotFound
	}
	target, err := d.store.ChangeSetByID(id, changeSetID)
	if err != nil {
		return ChangeSet{}, err
	}
	if target.AuthorID != authorID {
		return ChangeSet{}, ErrUndoForbidden
	}
	if target.Seq != doc.Revision {
		return ChangeSet{}, ErrUndoConflict
	}
	if target.UndoOf != "" {
		return ChangeSet{}, ErrUndoIneligible
	}
	if len(target.InverseOps) == 0 {
		return ChangeSet{}, ErrUndoUnavailable
	}
	cs, err := d.submitChangesAt(
		projectID, id, authorID,
		"", "", target.Seq, target.InverseOps, target.ID, "", actorNames...,
	)
	if errors.Is(err, ErrRevisionConflict) {
		return ChangeSet{}, ErrUndoConflict
	}
	return cs, err
}

// Redo compensates the current authored undo revision. It is mechanically the
// inverse of that undo, but carries RedoOf lineage so History can distinguish it
// from another undo.
func (d *Documents) Redo(projectID, id, authorID, changeSetID string, actorNames ...string) (ChangeSet, error) {
	doc, err := d.store.DocumentByID(projectID, id)
	if err != nil {
		return ChangeSet{}, err
	}
	if doc.ProjectID != projectID {
		return ChangeSet{}, ErrNotFound
	}
	target, err := d.store.ChangeSetByID(id, changeSetID)
	if err != nil {
		return ChangeSet{}, err
	}
	if target.AuthorID != authorID {
		return ChangeSet{}, ErrRedoForbidden
	}
	if target.Seq != doc.Revision {
		return ChangeSet{}, ErrRedoConflict
	}
	if target.UndoOf == "" || target.RedoOf != "" {
		return ChangeSet{}, ErrRedoIneligible
	}
	if len(target.InverseOps) == 0 {
		return ChangeSet{}, ErrRedoUnavailable
	}
	cs, err := d.submitChangesAt(
		projectID, id, authorID,
		"", "", target.Seq, target.InverseOps, "", target.ID, actorNames...,
	)
	if errors.Is(err, ErrRevisionConflict) {
		return ChangeSet{}, ErrRedoConflict
	}
	return cs, err
}
