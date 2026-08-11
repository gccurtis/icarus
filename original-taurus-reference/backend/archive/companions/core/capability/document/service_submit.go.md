# service_submit.go

The write path, and the correctness core of the whole document model:
`SubmitChanges` and the `submitChangesAt` admission loop it shares with
undo/redo, the formula evaluation that runs over incoming ops, and the
`Rebase` / `RebaseJob` fold that turns accepted change sets into a new base.

Two guarantees are implemented here and nowhere else:

- **Idempotency.** A retried submission — same author, same scoped
  `SubmissionID`, same payload hash — returns the *original* `ChangeSet`, with
  the server ids assigned the first time. A lost response is therefore always
  safe to re-send.
- **Revision compare-and-swap.** A change set is appended only against the
  exact head it was proven at. When the head moves, the edit is either proven
  safe at the newer head by semantic rebase and retried, or rejected with a
  bounded `AdmissionConflict` telling the client what to resync to.

**Project scoping (DEF-1).** Every `store.DocumentByID` call in this file now
carries the caller's `projectID` and the store filters on it, including the three
*reload* sites: the top of the admission loop, the two conflict paths that reload
the head to report a `CurrentRevision`, and the post-loop exhaustion path.
Scoping those matters — a conflict response reports the current revision of the
document it loaded, so an unscoped reload would leak another project's revision
number even on a rejected write. `Rebase` is scoped the same way, which is what
makes the job path safe: `RebaseJob` takes its `ProjectID` from the queue
payload, and the store filter means a payload naming a foreign document folds
nothing rather than rebasing it. `submitChangesAt` and `Rebase` still compare
`doc.ProjectID != projectID` after loading; those comparisons are **deliberately
redundant** with the store filter and stay.

## Code breakdown

### SubmitChanges: validate the envelope, then delegate

The public entry point does only what is specific to a *client* submission:
reject an invalid `SubmissionID` or negative `ExpectedRevision` with
`ErrInvalidSubmission`, validate the ops, and compute the payload hash
(`submissionHash`, in `submission.go`, which deliberately fingerprints the
request *before* server ids are assigned). It then calls `submitChangesAt` with
empty `undoOf`/`redoOf`. Undo and redo call the same function with an empty
submission id and a lineage id instead — that difference is what turns the
semantic-rebase retry on or off.

### submitChangesAt: the admission loop

Everything below happens inside `for attempt := 0; attempt < maxSemanticRebaseAttempts; attempt++`.
Three things are computed *once, before* the loop, and that is load-bearing:

```go
ops = cloneChangeOps(ops)
allowSemanticRebase := submissionID != "" && undoOf == "" && redoOf == ""
idsAssigned := false
changeSetID := newID()
```

The ops are cloned so the caller's slice is never mutated. `changeSetID` is
minted once so every retry proposes the *same* change set id — that is what
lets the success path below tell "I created this revision" from "an atomic
identical retry beat me to it". `idsAssigned` ensures server-assigned content
ids and formula evaluation happen exactly once across all attempts, so a retry
never re-mints ids or re-runs a formula.

Semantic rebase is enabled only for real client submissions. An undo or redo
has no submission id, so `allowSemanticRebase` is false and it is admitted at
the revision it was computed against or not at all (see `service_history.go`).

**Idempotency is checked first — before revision admission and before ids are
assigned.** The order is the point: a retry must return the first stored server
ids even though that first acceptance already advanced the head, so checking
the revision first would wrongly report a conflict against the retry's own
earlier success.

```go
existing, err := d.store.ChangeSetBySubmission(id, authorID, submissionID)
switch {
case err == nil && existing.SubmissionHash == hash:
	return existing, nil
case err == nil:
	return ChangeSet{}, &AdmissionConflict{Code: ConflictCodeSubmission, ...}
case !errors.Is(err, ErrChangeSetNotFound):
	return ChangeSet{}, err
}
```

Same key and same hash returns the stored set verbatim; same key with a
*different* payload is `ConflictCodeSubmission` — accidental idempotency-key
reuse, not a stale head.

**Admission** then compares the client's `expectedRevision` with
`admissionRevision := doc.Revision`. Equal is the fast path: replay the pending
sets to get the resolved base and apply the ops as authored. Not equal means
the author edited a stale head, and there are exactly two outcomes — without
semantic rebase, an immediate `revisionAdmissionConflict`; with it,
`rebaseStaleOperations` (`rebase.go`) attempts to prove, from the retained ops
and preconditions of the intervening change sets, that the edit still means the
same thing at the newer head. It returns rewritten `candidateOps`, the resolved
base, and a `proven` flag; unproven is the same conflict. Nothing is guessed:
an unprovable edit is refused, never merged heuristically.

**Trial application** derives compensation against the actually admitted head:
`applyOpsWithInverse(resolved, candidateOps)` produces the new base and the
`InverseOps` stored on the change set — which is what makes undo possible later
(`service_history.go`). `CreatedAt` is forced strictly after `doc.UpdatedAt`
(`+1ns` when the clock has not moved), so change sets on one document are
strictly ordered in time even under a coarse clock.

**The CAS itself** is `store.AppendChangeSet(changeSet, admissionRevision, fact)`.
The store repeats the idempotency check and the head comparison *atomically*, so
the proof above is never trusted across the gap between reading the head and
writing. Its outcomes:

| store result | handling |
| --- | --- |
| `ErrSubmissionConflict` | reload the head, return `ConflictCodeSubmission` |
| `ErrRevisionConflict`, rebase allowed, attempts left | `continue` — re-prove against the newer head |
| `ErrRevisionConflict` otherwise | reload the head, return `ConflictCodeRevision` |
| other error | propagated |

The retry is what makes concurrent editing work: a racing ordinary edit does
not fail this submission, it restarts the proof at the head that edit created.
The loop is bounded by `maxSemanticRebaseAttempts`, and exhausting it falls
through to a revision conflict against the current head — a client under
sustained contention gets a bounded answer, never an unbounded spin.

On success, anchors are carried forward with `_ = d.RebaseAnchors(...)` (error
ignored — anchor maintenance must not fail an accepted edit), and then:

```go
if cs.ID == changeSet.ID {
	d.reindexReferences(projectID, id, newBase)
	if d.enqueuer != nil {
		if all, err := d.store.ChangeSetsSince(id, doc.BaseSeq); err == nil && len(all) >= d.rebaseThreshold {
			_, _ = d.enqueuer.Enqueue(context.Background(), JobTypeRebase, rebasePayload{...})
		}
	}
}
```

Only the creator of the revision schedules representation maintenance. An
identical retry that the store resolved atomically comes back with a *different*
id, so reference reindexing and re-base scheduling happen once per revision
rather than once per retry.

### evaluateFormulaOps: resolve formulas before admission

Run once per submission, just after ids are assigned. With no evaluator wired
it does not silently drop formulas — it rejects any op that needs one
(`OpSetAtomFormula`, `OpRefreshFormula`, or an `OpInsertAtom` carrying formula
data) as `ErrInvalidChangeSet` wrapped with "formula evaluator not configured".

With an evaluator, each formula op is evaluated in place: result and refreshed
dependencies are written back, and `State` becomes `FormulaStateError` or
`FormulaStateOK` from `result.Error`. For an inserted formula atom the
evaluation also fills the atom's visible `Text` (the error string on failure,
the value otherwise) and seeds `History` with one `FormulaHistoryEntry` stamped
from the service clock. Because ops are evaluated before the change set is
built, the stored revision contains the computed values — a reader never has to
re-evaluate to see a document.

### revisionAdmissionConflict

One constructor for the `ConflictCodeRevision` response, filling
`CurrentRevision` and `ResyncRevision` from the same value, so every revision
rejection tells the client the one head to reload.

### RebaseJob and Rebase: fold pending sets into a new base

`RebaseJob` is the `job.Handler` for `JobTypeRebase`: decode the payload,
call `Rebase`. It is registered at startup and enqueued by the submission path
above once pending sets reach the threshold.

`Rebase` is project-scoped and **idempotent**: with nothing pending it is a
no-op (bar history pruning), so running it twice — or re-running a failed job —
is harmless. With pending sets it replays them onto the normalized base and
stores the result with `RebaseDocument(documentID, newBase, pending[last].Seq)`,
so the new base carries the sequence it embodies and reads resolve from there.
When a `historyLimit` is configured, `PruneChangeSets` then bounds retained
summary history while keeping the detail needed for pending reconstruction and
the current head's undo/redo recipe — which is why an undo stays available
immediately after a re-base, but a revision far behind the window is no longer
reconstructible by `GetAtRevision`.
