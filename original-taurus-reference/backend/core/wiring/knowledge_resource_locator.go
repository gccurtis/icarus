package wiring

import (
	"strings"

	"github.com/gccurtis/taurus-omega/core/capability/chat"
	"github.com/gccurtis/taurus-omega/core/capability/connector"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

// knowledgeResourceLocatorResolver is composition-only because mapping a
// lattice origin to a Resource crosses ownership boundaries. It deliberately
// declines origins without a current Resource family; Knowledge evidence must
// never fabricate a readable resource.
type knowledgeResourceLocatorResolver struct{ chats *chat.Chats }

func (r knowledgeResourceLocatorResolver) ResolveResourceLocator(_ string, source knowledge.Source) (knowledge.ResourceLocator, bool) {
	switch source.SourceType {
	case knowledge.SourceTypeDocument:
		return knowledge.ResourceLocator{ResourceID: source.SourceID, Kind: "document", Projection: "text"}, true
	case knowledge.SourceTypeConnector:
		connectorID, _, found := strings.Cut(source.SourceID, connector.FileSeparator)
		if !found || connectorID == "" || source.Label == "" {
			return knowledge.ResourceLocator{}, false
		}
		return knowledge.ResourceLocator{ResourceID: connectorID, Kind: "connector", Subpath: source.Label, Projection: "text"}, true
	case knowledge.SourceTypeAttachment:
		if r.chats == nil {
			return knowledge.ResourceLocator{}, false
		}
		fileID, found, err := r.chats.AttachmentFileBySourceID(chat.Scope{ProjectID: source.ProjectID}, source.SourceID)
		if err != nil || !found {
			return knowledge.ResourceLocator{}, false
		}
		return knowledge.ResourceLocator{ResourceID: fileID, Kind: "file", Projection: "text"}, true
	default:
		return knowledge.ResourceLocator{}, false
	}
}
