# dependencies.go

The reference graph as a **read**, not a maintained index. A prompt block depends
on exactly the sources in its resolved context scope (Slice E), so "which prompt
blocks depend on source X?" is derivable by scanning the project's documents and
matching each block's `resolveBlockScope` against the origin — there is no second
source of truth to drift. Slice G consumes this to drive the refresh cascade.
`DependentPrompts` also sees through one more hop: a block whose selection binds
to a CONTEXT (rather than the changed origin directly) still counts as a
dependent when that context transitively contains the origin — the deep cascade
added alongside record 0107. See repo conventions (AGENTS.md).

## Code breakdown

```go
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
```

Only prompt blocks with a context selection are considered; a block with no
`Context`, or a text block, depends on nothing and is skipped. A source with no
dependents returns an empty slice, so the cascade simply does no work.

`ScopeReferences` is the second port this file declares (mirroring
`ScopeResolver` in `prompt.go`): satisfied over the contexts capability's
`References` at composition (see `document_scope.go` in `core/wiring`), never
imported directly, so `document` stays independent of `contexts`. It is wired
via `UseScopeReferences` in `service.go`; `New` leaves it `nil`, so a service
that never wires it keeps today's direct-origin-only matching exactly as
before this port existed.

The inner loop's match logic is now two passes over one block. The first pass
is unchanged: `resolveBlockScope` computes the block's origin-level scope
(includes − excludes) and a direct hit records the block immediately. The
second pass only runs when the first found nothing *and* a `ScopeReferences`
port is wired: it re-derives the block's raw selection — `include` and
`exclude` origins, unsubtracted — via `resolveBlockScopeSelection`, because a
context that only appears on the exclude side must still be checked (excluding
a context is itself a dependency on that context's membership, per
`Contexts.References`'s doc comment). For every selected origin of kind
`"context"`, on either side, it asks `ContextReferences` whether that context
transitively contains the changed `origin`; the first `true` records the block
and breaks out of both loops via the labeled `selectionLoop`. A
`ContextReferences` error is swallowed with `continue` rather than propagated:
this is a best-effort deepening of an already best-effort scan (the doc
comment above `DependentPrompts` already treats a per-document `Get` error as
skip-and-continue), so one context's lookup failing must not fail the whole
project's cascade.
