// Document <-> reference adapters.
//
// The document service and the reference graph point at each other: a document
// reindexes its links after every edit, and resolving those links reads
// documents back. Both directions are bridged here so neither capability
// imports the other, and the construction cycle is broken by a late-bound
// indexer.
package wiring

import (
	"errors"
	"strings"

	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/capability/reference"
)

// lazyReferenceIndexer adapts the document ReferenceIndexer port to the
// reference service, converting the document's outgoing links to reference
// LinkRefs. Its target is set once the reference service is built, which breaks
// the construction cycle between documents and references; until then, and so
// documents never imports reference, indexing is a no-op.
type lazyReferenceIndexer struct{ refs *reference.References }

func (l *lazyReferenceIndexer) ReindexDocument(projectID, documentID string, links []document.OutgoingLink) error {
	if l.refs == nil {
		// Between construction and the back-patch below this indexer has no target.
		// Nothing calls it in that window today (Run finishes wiring before the
		// listener starts), but returning nil here would silently drop a document's
		// links if that ever changed — so report it instead of losing it quietly.
		return errors.New("wiring: reference indexer used before it was bound")
	}
	refLinks := make([]reference.LinkRef, len(links))
	for i, ln := range links {
		refLinks[i] = reference.LinkRef{Href: ln.Href, Anchor: ln.Anchor}
	}
	return l.refs.ReindexDocument(reference.Scope{ProjectID: projectID}, documentID, refLinks)
}

// documentResolver satisfies the reference Resolver port over the document
// service: it maps a link href to an in-project document and resolves current
// document names. External URLs and hrefs that name no document do not resolve,
// so those links are dropped from the graph.
type documentResolver struct{ docs *document.Documents }

func (r documentResolver) Resolve(projectID, href string) (kind, id, name string, ok bool) {
	candidate := normalizeDocumentHref(href)
	if candidate == "" {
		return "", "", "", false
	}
	sum, err := r.docs.Summary(projectID, candidate)
	if err != nil {
		return "", "", "", false
	}
	return reference.KindDocument, sum.ID, sum.Name, true
}

func (r documentResolver) Name(projectID, kind, id string) (string, bool) {
	if kind != reference.KindDocument {
		return "", false
	}
	sum, err := r.docs.Summary(projectID, id)
	if err != nil {
		return "", false
	}
	return sum.Name, true
}

// normalizeDocumentHref reduces an inline link href to a candidate document id.
// It recognizes the internal link forms the editor emits and rejects external
// schemes; the caller confirms the candidate actually names a document.
func normalizeDocumentHref(href string) string {
	h := strings.TrimSpace(href)
	if h == "" {
		return ""
	}
	switch {
	case strings.HasPrefix(h, "http://"), strings.HasPrefix(h, "https://"),
		strings.HasPrefix(h, "mailto:"), strings.HasPrefix(h, "tel:"):
		return ""
	}
	for _, prefix := range []string{"taurus://document/", "document://", "document:"} {
		if rest, found := strings.CutPrefix(h, prefix); found {
			return rest
		}
	}
	if i := strings.LastIndex(h, "/documents/"); i >= 0 {
		return h[i+len("/documents/"):]
	}
	return h
}
