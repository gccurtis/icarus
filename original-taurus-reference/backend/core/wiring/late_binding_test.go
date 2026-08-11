package wiring

import (
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/document"
)

// TestLazyReferenceIndexerReportsUnwiredUse pins half of DEF-4. The document ↔
// reference construction cycle is broken by handing the document service an
// empty indexer and back-patching it once references exists. Until this change
// an unwired indexer silently returned nil, so a document saved in that window
// would drop its links with no trace. Unwired use must be reported, not ignored.
func TestLazyReferenceIndexerReportsUnwiredUse(t *testing.T) {
	var indexer lazyReferenceIndexer // the state it has between construction and back-patch
	err := indexer.ReindexDocument("proj", "doc", []document.OutgoingLink{{Href: "/d/other"}})
	if err == nil {
		t.Fatal("unwired reference indexer returned nil — a dropped link index would be invisible")
	}
}
