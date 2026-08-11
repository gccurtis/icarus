package wiring

import (
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/connector"
	"github.com/gccurtis/taurus-omega/core/capability/resource"
)

func TestConnectorFamilyRoundTripsThroughCatalog(t *testing.T) {
	conns := connector.New(connector.NewMemoryStore(nil))
	res, err := resource.New(connectorResourceFamily{connectors: conns})
	if err != nil {
		t.Fatalf("resource.New: %v", err)
	}

	available := res.AvailableKinds()
	if len(available) != 1 || available[0] != resource.KindConnector {
		t.Fatalf("availableKinds = %v; want [connector]", available)
	}

	made, err := res.Create("p", resource.Actor{ID: "u1", Name: "Ada"}, resource.KindConnector, "Sales drive")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if made.Kind != resource.KindConnector || made.Name != "Sales drive" || made.CreatorID != "u1" {
		t.Fatalf("created summary = %+v", made)
	}

	got, err := res.Get("p", resource.KindConnector, made.ID)
	if err != nil || got.ID != made.ID || got.Name != "Sales drive" {
		t.Fatalf("Get = %+v, %v", got, err)
	}

	page, err := res.List("p", resource.PageRequest{})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(page.Resources) != 1 || page.Resources[0].ID != made.ID || page.Resources[0].Kind != resource.KindConnector {
		t.Fatalf("List = %+v", page.Resources)
	}
}
