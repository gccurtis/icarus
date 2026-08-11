package wiring

import (
	"context"
	"errors"
	"sort"

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
		summary := connectorSummary(c)
		if before != nil && !resourceSummaryAfter(summary, *before) {
			continue
		}
		out = append(out, summary)
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].UpdatedAt.Equal(out[j].UpdatedAt) {
			return out[i].UpdatedAt.After(out[j].UpdatedAt)
		}
		return out[i].ID < out[j].ID
	})
	if len(out) > limit {
		out = out[:limit]
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

// OpenProjection reads one provider item directly. A connector is a catalog
// resource, while Subpath is the provider-owned item identity supplied by a
// Knowledge locator or an explicit caller choice; it never snapshots a whole
// connector just to open that item.
func (f connectorResourceFamily) OpenProjection(ctx context.Context, scope resource.ProjectScope, locator resource.ResourceLocator, req resource.ProjectionRequest) (resource.VersionedProjection, error) {
	if locator.Subpath == "" || locator.Subpath != req.Subpath || (locator.Projection != "" && locator.Projection != "text") {
		return resource.VersionedProjection{}, resource.ErrProjectionUnsupported
	}
	rc, meta, err := f.connectors.OpenItem(ctx, scope.ProjectID, locator.ResourceID, locator.Subpath, req.ExpectedVersion)
	if errors.Is(err, connector.ErrNotFound) {
		return resource.VersionedProjection{}, resource.ErrOriginGone
	}
	if errors.Is(err, connector.ErrVersionChanged) {
		return resource.VersionedProjection{}, resource.ErrVersionChanged
	}
	if errors.Is(err, connector.ErrPointRead) || errors.Is(err, connector.ErrInvalidPath) {
		return resource.VersionedProjection{}, resource.ErrProjectionUnsupported
	}
	if err != nil {
		return resource.VersionedProjection{}, resource.ErrOriginUnavailable
	}
	return resource.VersionedProjection{
		Version:     meta.Version,
		ContentHash: meta.ContentHash,
		MediaType:   "text/plain; charset=utf-8",
		Text:        rc,
	}, nil
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
