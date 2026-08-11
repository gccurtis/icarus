package wiring

import (
	"strings"

	doc "github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

// FlattenDocument is the one composition-owned textual projection shared by
// document indexing and Resource exact reading. The lattice stores retrieval
// windows over this text; Resource reads it directly from the current Document.
// Keeping the rendering here prevents citations and exact reads from drifting.
func FlattenDocument(d doc.Document) (string, []knowledge.BlockSpan) {
	var sb strings.Builder
	var blocks []knowledge.BlockSpan
	for _, row := range d.Base.Rows {
		for _, b := range row.Blocks {
			if b.Inferred {
				continue
			}
			start := sb.Len()
			sb.WriteString(b.DisplayText())
			blocks = append(blocks, knowledge.BlockSpan{RowID: row.ID, BlockID: b.ID, Start: start, End: sb.Len()})
			sb.WriteByte('\n')
		}
	}
	return sb.String(), blocks
}
