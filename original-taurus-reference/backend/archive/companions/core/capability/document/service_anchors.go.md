# service_anchors.go

External anchors: a stored pointer from something outside the document (a
comment, a link, a citation) into a specific row, block, and optionally a text
range within one atom. This file holds the whole anchor surface — create,
validate the target, list, delete, re-validate, and carry anchors forward after
a change set is accepted.

An anchor is *advisory*: it never blocks an edit. Editing is free to delete the
row an anchor points at; the anchor simply becomes `AnchorOrphaned`. The
invariant the file maintains is only that an anchor's `State` honestly
describes whether its target still exists.

`CreateAnchor`, `ListAnchors`, and `DeleteAnchor` each pass their `projectID`
into `store.DocumentByID`, which filters on it (DEF-1), so anchoring into — or
enumerating anchors on — a document in another project is `ErrNotFound` at the
store. This matters more here than elsewhere: `AnchorInProject` is the port the
comment capability reaches document through, so scoping the load in SQL means a
cross-project anchor cannot be confirmed even indirectly. The existing
`doc.ProjectID` comparisons stay, deliberately redundant with the store filter.

## Code breakdown

### CreateAnchor: validate against the head, then mint

`CreateAnchor` loads the document, project-scopes it (`ErrNotFound` on
mismatch), and rejects a target that does not exist before storing anything.
The server owns the anchor's identity fields — `ID`, `DocumentID`, `State`, and
`CreatedAt` are all assigned here regardless of what the caller sent, so a
client cannot create an anchor that is born orphaned or that claims to belong
to another document.

Note that it validates against `doc.Base` as *stored*, not against a resolved
`Get` — an anchor created concurrently with an unfolded pending change set is
validated against the base, and `ValidateAnchor` is the path that reconciles
that.

### validateAnchorTarget: the containment check

The one non-trivial piece of logic in the file. It walks rows looking for
`a.RowID`, then that row's blocks for `a.BlockID`. A block-level anchor
(`a.AtomID == ""`) is valid at that point. An atom-level anchor must find the
atom and pass a range check:

```go
if a.End > 0 && a.End > len(atom.Text) {
	return ErrAnchorInvalid
}
if a.Start < 0 || a.Start >= len(atom.Text) {
	return ErrAnchorInvalid
}
```

`Start` must be a real index into the atom's text and `End`, when set, must not
run past it — an anchor pointing outside its atom is rejected rather than
stored as a range that would silently clamp. Offsets are byte offsets into
`atom.Text`.

Header and footer rows are searched too, but only for block-level anchors:
those loops return `nil` only when `a.AtomID == ""`, so an atom-range anchor
into running header content is not supported. Anything unmatched is
`ErrAnchorInvalid`.

### ListAnchors and DeleteAnchor: scoped pass-throughs

Both load the document first purely to enforce project scoping, then delegate
to the store. Listing another project's anchors, or deleting one, is
`ErrNotFound`.

### ValidateAnchor: reconcile one anchor against resolved content

The only method here that reads through `d.Get` rather than the stored base —
it must judge the anchor against the content the user actually sees, pending
change sets folded in. It scans the document's anchors for the id, re-runs
`validateAnchorTarget`, and writes back `AnchorOrphaned` or `AnchorValid`.

The state transition goes both ways: an anchor previously marked orphaned
becomes valid again if its target reappears (an undo of the deletion, for
instance). The `UpdateAnchor` error is deliberately discarded — the caller is
told the anchor's true current state either way, and a failed persist just
means the next validation recomputes it. An unknown anchor id is `ErrNotFound`.

### RebaseAnchors: carry anchors across an accepted change set

Called from the submission path (`service_submit.go`) with the ops that were
just admitted, and only ever with its error ignored: anchor maintenance must
never fail an accepted edit.

It skips already-orphaned anchors, then matches each op against each anchor:
`OpDeleteRow`/`OpDeleteBlock`/`OpDeleteAtom` orphan an anchor whose
corresponding id was deleted, while `OpMoveBlock` *follows* the block —

```go
case OpMoveBlock:
	if op.BlockID == anchors[i].BlockID && op.RowID != "" {
		anchors[i].RowID = op.RowID
	}
```

— rewriting the anchor's row id so a block dragged into a different row keeps
its anchors. `OpSetBlock` is matched explicitly with an empty body and a comment
saying why: setting a block replaces its content but preserves its id, so the
anchor is still valid and nothing needs to change. Handling it explicitly
records that this was considered rather than missed.

Every anchor is then written back, orphaned or not; the second loop returns on
the first store error.
