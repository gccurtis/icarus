package agent

import (
	"context"
	"encoding/json"

	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
)

// Attachments is the narrow port Ask needs to report what a conversation has
// attached. It exists because Resource catalog listing is Project-wide while a
// user asking about "the attached file" means this conversation's subset.
// A model asked about "the file I attached" would then correctly report no such
// source, which reads as the upload having failed.
//
// This port lists every attachment, indexed or not, and says which is which. A
// model can then tell the user their spreadsheet is attached but unreadable,
// instead of denying it exists.
type Attachments interface {
	// ChatAttachments returns the attachments on one chat within a Project. Each
	// carries its stable File Resource id even when it was not indexed.
	ChatAttachments(projectID, chatID string) ([]AttachmentRef, error)
}

// AttachmentRef is one attachment as the model sees it: what it is called, and
// whether its content can actually be reached.
type AttachmentRef struct {
	Name string
	// RelativePath is set for a file uploaded as part of a directory.
	RelativePath string
	// ResourceID is the stable File Resource id. It never depends on Knowledge
	// admission and is passed directly to resource.read.
	ResourceID string
	// Readable reports whether the File family supports its text projection.
	Readable bool
}

const (
	attachmentListToolName    = "chat.attachments.list"
	attachmentListToolVersion = "v1"
)

var (
	attachmentListInputSchema  = json.RawMessage(`{"type":"object","properties":{},"additionalProperties":false}`)
	attachmentListOutputSchema = json.RawMessage(`{
		"type":"object",
		"properties":{
			"attachments":{"type":"array"},
			"total":{"type":"integer"}
		},
		"required":["attachments","total"],
		"additionalProperties":false
	}`)
)

type listedAttachment struct {
	Name       string `json:"name"`
	ResourceID string `json:"resourceId"`
	Kind       string `json:"kind"`
	// Readable states plainly whether the content can be reached, so the model
	// never has to infer it from a missing field.
	Readable bool `json:"readable"`
}

// attachmentListTool binds the attachment listing to one trusted conversation.
// The Project and chat are closed over rather than accepted from the model, so
// a call can never enumerate another conversation's uploads.
func attachmentListTool(attachments Attachments, projectID, chatID string) intelligence.ToolBinding {
	return intelligence.ToolBinding{
		Definition: intelligence.ToolDefinition{
			Name:    attachmentListToolName,
			Version: attachmentListToolVersion,
			Description: "List the files attached to this conversation, and whether each one's content has a text projection. " +
				"Read a supported attachment with resource.read using the resourceId given here.",
			InputSchema:  attachmentListInputSchema,
			OutputSchema: attachmentListOutputSchema,
		},
		Handler: func(_ context.Context, _ json.RawMessage) (json.RawMessage, error) {
			refs, err := attachments.ChatAttachments(projectID, chatID)
			if err != nil {
				return nil, err
			}
			out := struct {
				Attachments []listedAttachment `json:"attachments"`
				Total       int                `json:"total"`
			}{Attachments: make([]listedAttachment, 0, len(refs)), Total: len(refs)}
			for _, ref := range refs {
				name := ref.RelativePath
				if name == "" {
					name = ref.Name
				}
				item := listedAttachment{Name: name, ResourceID: ref.ResourceID, Kind: "file", Readable: ref.Readable}
				out.Attachments = append(out.Attachments, item)
			}
			return json.Marshal(out)
		},
	}
}
