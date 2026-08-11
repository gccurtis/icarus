package wiring

import (
	"errors"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/file"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/platform/limit"
)

func TestAttachmentKnowledgeAdmissionUsesTheSameSourceByteLimit(t *testing.T) {
	files, err := file.New(file.NewMemoryStore(), 1024)
	if err != nil {
		t.Fatal(err)
	}
	f, err := files.Upload(file.Scope{ProjectID: "p"}, "notes.txt", "text/plain", []byte(strings.Repeat("x", 32)), "u", "User")
	if err != nil {
		t.Fatal(err)
	}
	know := knowledge.New(knowledge.NewMemoryStore(), noopEmbedder{dim: 8}, knowledge.Options{MaxSourceBytes: 16})
	err = (attachmentLatticeWriter{know: know, files: files}).IndexAttachment("p", "attachment/1", f.Name, f.ID)
	if !errors.Is(err, knowledge.ErrSourceBytesLimit) {
		t.Fatalf("IndexAttachment error = %v, want source byte refusal", err)
	}
	e, ok := limit.From(err)
	if !ok || e.Code != knowledge.CodeSourceBytesLimit || e.Limit != 16 || e.Actual != 32 {
		t.Fatalf("limit = %#v, want the attachment's typed source limit", e)
	}
}
