package document

// service_lifecycle.go holds the trash lifecycle: moving a document to trash,
// restoring it, purging one permanently, and sweeping documents whose trash
// retention has expired.

import "time"

// Delete moves a document to trash, scoped to a project. The content and
// history are preserved; a trashed document can be restored or permanently
// purged.
func (d *Documents) Delete(projectID, id string, actors ...Actor) error {
	doc, err := d.store.DocumentByID(projectID, id)
	if err != nil {
		return err
	}
	if doc.ProjectID != projectID {
		return ErrNotFound
	}
	now := d.now().UTC()
	actor := selectedActor(actors)
	fact := newActivityFact(doc, actor, ActivityTrashed, now, "document.trash", newID())
	return d.store.SetLifecycle(id, LifecycleTrashed, now, now, fact)
}

// Restore moves a document from trash back to active. Reports ErrNotFound if the
// document is not trashed.
func (d *Documents) Restore(projectID, id string, actor Actor) error {
	doc, err := d.store.DocumentByID(projectID, id)
	if err != nil {
		return err
	}
	if doc.ProjectID != projectID {
		return ErrNotFound
	}
	if doc.Lifecycle != LifecycleTrashed {
		return ErrNotFound
	}
	now := d.now().UTC()
	fact := newActivityFact(doc, actor, ActivityRestored, now, "document.restore", newID())
	return d.store.SetLifecycle(id, LifecycleActive, time.Time{}, now, fact)
}

// Purge permanently deletes a trashed document and all its change sets, history,
// and submissions. Reports ErrNotFound if the document is not in trash.
func (d *Documents) Purge(projectID, id string, actors ...Actor) error {
	doc, err := d.store.DocumentByID(projectID, id)
	if err != nil {
		return err
	}
	if doc.ProjectID != projectID {
		return ErrNotFound
	}
	if doc.Lifecycle != LifecycleTrashed {
		return ErrNotFound
	}
	now := d.now().UTC()
	fact := newActivityFact(doc, selectedActor(actors), ActivityPurged, now, "document.purge", newID())
	return d.store.DeleteDocument(id, fact)
}

// PurgeStale permanently deletes every trashed document whose TrashedAt is older
// than the configured retention period.
func (d *Documents) PurgeStale() error {
	cutoff := d.now().Add(-d.trashRetention)
	stale, err := d.store.TrashedDocumentsOlderThan(cutoff)
	if err != nil {
		return err
	}
	now := d.now().UTC()
	for _, doc := range stale {
		actor := Actor{SystemActorID, SystemActorName}
		fact := newActivityFact(doc, actor, ActivityPurged, now, "document.purge_stale", newID())
		if err := d.store.DeleteDocument(doc.ID, fact); err != nil {
			return err
		}
	}
	return nil
}
