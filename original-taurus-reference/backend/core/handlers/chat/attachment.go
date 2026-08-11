package chat

import (
	"encoding/base64"
	"errors"
	"net/http"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	chatcap "github.com/gccurtis/taurus-omega/core/capability/chat"
	filecap "github.com/gccurtis/taurus-omega/core/capability/file"
	"github.com/gccurtis/taurus-omega/core/endpoint"
	"github.com/gccurtis/taurus-omega/core/platform/limit"
)

// CodeTooManyFiles is the stable identity of the directory-manifest count bound.
// It is enforced here rather than in a capability because the bound is on the shape
// of one request — how many files a single upload may carry — and nothing below the
// transport ever sees the manifest as a unit.
const CodeTooManyFiles = "attachment_directory_too_many_files"

// fileUpload is one uploaded file (base64-encoded content), matching the file
// capability's JSON upload shape.
type fileUpload struct {
	Name         string `json:"name"`
	ContentType  string `json:"contentType"`
	Content      string `json:"content"` // base64
	RelativePath string `json:"relativePath,omitempty"`
}

// AddAttachment attaches a single file or a directory manifest to a chat. A
// single file is `{name, contentType, content}`; a directory manifest is
// `{directory: [{relativePath, name, contentType, content}]}` whose files share
// one directory-upload id.
func (h Handlers) AddAttachment(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot add attachments")
	}
	if h.files == nil {
		return errResp(http.StatusNotImplemented, "attachments are not configured")
	}
	var in struct {
		fileUpload
		Directory []fileUpload `json:"directory,omitempty"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	chatID := req.Param("chatID")
	fscope := filecap.Scope{ProjectID: ctx.Project.ID}
	cscope := chatcap.Scope{ProjectID: ctx.Project.ID}

	if len(in.Directory) > 0 {
		if h.maxDirectoryFiles > 0 && len(in.Directory) > h.maxDirectoryFiles {
			// Answers with the count and the cap, not just "too many": a client that
			// knows the bound can tell someone which files to leave out.
			e := &limit.Exceeded{
				Code:    CodeTooManyFiles,
				Message: "too many files in the directory upload",
				Limit:   int64(h.maxDirectoryFiles),
				Actual:  int64(len(in.Directory)),
			}
			return endpoint.Response{Status: http.StatusRequestEntityTooLarge, Body: e.Body(), Err: e}
		}
		dirID := newDirectoryUploadID()
		out := make([]chatcap.Attachment, 0, len(in.Directory))
		for _, entry := range in.Directory {
			att, resp := h.storeOne(ctx, fscope, cscope, chatID, chatcap.AttachmentDirectory, entry, dirID)
			if resp != nil {
				return *resp
			}
			out = append(out, att)
		}
		return endpoint.Response{Status: http.StatusCreated, Body: map[string]any{"attachments": out}}
	}

	att, resp := h.storeOne(ctx, fscope, cscope, chatID, chatcap.AttachmentFile, in.fileUpload, "")
	if resp != nil {
		return *resp
	}
	return endpoint.Response{Status: http.StatusCreated, Body: att}
}

// storeOne uploads one file's bytes and records the attachment; it returns a
// response pointer when something fails so the caller can short-circuit.
func (h Handlers) storeOne(ctx access.Context, fscope filecap.Scope, cscope chatcap.Scope, chatID, kind string, up fileUpload, dirID string) (chatcap.Attachment, *endpoint.Response) {
	content, err := base64.StdEncoding.DecodeString(up.Content)
	if err != nil {
		r := errResp(http.StatusBadRequest, "content must be base64")
		return chatcap.Attachment{}, &r
	}
	f, err := h.files.Upload(fscope, up.Name, up.ContentType, content, ctx.User.ID, ctx.User.Name)
	if err != nil {
		r := fileErr(err)
		return chatcap.Attachment{}, &r
	}
	att, err := h.chats.AddAttachment(cscope, chatID, kind, chatcap.AttachmentInput{
		FileID: f.ID, Name: up.Name, RelativePath: up.RelativePath, DirectoryUploadID: dirID,
	})
	if err != nil {
		r := chatErr(err)
		return chatcap.Attachment{}, &r
	}
	return att, nil
}

// ListAttachments returns a chat's attachments.
func (h Handlers) ListAttachments(ctx access.Context, req endpoint.Request) endpoint.Response {
	if h.files == nil {
		return errResp(http.StatusNotImplemented, "attachments are not configured")
	}
	atts, err := h.chats.Attachments(chatcap.Scope{ProjectID: ctx.Project.ID}, req.Param("chatID"))
	if err != nil {
		return chatErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"attachments": atts}}
}

// DeleteAttachment removes one attachment from a chat.
func (h Handlers) DeleteAttachment(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot remove attachments")
	}
	if h.files == nil {
		return errResp(http.StatusNotImplemented, "attachments are not configured")
	}
	err := h.chats.DeleteAttachment(chatcap.Scope{ProjectID: ctx.Project.ID}, req.Param("chatID"), req.Param("attachmentID"))
	if err != nil {
		return chatErr(err)
	}
	return endpoint.Response{Status: http.StatusNoContent}
}

func fileErr(err error) endpoint.Response {
	// The same limit, answered the same way as on the file routes. It used to say
	// "file is too large" here and "file: content exceeds the maximum size" there —
	// one bound, two messages, neither naming the bound.
	if e, ok := limit.From(err); ok {
		return endpoint.Response{Status: http.StatusRequestEntityTooLarge, Body: e.Body(), Err: err}
	}
	switch {
	case errors.Is(err, filecap.ErrInvalid):
		return endpoint.Response{Status: http.StatusBadRequest, Body: map[string]any{"error": err.Error()}, Err: err}
	default:
		return endpoint.Response{
			Status: http.StatusInternalServerError,
			Body:   map[string]any{"error": "file upload failed"},
			Err:    err,
		}
	}
}

func newDirectoryUploadID() string { return chatcap.NewDirectoryUploadID() }
