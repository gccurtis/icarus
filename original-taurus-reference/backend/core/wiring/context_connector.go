package wiring

import (
	"strings"

	"github.com/gccurtis/taurus-omega/core/capability/connector"
	"github.com/gccurtis/taurus-omega/core/capability/contexts"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

// connectorFilesCatalog adapts the knowledge lattice to contexts.ConnectorFiles:
// it expands a connector member to its current file origins by listing every
// lattice source stored under that connector's file-source-id prefix (Task 4's
// connectorID+FileSeparator convention). The separator is applied here in
// wiring, not in contexts, which never imports connector or knowledge.
//
// A connector-kind leaf (one already-synced file) shares its parent connector's
// Kind ("connector"), so contexts.expand's connector case re-queries an
// Excludes entry that names a single file directly the very same way it
// queries a connector root — FilesUnder("X/a") gets called just like
// FilesUnder("X") would. When connectorID names no children, FilesUnder falls
// back to an exact match so that ref still resolves to itself, which is what
// makes leaf-level exclusion of one file inside a connector work the same way
// leaf-level exclusion already works for every other resource kind.
type connectorFilesCatalog struct{ know *knowledge.Knowledge }

func (a connectorFilesCatalog) FilesUnder(projectID, connectorID string) ([]contexts.Ref, error) {
	origins, err := a.know.SourcesUnder(projectID, knowledge.SourceTypeConnector, connectorID)
	if err != nil {
		return nil, err
	}
	prefix := connectorID + connector.FileSeparator
	var out []contexts.Ref
	for _, o := range origins {
		if o.SourceID == connectorID || strings.HasPrefix(o.SourceID, prefix) {
			out = append(out, contexts.Ref{Kind: contexts.KindConnector, ID: o.SourceID})
		}
	}
	return out, nil
}
