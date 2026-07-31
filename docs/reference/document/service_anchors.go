package document

// service_anchors.go holds external anchors: creating one against a validated
// target in the document head, listing, deleting, re-validating, and carrying
// anchors forward across an accepted change set.

// CreateAnchor stores an external anchor on a document after validating that its
// target (row, block, optional atom) exists in the current document head.
func (d *Documents) CreateAnchor(projectID, docID string, a DocumentAnchor) (DocumentAnchor, error) {
	doc, err := d.store.DocumentByID(projectID, docID)
	if err != nil {
		return DocumentAnchor{}, err
	}
	if doc.ProjectID != projectID {
		return DocumentAnchor{}, ErrNotFound
	}
	if err := validateAnchorTarget(doc.Base, a); err != nil {
		return DocumentAnchor{}, err
	}
	a.ID = newID()
	a.DocumentID = docID
	a.State = AnchorValid
	a.CreatedAt = d.now().UTC()
	if err := d.store.CreateAnchor(docID, a); err != nil {
		return DocumentAnchor{}, err
	}
	return a, nil
}

func validateAnchorTarget(base Base, a DocumentAnchor) error {
	for _, r := range base.Rows {
		if r.ID == a.RowID {
			for _, b := range r.Blocks {
				if b.ID == a.BlockID {
					if a.AtomID == "" {
						return nil
					}
					for _, atom := range b.Atoms {
						if atom.ID == a.AtomID {
							if a.End > 0 && a.End > len(atom.Text) {
								return ErrAnchorInvalid
							}
							if a.Start < 0 || a.Start >= len(atom.Text) {
								return ErrAnchorInvalid
							}
							return nil
						}
					}
				}
			}
		}
	}
	// Check header/footer too
	for _, r := range base.Header {
		if r.ID == a.RowID {
			for _, b := range r.Blocks {
				if b.ID == a.BlockID && a.AtomID == "" {
					return nil
				}
			}
		}
	}
	for _, r := range base.Footer {
		if r.ID == a.RowID {
			for _, b := range r.Blocks {
				if b.ID == a.BlockID && a.AtomID == "" {
					return nil
				}
			}
		}
	}
	return ErrAnchorInvalid
}

// ListAnchors returns all anchors on a document.
func (d *Documents) ListAnchors(projectID, docID string) ([]DocumentAnchor, error) {
	doc, err := d.store.DocumentByID(projectID, docID)
	if err != nil {
		return nil, err
	}
	if doc.ProjectID != projectID {
		return nil, ErrNotFound
	}
	return d.store.ListAnchors(docID)
}

// DeleteAnchor removes one anchor from a document.
func (d *Documents) DeleteAnchor(projectID, docID, anchorID string) error {
	doc, err := d.store.DocumentByID(projectID, docID)
	if err != nil {
		return err
	}
	if doc.ProjectID != projectID {
		return ErrNotFound
	}
	return d.store.DeleteAnchor(docID, anchorID)
}

// ValidateAnchor checks whether an anchor's target still exists in the current
// document head and updates its state accordingly.
func (d *Documents) ValidateAnchor(projectID, docID, anchorID string) (DocumentAnchor, error) {
	doc, err := d.Get(projectID, docID)
	if err != nil {
		return DocumentAnchor{}, err
	}
	if doc.ProjectID != projectID {
		return DocumentAnchor{}, ErrNotFound
	}
	anchors, err := d.store.ListAnchors(docID)
	if err != nil {
		return DocumentAnchor{}, err
	}
	for _, a := range anchors {
		if a.ID == anchorID {
			if err := validateAnchorTarget(doc.Base, a); err != nil {
				a.State = AnchorOrphaned
				_ = d.store.UpdateAnchor(docID, a)
			} else {
				a.State = AnchorValid
				_ = d.store.UpdateAnchor(docID, a)
			}
			return a, nil
		}
	}
	return DocumentAnchor{}, ErrNotFound
}

// RebaseAnchors walks all anchors on a document and updates state after a
// ChangeSet was accepted. Targets moved between rows/blocks get their row/block
// IDs updated; deleted targets are marked orphaned.
func (d *Documents) RebaseAnchors(docID string, ops []ChangeOp) error {
	anchors, err := d.store.ListAnchors(docID)
	if err != nil {
		return err
	}
	if len(anchors) == 0 {
		return nil
	}
	for i := range anchors {
		if anchors[i].State == AnchorOrphaned {
			continue
		}
		for _, op := range ops {
			switch op.Op {
			case OpDeleteRow:
				if op.RowID == anchors[i].RowID {
					anchors[i].State = AnchorOrphaned
				}
			case OpDeleteBlock:
				if op.BlockID == anchors[i].BlockID {
					anchors[i].State = AnchorOrphaned
				}
			case OpDeleteAtom:
				if op.AtomID == anchors[i].AtomID {
					anchors[i].State = AnchorOrphaned
				}
			case OpMoveBlock:
				if op.BlockID == anchors[i].BlockID && op.RowID != "" {
					anchors[i].RowID = op.RowID
				}
			case OpSetBlock:
				if op.BlockID == anchors[i].BlockID {
					// Block still exists (setBlock replaces content, preserves ID)
				}
			}
		}
	}
	for _, a := range anchors {
		if err := d.store.UpdateAnchor(docID, a); err != nil {
			return err
		}
	}
	return nil
}
