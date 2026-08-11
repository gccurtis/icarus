package wiring

import (
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/connector"
	"github.com/gccurtis/taurus-omega/core/capability/resource"
)

// TestResourceCatalogExistsHandlesEveryNotUsableOutcome builds a real catalog
// with only the connector family registered, so "spreadsheet" is a known
// vocabulary kind with no registered family (resource.ErrUnavailableKind),
// "bogus-kind" is outside the vocabulary entirely (resource.ErrUnknownKind),
// and a made-up connector id is a registered kind with no matching row
// (resource.ErrNotFound). All three are "this member doesn't exist" from the
// context capability's point of view, so Exists must report (false, nil) for
// each rather than surfacing any of them as an error.
func TestResourceCatalogExistsHandlesEveryNotUsableOutcome(t *testing.T) {
	conns := connector.New(connector.NewMemoryStore(nil))
	res, err := resource.New(connectorResourceFamily{connectors: conns})
	if err != nil {
		t.Fatalf("resource.New: %v", err)
	}
	rc := resourceCatalog{resources: res}

	if ok, err := rc.Exists("p", "spreadsheet", "x"); ok || err != nil {
		t.Fatalf("spreadsheet (unavailable kind): Exists = %v, %v; want false, nil", ok, err)
	}
	if ok, err := rc.Exists("p", "bogus-kind", "x"); ok || err != nil {
		t.Fatalf("bogus-kind (unknown kind): Exists = %v, %v; want false, nil", ok, err)
	}
	if ok, err := rc.Exists("p", "connector", "nonexistent-id"); ok || err != nil {
		t.Fatalf("connector nonexistent-id (not found): Exists = %v, %v; want false, nil", ok, err)
	}
}
