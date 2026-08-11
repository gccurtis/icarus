# document_scope.go

Adapts the `contexts` capability to `document.ScopeResolver`. `documentScopeResolver` implements `ExpandScope(ctx, projectID, include, exclude []document.ScopeOrigin) ([]document.ScopeOrigin, error)` by treating a prompt block's include/exclude origins as an anonymous context definition — `toContextRefs` maps each `document.ScopeOrigin` to a `contexts.Ref` (kind + id only; name is not carried) — resolving it live via `(*contexts.Contexts).Resolve`, and mapping the flattened `[]contexts.Ref` leaves back to `[]document.ScopeOrigin{Kind, ID}`. This keeps `document` independent of `contexts` — the composition lives here in wiring.

It also adapts `contexts` to `document.ScopeReferences`. `documentScopeReferences` implements `ContextReferences(projectID, contextID string, origin document.ScopeOrigin) (bool, error)` by delegating straight to `(*contexts.Contexts).References(projectID, contextID, origin.Kind, origin.ID)` — no translation needed beyond unpacking `origin`'s two fields as the discrete `kind, id` arguments `References` takes. This is the seam behind the deep cascade (record 0107): `DependentPrompts` uses it to see a change reached through a context a prompt block selects, not only a block's direct scope origins. See repo conventions (AGENTS.md).

## Code breakdown

```go
package wiring

import (
	"context"

	"github.com/gccurtis/taurus-omega/core/capability/contexts"
	"github.com/gccurtis/taurus-omega/core/capability/document"
)

// documentScopeResolver adapts the contexts capability to document.ScopeResolver:
// it treats a block's include/exclude origins as an anonymous context definition
// and returns the flattened leaf origins. Keeps document independent of contexts.
type documentScopeResolver struct{ contexts *contexts.Contexts }

func (r documentScopeResolver) ExpandScope(_ context.Context, projectID string, include, exclude []document.ScopeOrigin) ([]document.ScopeOrigin, error) {
	def := contexts.Definition{Includes: toContextRefs(include), Excludes: toContextRefs(exclude)}
	leaves, err := r.contexts.Resolve(projectID, def)
	if err != nil {
		return nil, err
	}
	out := make([]document.ScopeOrigin, 0, len(leaves))
	for _, l := range leaves {
		out = append(out, document.ScopeOrigin{Kind: l.Kind, ID: l.ID})
	}
	return out, nil
}

// documentScopeReferences adapts the contexts capability to
// document.ScopeReferences: it delegates to (*contexts.Contexts).References,
// the seam that lets DependentPrompts see a change reached THROUGH a context
// (deep cascade) rather than only a block's direct scope origins.
type documentScopeReferences struct{ contexts *contexts.Contexts }

func (r documentScopeReferences) ContextReferences(projectID, contextID string, origin document.ScopeOrigin) (bool, error) {
	return r.contexts.References(projectID, contextID, origin.Kind, origin.ID)
}

func toContextRefs(origins []document.ScopeOrigin) []contexts.Ref {
	out := make([]contexts.Ref, 0, len(origins))
	for _, o := range origins {
		out = append(out, contexts.Ref{Kind: o.Kind, ID: o.ID})
	}
	return out
}
```
