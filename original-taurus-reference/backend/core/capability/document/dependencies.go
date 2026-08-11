package document

// PromptLocation names one prompt block by its document and block id.
type PromptLocation struct {
	DocumentID string
	BlockID    string
}

// ScopeReferences reports whether a context transitively references an origin —
// the seam that lets DependentPrompts see a change reached THROUGH a context.
// Satisfied over the contexts capability at composition; when nil, only direct
// scope origins match (today's behavior).
type ScopeReferences interface {
	ContextReferences(projectID, contextID string, origin ScopeOrigin) (bool, error)
}

// DependentPrompts returns every prompt block in the project whose resolved
// context scope includes the given origin. A block's scope is includes − excludes
// over the document's context variables (resolveBlockScope), so this is the exact
// "which blocks depend on this source?" query the refresh cascade needs — the
// dependency graph is derived from scope, not a separate maintained index.
//
// It scans the project's documents on demand; for the proto's document sizes this
// is adequate, and the signature admits a persisted index later without a caller
// change.
func (d *Documents) DependentPrompts(projectID string, origin ScopeOrigin) ([]PromptLocation, error) {
	list, err := d.List(projectID)
	if err != nil {
		return nil, err
	}
	var out []PromptLocation
	for i := range list {
		// Get (not the List result) so pending change sets are folded in — a
		// variable binding or block context set by a not-yet-rebased op must be
		// visible, or a freshly-edited document would look like it depends on
		// nothing.
		doc, err := d.Get(projectID, list[i].ID)
		if err != nil {
			continue
		}
		for _, row := range doc.Base.Rows {
			for _, blk := range row.Blocks {
				if blk.Kind != BlockKindPrompt || blk.Context == nil {
					continue
				}
				matched := false
				for _, o := range resolveBlockScope(doc.Base.Template, blk.Context) {
					if o == origin {
						out = append(out, PromptLocation{DocumentID: doc.ID, BlockID: blk.ID})
						matched = true
						break
					}
				}
				// Deep cascade: a block whose selection binds to a CONTEXT (not the
				// changed origin directly) still depends on it when the context
				// transitively contains that origin. Best-effort — a ContextReferences
				// error skips that origin rather than failing the whole cascade.
				if !matched && d.scopeReferences != nil {
					inc, exc := resolveBlockScopeSelection(doc.Base.Template, blk.Context)
				selectionLoop:
					for _, sel := range [][]ScopeOrigin{inc, exc} {
						for _, o := range sel {
							if o.Kind != "context" {
								continue
							}
							ok, err := d.scopeReferences.ContextReferences(projectID, o.ID, origin)
							if err != nil {
								continue
							}
							if ok {
								out = append(out, PromptLocation{DocumentID: doc.ID, BlockID: blk.ID})
								break selectionLoop
							}
						}
					}
				}
			}
		}
	}
	return out, nil
}
