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
