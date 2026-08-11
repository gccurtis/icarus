package document

// service_crud.go holds the document CRUD surface: creating, renaming and
// duplicating a document, the metadata-only listings, and Get — the one read
// that folds pending change sets over the stored base.

import (
	"fmt"
	"strings"
)

// Create makes a new document in a project. It captures the configured row
// metrics and supplies default page geometry, then assigns missing content IDs
// so every row and block has a stable identifier future change sets can use.
func (d *Documents) Create(projectID, name string, base Base, actors ...Actor) (Document, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Document{}, ErrInvalidName
	}

	if base.PageLayout == (PageLayout{}) {
		base.PageLayout = d.pageLayout
	}
	base.LayoutRules = d.layoutRules
	if err := validateBaseStylePayloads(base); err != nil {
		d.recordStyleValidationRejection(err, projectID, "")
		return Document{}, err
	}
	assignIDs(&base)
	normalizeStoredStyleState(&base)
	if err := validateContent(base); err != nil {
		d.recordStyleValidationRejection(err, projectID, "")
		return Document{}, err
	}
	actor := selectedActor(actors)
	now := d.now().UTC()
	doc := Document{
		ID:          newID(),
		ProjectID:   projectID,
		Name:        name,
		Base:        base,
		CreatorID:   actor.ID,
		CreatorName: actor.Name,
		CreatedAt:   now,
		UpdatedAt:   now,
		Lifecycle:   LifecycleActive,
	}
	fact := newActivityFact(doc, actor, ActivityCreated, now, "document", doc.ID)
	if err := d.store.CreateDocument(doc, fact); err != nil {
		return Document{}, err
	}
	d.reindexReferences(projectID, doc.ID, doc.Base)
	return doc, nil
}

// Rename changes a Document's canonical display name. A normalized no-op keeps
// its current timestamp and emits no Activity fact.
func (d *Documents) Rename(projectID, id, name string, actor Actor) (Document, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Document{}, ErrInvalidName
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
	doc.Base = normalizeStoredBase(doc.Base, d.pageLayout, d.layoutRules)
	normalizeStoredStyleState(&doc.Base)
	if doc.Name == name {
		return doc, nil
	}
	now := d.now().UTC()
	fact := newActivityFact(doc, actor, ActivityRenamed, now, "document.rename", newID())
	fact.TargetName = name
	if err := d.store.RenameDocument(id, name, now, fact); err != nil {
		return Document{}, err
	}
	doc.Name = name
	doc.UpdatedAt = now
	return doc, nil
}

// List returns a lightweight summary of every active document in the project —
// identity and metadata, never bodies. A body needs pending change sets folded
// in (only Get does that), so a listing that carried bodies would show stale
// content; callers that need a document's content Get it by id.
func (d *Documents) List(projectID string) ([]Summary, error) {
	docs, err := d.store.DocumentsByProject(projectID)
	if err != nil {
		return nil, err
	}
	out := make([]Summary, 0, len(docs))
	for i := range docs {
		out = append(out, Summary{
			ID: docs[i].ID, Name: docs[i].Name,
			CreatorID: docs[i].CreatorID, CreatorName: docs[i].CreatorName,
			CreatedAt: docs[i].CreatedAt, UpdatedAt: docs[i].UpdatedAt,
		})
	}
	return out, nil
}

// RevisionHints returns a lightweight map of document ID to current head revision
// for every document in the project. Used for quick client-side staleness checks.
func (d *Documents) RevisionHints(projectID string) (map[string]int64, error) {
	docs, err := d.store.DocumentsByProject(projectID)
	if err != nil {
		return nil, err
	}
	hints := make(map[string]int64, len(docs))
	for _, doc := range docs {
		hints[doc.ID] = doc.Revision
	}
	return hints, nil
}

// Summaries returns a bounded owner-projected metadata page.
func (d *Documents) Summaries(projectID string, before *SummaryBoundary, limit int) ([]Summary, error) {
	return d.store.DocumentSummaries(projectID, before, limit)
}

// Summary returns one Document's bounded canonical metadata without resolving
// its content or replaying pending change sets.
func (d *Documents) Summary(projectID, id string) (Summary, error) {
	doc, err := d.store.DocumentByID(projectID, id)
	if err != nil {
		return Summary{}, err
	}
	if doc.ProjectID != projectID {
		return Summary{}, ErrNotFound
	}
	return Summary{
		ID: doc.ID, Name: doc.Name, CreatorID: doc.CreatorID, CreatorName: doc.CreatorName,
		CreatedAt: doc.CreatedAt, UpdatedAt: doc.UpdatedAt,
	}, nil
}

// Get returns a document by ID, scoped to a project, resolved: the base with all
// pending change sets applied, so the caller sees the current content. A document
// that belongs to a different project is reported as ErrNotFound, so a project
// cannot reach — or even confirm the existence of — another project's documents.
func (d *Documents) Get(projectID, id string) (Document, error) {
	doc, err := d.store.DocumentByID(projectID, id)
	if err != nil {
		return Document{}, err
	}
	if doc.ProjectID != projectID {
		return Document{}, ErrNotFound
	}
	doc.Base = normalizeStoredBase(doc.Base, d.pageLayout, d.layoutRules)
	normalizeStoredStyleState(&doc.Base)
	pending, err := d.store.ChangeSetsSince(id, doc.BaseSeq)
	if err != nil {
		return Document{}, err
	}
	resolved, err := applyChangeSets(doc.Base, pending)
	if err != nil {
		return Document{}, err
	}
	if err := validateContent(resolved); err != nil {
		return Document{}, err
	}
	doc.Base = resolved
	return doc, nil
}

// Duplicate creates a new Document by copying the source. Every internal ID
// (rows, blocks, atoms, marks, styles) is regenerated; all cross-references
// are remapped. The name gets a numbered suffix to avoid collisions.
func (d *Documents) Duplicate(projectID, sourceID string, actor Actor) (Document, error) {
	src, err := d.Get(projectID, sourceID)
	if err != nil {
		return Document{}, err
	}
	name, err := d.duplicateName(projectID, src.Name)
	if err != nil {
		return Document{}, err
	}
	now := d.now().UTC()
	base := duplicateBase(src.Base)
	if err := validateContent(base); err != nil {
		d.recordStyleValidationRejection(err, projectID, sourceID)
		return Document{}, err
	}
	doc := Document{
		ID:          newID(),
		ProjectID:   projectID,
		Name:        name,
		Base:        base,
		CreatorID:   actor.ID,
		CreatorName: actor.Name,
		CreatedAt:   now,
		UpdatedAt:   now,
		Lifecycle:   LifecycleActive,
	}
	fact := newActivityFact(doc, actor, ActivityDuplicated, now, "document.duplicate", sourceID)
	if err := d.store.CreateDocument(doc, fact); err != nil {
		return Document{}, err
	}
	return doc, nil
}

// duplicateName returns the source name with a numbered suffix — "Name (1)",
// "Name (2)", etc. — until it finds one not in use within the project.
func (d *Documents) duplicateName(projectID, sourceName string) (string, error) {
	existing, err := d.store.DocumentsByProject(projectID)
	if err != nil {
		return "", err
	}
	taken := make(map[string]bool, len(existing))
	for _, doc := range existing {
		taken[doc.Name] = true
	}
	base := sourceName
	for n := 1; ; n++ {
		candidate := fmt.Sprintf("%s (%d)", base, n)
		if !taken[candidate] {
			return candidate, nil
		}
	}
}
