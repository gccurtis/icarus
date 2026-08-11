# service_lifecycle.go

The trash lifecycle: `Delete` (trash), `Restore`, `Purge`, and the `PurgeStale`
sweep. Deletion in this capability is two-phase — a document first moves to
trash where its content, history, and submissions are all preserved, and only a
purge is destructive.

Every method here loads the document by id and reports `ErrNotFound` when its
`ProjectID` does not match the caller's, so project isolation holds for the
destructive paths exactly as it does for reads. Since DEF-1 the id is no longer
enough to load one: each call passes its `projectID` into `store.DocumentByID`,
which filters on it, so a foreign document is refused in the store before the
destructive path is reached. The subsequent `ProjectID` comparison stays anyway —
deliberately redundant, two independent layers, neither load-bearing alone.
Each also emits one Activity
fact, passed into the store call so the fact and the state change commit
together.

## Code breakdown

### Delete: move to trash, preserving everything

`Delete` sets `LifecycleTrashed` through `store.SetLifecycle`, passing `now`
twice — once as the trashed-at stamp that `PurgeStale` later measures against,
once as the updated-at stamp:

```go
return d.store.SetLifecycle(id, LifecycleTrashed, now, now, fact)
```

It takes `actors ...Actor` and runs them through `selectedActor`, so an
unattributed trash (a job, a cascade) is recorded as the system actor rather
than as nobody. The emitted fact is `ActivityTrashed` with source kind
`"document.trash"`. No content is touched: the base, the pending change sets,
and the submission records all remain.

### Restore: trashed documents only

`Restore` adds one precondition beyond project scoping:

```go
if doc.Lifecycle != LifecycleTrashed {
	return ErrNotFound
}
```

Restoring an active document is not a no-op success — it is `ErrNotFound`,
which keeps the operation honest about having done nothing. It clears the
trashed-at stamp by passing the zero `time.Time{}` alongside `LifecycleActive`,
so a document that was trashed, restored, and trashed again is measured from
the second trashing. Unlike `Delete`, it takes exactly one `Actor`: a restore
is always a deliberate user action.

### Purge: permanent, and only from trash

`Purge` requires the same `LifecycleTrashed` precondition, which is what makes
the two-phase model real — there is no path from active straight to deleted, so
a single mistaken call can never destroy live content. `store.DeleteDocument`
removes the document with its change sets, history, and submissions. The
`ActivityPurged` fact is built *before* the delete (from the document about to
disappear) and handed to the store, so the record of the purge survives the
thing it describes.

### PurgeStale: the retention sweep

`PurgeStale` is the job-facing sweep. It computes a cutoff from the service
clock and the configured retention (`New` defaults it to thirty days), asks the
store for `TrashedDocumentsOlderThan(cutoff)`, and purges each one:

```go
cutoff := d.now().Add(-d.trashRetention)
```

Every fact it emits is attributed to `Actor{SystemActorID, SystemActorName}` —
retention expiry has no human author — with source kind `"document.purge_stale"`
so an activity feed can distinguish an automatic sweep from a user's purge. All
facts in one sweep share a single `now`, so a sweep reads as one event rather
than as a scatter of near-simultaneous ones.

The loop returns on the first store error, leaving the remaining stale
documents in trash. That is safe because the sweep is idempotent — the next run
recomputes the cutoff and picks up whatever is still expired.
