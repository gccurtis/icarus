package document

import "strings"

// OutgoingLink is one inline hyperlink a document contains: the href it points
// at, plus the id of the block the link sits in — a stable anchor the reference
// graph and UI can use to locate the link. The reference capability resolves the
// href to an in-project resource (external URLs and dangling links are dropped).
type OutgoingLink struct {
	Href   string
	Anchor string
}

// ReferenceIndexer records a document's current outgoing links so the reference
// graph — and the backlinks it answers — stay current. The composition root
// supplies it over the reference capability; when nil, extraction is skipped.
type ReferenceIndexer interface {
	ReindexDocument(projectID, documentID string, links []OutgoingLink) error
}

// extractOutgoingLinks walks a resolved base and returns each distinct inline
// link mark as an OutgoingLink anchored at the block that carries it.
func extractOutgoingLinks(base Base) []OutgoingLink {
	var links []OutgoingLink
	seen := map[string]bool{}
	visit := func(rows []Row) {
		for _, r := range rows {
			for _, b := range r.Blocks {
				for _, m := range b.Marks {
					if m.Kind != MarkKindLink {
						continue
					}
					href := strings.TrimSpace(m.Attrs["href"])
					if href == "" {
						continue
					}
					key := b.ID + "\x00" + href
					if seen[key] {
						continue
					}
					seen[key] = true
					links = append(links, OutgoingLink{Href: href, Anchor: b.ID})
				}
			}
		}
	}
	visit(base.Rows)
	visit(base.Header)
	visit(base.Footer)
	return links
}

// reindexReferences hands the document's current links to the configured
// indexer. It is best-effort: the reference graph is a derived projection, so an
// indexing failure never fails the mutation that produced the new content.
func (d *Documents) reindexReferences(projectID, documentID string, base Base) {
	if d.referenceIndexer == nil {
		return
	}
	_ = d.referenceIndexer.ReindexDocument(projectID, documentID, extractOutgoingLinks(base))
}
