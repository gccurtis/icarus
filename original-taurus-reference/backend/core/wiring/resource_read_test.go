package wiring

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/connector"
	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/capability/file"
	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	"github.com/gccurtis/taurus-omega/core/capability/resource"
)

func TestDocumentResourceReadUsesCurrentCanonicalDocumentWithoutKnowledge(t *testing.T) {
	docs := document.New(document.NewMemoryStore(), document.Options{})
	doc, err := docs.Create("p", "Unindexed", document.Base{Rows: []document.Row{{Blocks: []document.Block{{Atoms: []document.Atom{{Text: "current text"}}}}}}}, document.Actor{ID: "owner"})
	if err != nil {
		t.Fatal(err)
	}
	resources, err := resource.New(documentResourceFamily{documents: docs})
	if err != nil {
		t.Fatal(err)
	}
	out, err := resource.NewToolSource(resources).ReadTool(resource.ProjectScope{ProjectID: "p", CallerID: "owner"}).Handler(context.Background(), json.RawMessage(`{"name":"Unindexed","kind":"document"}`))
	if err != nil {
		t.Fatal(err)
	}
	var result struct {
		Version    string `json:"version"`
		Text       string `json:"text"`
		Provenance struct {
			Origin string `json:"origin"`
		} `json:"provenance"`
	}
	if err := json.Unmarshal(out, &result); err != nil {
		t.Fatal(err)
	}
	if result.Version != "0" || result.Text != "current text\n" || result.Provenance.Origin != "direct" {
		t.Fatalf("direct document result = %s", out)
	}
	if err := docs.Delete("p", doc.ID, document.Actor{ID: "owner"}); err != nil {
		t.Fatal(err)
	}
	_, err = resource.NewToolSource(resources).ReadTool(resource.ProjectScope{ProjectID: "p", CallerID: "owner"}).Handler(context.Background(), json.RawMessage(`{"resourceId":"`+doc.ID+`"}`))
	var toolErr *intelligence.ToolError
	if !errors.As(err, &toolErr) || toolErr.Code != "resource.trashed" {
		t.Fatalf("trashed read error = %v", err)
	}
}

func TestFileResourceReadsUnindexedTextAndRejectsBinary(t *testing.T) {
	files, err := file.New(file.NewMemoryStore(), 0)
	if err != nil {
		t.Fatal(err)
	}
	text, err := files.Upload(file.Scope{ProjectID: "p"}, "notes.txt", "text/plain", []byte("unindexed attachment\n"), "owner", "Owner")
	if err != nil {
		t.Fatal(err)
	}
	binary, err := files.Upload(file.Scope{ProjectID: "p"}, "scan.pdf", "application/pdf", []byte("%PDF"), "owner", "Owner")
	if err != nil {
		t.Fatal(err)
	}
	resources, err := resource.New(fileResourceFamily{files: files})
	if err != nil {
		t.Fatal(err)
	}
	tool := resource.NewToolSource(resources).ReadTool(resource.ProjectScope{ProjectID: "p", CallerID: "owner"})
	out, err := tool.Handler(context.Background(), json.RawMessage(`{"resourceId":"`+text.ID+`","kind":"file"}`))
	if err != nil || !strings.Contains(string(out), "unindexed attachment") {
		t.Fatalf("unindexed file read = %s, %v", out, err)
	}
	_, err = tool.Handler(context.Background(), json.RawMessage(`{"resourceId":"`+binary.ID+`","kind":"file"}`))
	var toolErr *intelligence.ToolError
	if !errors.As(err, &toolErr) || toolErr.Code != "resource.content_not_textual" {
		t.Fatalf("binary file read error = %v", err)
	}
}

type pointReadProvider struct {
	content       string
	snapshotCalls int
	openCalls     int
}

func (p *pointReadProvider) Snapshot() (connector.Snapshot, error) {
	p.snapshotCalls++
	return connector.Snapshot{}, nil
}

func (p *pointReadProvider) OpenItem(_ context.Context, _ connector.AuthorizedBinding, itemID, expectedVersion string) (io.ReadCloser, connector.ItemMeta, error) {
	p.openCalls++
	if itemID != "provider-item-7" {
		return nil, connector.ItemMeta{}, connector.ErrNotFound
	}
	sum := sha256.Sum256([]byte(p.content))
	version := hex.EncodeToString(sum[:])
	if expectedVersion != "" && expectedVersion != version {
		return nil, connector.ItemMeta{}, connector.ErrVersionChanged
	}
	return io.NopCloser(strings.NewReader(p.content)), connector.ItemMeta{Version: version, ContentHash: version}, nil
}

func TestConnectorResourceReadUsesPointReaderWithoutSnapshot(t *testing.T) {
	provider := &pointReadProvider{content: "connector current content\n"}
	connectors := connector.NewWithSync(connector.NewMemoryStore(nil), func(connector.Connector) (connector.Provider, error) { return provider, nil }, nil)
	conn, err := connectors.Create("p", connector.Actor{ID: "owner"}, "Drive", connector.SubKindLocalFolder)
	if err != nil {
		t.Fatal(err)
	}
	resources, err := resource.New(connectorResourceFamily{connectors: connectors})
	if err != nil {
		t.Fatal(err)
	}
	out, err := resource.NewToolSource(resources).ReadTool(resource.ProjectScope{ProjectID: "p", CallerID: "owner"}).Handler(context.Background(), json.RawMessage(`{"resourceId":"`+conn.ID+`","kind":"connector","subpath":"provider-item-7"}`))
	if err != nil || !strings.Contains(string(out), "connector current content") {
		t.Fatalf("connector point read = %s, %v", out, err)
	}
	if provider.openCalls != 1 || provider.snapshotCalls != 0 {
		t.Fatalf("point read calls: opens=%d snapshots=%d", provider.openCalls, provider.snapshotCalls)
	}
}
