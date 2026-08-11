# resource_connector.go

Adapts the canonical connector owner to the unified Resource catalog, mirroring `resource_document.go`. `connectorResourceFamily` implements `resource.Family` by delegating to `*connector.Connectors`, projecting each connector into the shared `resource.Summary` (the provider subkind and config stay on the connector capability's own routes). Errors are mapped to the catalog's `ErrNotFound`/`ErrInvalidName`. This keeps the `connector` and `resource` capabilities independent — the composition lives here in wiring. See repo conventions (AGENTS.md).

## Code breakdown

```go
package wiring

import (
	"errors"

	"github.com/gccurtis/taurus-omega/core/capability/connector"
	"github.com/gccurtis/taurus-omega/core/capability/resource"
)

// connectorResourceFamily adapts the canonical connector owner to the unified
// Resource catalog without either capability importing the other. A connector's
// provider subkind and config live on the connector capability's own routes; the
// catalog carries only the shared summary fields.
type connectorResourceFamily struct{ connectors *connector.Connectors }

func (f connectorResourceFamily) Kind() resource.Kind { return resource.KindConnector }

func (f connectorResourceFamily) List(projectID string, before *resource.Boundary, limit int) ([]resource.Summary, error) {
	items, err := f.connectors.Summaries(projectID)
	if err != nil {
		return nil, err
	}
	out := make([]resource.Summary, 0, len(items))
	for _, c := range items {
		out = append(out, connectorSummary(c))
	}
	return out, nil
}

func (f connectorResourceFamily) Get(projectID, id string) (resource.Summary, error) {
	c, err := f.connectors.Get(projectID, id)
	if err != nil {
		return resource.Summary{}, mapConnectorResourceError(err)
	}
	return connectorSummary(c), nil
}

func (f connectorResourceFamily) Create(projectID string, actor resource.Actor, name string) (resource.Summary, error) {
	c, err := f.connectors.Create(projectID, connector.Actor{ID: actor.ID, Name: actor.Name}, name, connector.SubKindLocalFolder)
	return connectorSummary(c), mapConnectorResourceError(err)
}

func (f connectorResourceFamily) Rename(projectID string, actor resource.Actor, id, name string) (resource.Summary, error) {
	c, err := f.connectors.Rename(projectID, connector.Actor{ID: actor.ID, Name: actor.Name}, id, name)
	return connectorSummary(c), mapConnectorResourceError(err)
}

func (f connectorResourceFamily) Delete(projectID string, actor resource.Actor, id string) error {
	return mapConnectorResourceError(f.connectors.Delete(projectID, connector.Actor{ID: actor.ID, Name: actor.Name}, id))
}

func connectorSummary(c connector.Connector) resource.Summary {
	return resource.Summary{
		ID: c.ID, Kind: resource.KindConnector, Name: c.Name,
		CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt, CreatorID: c.CreatorID,
	}
}

func mapConnectorResourceError(err error) error {
	switch {
	case errors.Is(err, connector.ErrNotFound):
		return resource.ErrNotFound
	case errors.Is(err, connector.ErrInvalidName):
		return resource.ErrInvalidName
	default:
		return err
	}
}
```
