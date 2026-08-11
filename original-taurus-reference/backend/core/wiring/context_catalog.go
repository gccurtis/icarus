package wiring

import (
	"errors"

	"github.com/gccurtis/taurus-omega/core/capability/contexts"
	"github.com/gccurtis/taurus-omega/core/capability/resource"
)

// resourceCatalog adapts the unified resource catalog to contexts.Catalog: it
// enumerates every leaf resource in a project (paging through the catalog) for
// whole-project expansion, omitting context resources themselves (organization,
// not content). Keeps the contexts and resource capabilities independent.
type resourceCatalog struct{ resources *resource.Resources }

func (c resourceCatalog) AllResources(projectID string) ([]contexts.Ref, error) {
	var out []contexts.Ref
	req := resource.PageRequest{Limit: 200}
	for {
		page, err := c.resources.List(projectID, req)
		if err != nil {
			return nil, err
		}
		for _, s := range page.Resources {
			if string(s.Kind) == contexts.KindContext {
				continue
			}
			out = append(out, contexts.Ref{Kind: string(s.Kind), ID: s.ID, Name: s.Name})
		}
		if page.NextCursor == "" {
			break
		}
		req.Cursor = page.NextCursor
	}
	return out, nil
}

func (c resourceCatalog) Exists(projectID, kind, id string) (bool, error) {
	if _, err := c.resources.Get(projectID, resource.Kind(kind), id); err != nil {
		if errors.Is(err, resource.ErrNotFound) ||
			errors.Is(err, resource.ErrUnknownKind) ||
			errors.Is(err, resource.ErrUnavailableKind) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}
