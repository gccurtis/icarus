package document

// service_submit.go holds the write path: idempotent submission admission with
// the revision compare-and-swap and semantic-rebase retry, formula evaluation
// over incoming ops, and the re-base that folds pending change sets into a new
// base.

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// SubmitChanges accepts one idempotent edit authored at a declared revision. A
// retry with the same scoped SubmissionID and identical payload returns the
// original ChangeSet. A stale edit is admitted only when retained operations
// and preconditions prove its semantic rebase safe.
func (d *Documents) SubmitChanges(
	projectID, id, authorID string,
	submission ChangeSubmission,
	actorNames ...string,
) (ChangeSet, error) {
	if !validSubmissionID(submission.SubmissionID) || submission.ExpectedRevision < 0 {
		return ChangeSet{}, ErrInvalidSubmission
	}
	if err := validateOps(submission.Operations); err != nil {
		d.recordStyleValidationRejection(err, projectID, id)
		return ChangeSet{}, err
	}
	hash, err := submissionHash(submission)
	if err != nil {
		return ChangeSet{}, ErrInvalidSubmission
	}
	return d.submitChangesAt(
		projectID, id, authorID,
		submission.SubmissionID, hash, submission.ExpectedRevision,
		submission.Operations, "", "", actorNames...,
	)
}

func (d *Documents) submitChangesAt(
	projectID, id, authorID string,
	submissionID, hash string,
	expectedRevision int64,
	ops []ChangeOp,
	undoOf, redoOf string,
	actorNames ...string,
) (ChangeSet, error) {
	if err := validateOps(ops); err != nil {
		d.recordStyleValidationRejection(err, projectID, id)
		return ChangeSet{}, err
	}
	ops = cloneChangeOps(ops)
	allowSemanticRebase := submissionID != "" && undoOf == "" && redoOf == ""
	idsAssigned := false
	changeSetID := newID()

	for attempt := 0; attempt < maxSemanticRebaseAttempts; attempt++ {
		doc, err := d.store.DocumentByID(projectID, id)
		if err != nil {
			return ChangeSet{}, err
		}
		if doc.ProjectID != projectID {
			return ChangeSet{}, ErrNotFound
		}

		// Idempotency is checked before revision admission and before missing
		// content IDs are assigned. A retry therefore returns the first stored
		// server IDs even after that acceptance advanced the head.
		if submissionID != "" {
			existing, err := d.store.ChangeSetBySubmission(id, authorID, submissionID)
			switch {
			case err == nil && existing.SubmissionHash == hash:
				return existing, nil
			case err == nil:
				return ChangeSet{}, &AdmissionConflict{
					Code: ConflictCodeSubmission, ExpectedRevision: expectedRevision,
					CurrentRevision: doc.Revision, ResyncRevision: doc.Revision,
				}
			case !errors.Is(err, ErrChangeSetNotFound):
				return ChangeSet{}, err
			}
		}
		if !idsAssigned {
			assignOpIDs(ops)
			if err := d.evaluateFormulaOps(ops); err != nil {
				return ChangeSet{}, err
			}
			idsAssigned = true
		}
		doc.Base = normalizeStoredBase(doc.Base, d.pageLayout, d.layoutRules)

		pending, err := d.store.ChangeSetsSince(id, doc.BaseSeq)
		if err != nil {
			return ChangeSet{}, err
		}
		admissionRevision := doc.Revision
		candidateOps := cloneChangeOps(ops)
		var resolved Base
		if expectedRevision == admissionRevision {
			resolved, err = applyChangeSets(doc.Base, pending)
			if err != nil {
				return ChangeSet{}, err
			}
		} else {
			if !allowSemanticRebase {
				return ChangeSet{}, revisionAdmissionConflict(expectedRevision, admissionRevision)
			}
			var proven bool
			candidateOps, resolved, proven, err = rebaseStaleOperations(
				doc.Base, doc.BaseSeq, expectedRevision, admissionRevision,
				pending, ops,
			)
			if err != nil {
				return ChangeSet{}, err
			}
			if !proven {
				return ChangeSet{}, revisionAdmissionConflict(expectedRevision, admissionRevision)
			}
		}

		actor := Actor{ID: authorID, Name: authorID}
		if len(actorNames) > 0 && strings.TrimSpace(actorNames[0]) != "" {
			actor.Name = strings.TrimSpace(actorNames[0])
		}
		if authorID == SystemActor.ID {
			actor = SystemActor
		}
		changeSet := ChangeSet{
			ID:               changeSetID,
			DocumentID:       id,
			AuthorID:         authorID,
			AuthorName:       actor.Name,
			SubmissionID:     submissionID,
			SubmissionHash:   hash,
			AuthoredRevision: expectedRevision,
			PriorRevision:    admissionRevision,
			Ops:              candidateOps,
			UndoOf:           undoOf,
			RedoOf:           redoOf,
			Summary:          SummarizeChangeOps(candidateOps),
		}

		// Trial application derives compensation against the actual admitted
		// head. The store then repeats idempotency and head CAS atomically. A
		// racing ordinary edit restarts this proof against the newer head.
		newBase, inverse, err := applyOpsWithInverse(resolved, candidateOps)
		if err != nil {
			return ChangeSet{}, err
		}
		changeSet.InverseOps = inverse

		createdAt := d.now().UTC()
		if !createdAt.After(doc.UpdatedAt) {
			createdAt = doc.UpdatedAt.Add(time.Nanosecond)
		}
		changeSet.CreatedAt = createdAt
		cs, err := d.store.AppendChangeSet(changeSet, admissionRevision,
			newActivityFact(doc, actor, ActivityEdited, createdAt, "document.change_set", changeSet.ID))
		switch {
		case errors.Is(err, ErrSubmissionConflict):
			current, loadErr := d.store.DocumentByID(projectID, id)
			if loadErr != nil {
				return ChangeSet{}, loadErr
			}
			return ChangeSet{}, &AdmissionConflict{
				Code: ConflictCodeSubmission, ExpectedRevision: expectedRevision,
				CurrentRevision: current.Revision, ResyncRevision: current.Revision,
			}
		case errors.Is(err, ErrRevisionConflict) && allowSemanticRebase &&
			attempt+1 < maxSemanticRebaseAttempts:
			continue
		case errors.Is(err, ErrRevisionConflict):
			current, loadErr := d.store.DocumentByID(projectID, id)
			if loadErr != nil {
				return ChangeSet{}, loadErr
			}
			return ChangeSet{}, revisionAdmissionConflict(expectedRevision, current.Revision)
		case err != nil:
			return ChangeSet{}, err
		}

		// Rebase external anchors: update IDs for moved blocks, mark deleted targets orphaned.
		_ = d.RebaseAnchors(id, changeSet.Ops)

		// Only the creator of this revision schedules representation
		// maintenance. An atomic identical-retry winner has a different ID.
		if cs.ID == changeSet.ID {
			d.reindexReferences(projectID, id, newBase)
			if d.enqueuer != nil {
				if all, err := d.store.ChangeSetsSince(id, doc.BaseSeq); err == nil && len(all) >= d.rebaseThreshold {
					_, _ = d.enqueuer.Enqueue(context.Background(), JobTypeRebase, rebasePayload{ProjectID: projectID, DocumentID: id})
				}
			}
		}
		return cs, nil
	}

	current, err := d.store.DocumentByID(projectID, id)
	if err != nil {
		return ChangeSet{}, err
	}
	return ChangeSet{}, revisionAdmissionConflict(expectedRevision, current.Revision)
}

func (d *Documents) evaluateFormulaOps(ops []ChangeOp) error {
	if d.formulaEvaluator == nil {
		for _, op := range ops {
			switch op.Op {
			case OpSetAtomFormula, OpRefreshFormula:
				return fmt.Errorf("%w: formula evaluator not configured", ErrInvalidChangeSet)
			case OpInsertAtom:
				if op.Atom != nil && op.Atom.Kind == AtomKindFormula && op.Atom.Data != nil {
					return fmt.Errorf("%w: formula evaluator not configured", ErrInvalidChangeSet)
				}
			}
		}
		return nil
	}
	for i := range ops {
		switch ops[i].Op {
		case OpSetAtomFormula:
			if ops[i].Formula == nil {
				continue
			}
			result, deps, err := d.formulaEvaluator.Evaluate(context.Background(), ops[i].Formula.Expression, ops[i].Formula.Dependencies)
			if err != nil {
				return err
			}
			ops[i].Formula.Result = result
			ops[i].Formula.Dependencies = deps
			if result.Error != "" {
				ops[i].Formula.State = FormulaStateError
			} else {
				ops[i].Formula.State = FormulaStateOK
			}
		case OpRefreshFormula:
			if ops[i].Formula != nil && ops[i].Formula.Expression != "" {
				result, deps, err := d.formulaEvaluator.Evaluate(context.Background(), ops[i].Formula.Expression, ops[i].Formula.Dependencies)
				if err != nil {
					return err
				}
				ops[i].Formula.Result = result
				ops[i].Formula.Dependencies = deps
				if result.Error != "" {
					ops[i].Formula.State = FormulaStateError
				} else {
					ops[i].Formula.State = FormulaStateOK
				}
			}
		case OpInsertAtom:
			if ops[i].Atom == nil || ops[i].Atom.Kind != AtomKindFormula {
				continue
			}
			fd, ok := ops[i].Atom.Data.(FormulaData)
			if !ok {
				continue
			}
			result, deps, err := d.formulaEvaluator.Evaluate(context.Background(), fd.Expression, fd.Dependencies)
			if err != nil {
				return err
			}
			fd.Result = result
			fd.Dependencies = deps
			if result.Error != "" {
				fd.State = FormulaStateError
				ops[i].Atom.Text = result.Error
			} else {
				fd.State = FormulaStateOK
				ops[i].Atom.Text = result.Value
			}
			fd.History = []FormulaHistoryEntry{{
				Result: result, Dependencies: deps, State: fd.State, EvaluatedAt: d.now().UTC(),
			}}
			ops[i].Atom.Data = fd
		}
	}
	return nil
}

func revisionAdmissionConflict(expectedRevision, currentRevision int64) *AdmissionConflict {
	return &AdmissionConflict{
		Code: ConflictCodeRevision, ExpectedRevision: expectedRevision,
		CurrentRevision: currentRevision, ResyncRevision: currentRevision,
	}
}

// RebaseJob is the job.Handler for JobTypeRebase: it decodes the payload and
// re-bases the named document. It is registered with the job registry at startup.
func (d *Documents) RebaseJob(ctx context.Context, payload json.RawMessage) error {
	var p rebasePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return err
	}
	return d.Rebase(ctx, p.ProjectID, p.DocumentID)
}

// Rebase folds a document's pending change sets into a new base and, if a
// history limit is configured, bounds summary History while retaining pending
// reconstruction detail and the current-head undo/redo recipe. It is scoped to
// a project (a document in another project is ErrNotFound) and idempotent: with
// nothing pending it is a no-op, so running it twice is harmless.
func (d *Documents) Rebase(ctx context.Context, projectID, documentID string) error {
	doc, err := d.store.DocumentByID(projectID, documentID)
	if err != nil {
		return err
	}
	if doc.ProjectID != projectID {
		return ErrNotFound
	}
	doc.Base = normalizeStoredBase(doc.Base, d.pageLayout, d.layoutRules)
	normalizeStoredStyleState(&doc.Base)
	pending, err := d.store.ChangeSetsSince(documentID, doc.BaseSeq)
	if err != nil {
		return err
	}
	if len(pending) == 0 {
		if d.historyLimit > 0 {
			return d.store.PruneChangeSets(documentID, d.historyLimit)
		}
		return nil
	}
	newBase, err := applyChangeSets(doc.Base, pending)
	if err != nil {
		return err
	}
	if err := d.store.RebaseDocument(documentID, newBase, pending[len(pending)-1].Seq); err != nil {
		return err
	}
	if d.historyLimit > 0 {
		return d.store.PruneChangeSets(documentID, d.historyLimit)
	}
	return nil
}
