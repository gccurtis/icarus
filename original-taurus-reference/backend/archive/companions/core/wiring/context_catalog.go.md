# context_catalog.go

Adapts the unified resource catalog to `contexts.Catalog`. `resourceCatalog` implements `AllResources(projectID) ([]contexts.Ref, error)` by paging through `*resource.Resources.List` (200 at a time, following `NextCursor`), projecting each `resource.Summary` into a `contexts.Ref`, and skipping context resources themselves (`string(s.Kind) == contexts.KindContext`) since whole-project expansion is content, not organization. It also implements `Exists(projectID, kind, id) (bool, error)` — the member-existence check `contexts.Contexts.validateMembersExist` calls — over `*resource.Resources.Get`, treating an unknown kind, an unavailable (known-but-unregistered) kind, and a missing resource all as "does not exist" rather than an error. This keeps the `contexts` and `resource` capabilities independent — the composition lives here in wiring. See repo conventions (AGENTS.md).

## Code breakdown

```go
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
```

`Exists` reuses `*resource.Resources.Get` — the same one-resource lookup
`AllResources` never needs, since it only cares about whole pages — passing
the member's `kind` string straight through as `resource.Kind(kind)`. `Get`
itself validates the kind against the catalog's closed vocabulary before
routing to a family, so three distinct "not usable" outcomes all fold into a
plain `false, nil`: a member kind the catalog has never heard of surfaces
`resource.ErrUnknownKind`; a kind that *is* in the closed vocabulary but has
no family registered in this deployment's wiring (e.g. `spreadsheet` when
only `document`/`connector` are wired) surfaces `resource.ErrUnavailableKind`
— a resource of that kind cannot exist as a usable member here regardless of
id, so it is "does not exist," not a server error; and a member id the owning
family doesn't have surfaces `resource.ErrNotFound`. "Not found" is not an
error condition for an existence check, it is the expected answer for a bad
reference. Any other error (a real storage failure) propagates as `false,
err` so `validateMembersExist` can distinguish "this member doesn't exist"
from "the catalog couldn't tell me."
