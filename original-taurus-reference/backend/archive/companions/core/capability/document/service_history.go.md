# service_history.go

The revision-time surface of the service: reading a document as it stood at an
earlier revision (`GetAtRevision`), comparing two revisions (`Diff`), and
walking the head backward and forward with `Undo` / `Redo`.

All four rest on the same fact: a document is a stored base plus an append-only
list of change sets, each with a monotonic `Seq`. That makes an old revision
reconstructible by *truncating* the replay, and makes undo an ordinary forward
edit that happens to apply a retained inverse rather than a rewind of history.

`GetAtRevision`, `Undo`, and `Redo` each pass their `projectID` into
`store.DocumentByID`, which filters on it (DEF-1), so history for a document in
another project is `ErrNotFound` at the store — the revision log is as
project-private as the document. Each still compares `doc.ProjectID` afterwards;
that check is deliberately redundant and stays.

## Code breakdown

### GetAtRevision: replay truncated at a sequence

Same shape as `Get`, with the pending list filtered to `cs.Seq <= revision`. A
negative revision is `ErrInvalidDiffRevisions`; `revision == 0` short-circuits
to the normalized stored base with `doc.Revision` forced to 0.

The subtlety is the reported revision after a truncated replay:

```go
if len(filtered) > 0 {
	doc.Revision = filtered[len(filtered)-1].Seq
} else {
	doc.Revision = doc.BaseSeq
}
```

The returned `Revision` is the last sequence actually *applied*, not the number
the caller asked for. Asking for revision 9 when the head is 7 returns the
document at 7, correctly labelled 7. With nothing to replay the answer is
`doc.BaseSeq` — the revision the stored base already embodies — so a re-based
document reports the same revision for a given snapshot as it did before the
fold.

Reconstruction only reaches back as far as retained detail allows: re-base with
a configured `historyLimit` prunes change sets, so a revision older than the
retained window is no longer reconstructible.

### Diff: two reconstructions, then a structural compare

`Diff` requires `oldRev < newRev` (equal or inverted is
`ErrInvalidDiffRevisions`), reconstructs both revisions via `GetAtRevision`, and
hands the two bases to `diffBases` (`diff.go`).

Bounds are defaulted here rather than in the differ — `MaxChanges` 100,
`MaxTextLen` 200 — so an unbounded caller cannot ask for an unbounded response;
the differ is always given a real limit. The revisions are stamped onto the
result afterwards so the response is self-describing.

### Undo: a compensating change set for the head revision

`Undo` refuses far more than it accepts, and each refusal has its own sentinel
so a client can explain itself:

- the target change set must belong to `authorID` → `ErrUndoForbidden`;
- it must still be the document head, `target.Seq == doc.Revision` →
  `ErrUndoConflict`;
- it must not itself be an undo (`target.UndoOf != ""`) → `ErrUndoIneligible`;
- it must carry retained `InverseOps` → `ErrUndoUnavailable`.

The head-only rule is what makes this first undo increment safe under
collaboration: undoing an *older* revision would have to be transformed against
everything that landed after it, so instead it is refused outright and undo can
never overwrite a later collaborator's work.

The undo itself is not a rewind. It is a submission of the retained inverse ops
through `submitChangesAt`, with `expectedRevision = target.Seq`, no submission
id, and `undoOf = target.ID`:

```go
cs, err := d.submitChangesAt(
	projectID, id, authorID,
	"", "", target.Seq, target.InverseOps, target.ID, "", actorNames...,
)
if errors.Is(err, ErrRevisionConflict) {
	return ChangeSet{}, ErrUndoConflict
}
```

The empty submission id matters: it disables the semantic-rebase retry in
`submitChangesAt` (see `service_submit.go`), so an undo is admitted at the
revision it was computed against or not at all. A revision conflict from the
CAS — a collaborator landed an edit between the head check and the append — is
translated to `ErrUndoConflict`, the same error the pre-check reports, so the
race and the check look identical to the caller.

History moves forward: the undo becomes a new revision that `UndoOf` links back
to the one it compensates.

### Redo: the same mechanism, opposite lineage

`Redo` mirrors `Undo` with the eligibility test inverted — the target must
*be* an unredone undo (`target.UndoOf == "" || target.RedoOf != ""` is
`ErrRedoIneligible`) — and the same author, head-only, and inverse-ops
preconditions, each with its `ErrRedo…` sentinel.

Mechanically a redo is just the inverse of an undo, which is the original edit
again. The difference is lineage: it is submitted with `redoOf = target.ID`
instead of `undoOf`, so `History` can tell a redo from yet another undo and the
`UndoOf`-based eligibility check above stays meaningful across a long
undo/redo run.
