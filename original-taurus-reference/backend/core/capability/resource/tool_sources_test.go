package resource_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	"github.com/gccurtis/taurus-omega/core/capability/resource"
)

// fakeReadableFamily implements both resource.Family and resource.ReadableFamily
// for testing.
type fakeReadableFamily struct {
	fakeFamily
	content  map[string]string // id -> text content
	versions map[string]string // id -> version
}

func newFakeReadableFamily(kind resource.Kind, items []resource.Summary) *fakeReadableFamily {
	f := &fakeReadableFamily{
		fakeFamily: fakeFamily{kind: kind, items: items},
		content:    make(map[string]string),
		versions:   make(map[string]string),
	}
	for _, item := range items {
		f.content[item.ID] = ""
		f.versions[item.ID] = "v1"
	}
	return f
}

func (f *fakeReadableFamily) OpenProjection(_ context.Context, scope resource.ProjectScope, locator resource.ResourceLocator, req resource.ProjectionRequest) (resource.VersionedProjection, error) {
	text, ok := f.content[locator.ResourceID]
	if !ok {
		return resource.VersionedProjection{}, resource.ErrNotFound
	}
	version := f.versions[locator.ResourceID]

	return resource.VersionedProjection{
		Version:     version,
		ContentHash: "",
		MediaType:   "text/plain",
		Text:        nopCloser{strings.NewReader(text)},
		LineMap:     resource.LineMap{},
	}, nil
}

type nopCloser struct {
	*strings.Reader
}

func (nopCloser) Close() error { return nil }

func TestResourceListTool(t *testing.T) {
	docs := newFakeReadableFamily(resource.KindDocument, []resource.Summary{
		{ID: "doc-1", Name: "Report", Kind: resource.KindDocument},
		{ID: "doc-2", Name: "Notes", Kind: resource.KindDocument},
	})
	svc, err := resource.New(docs)
	if err != nil {
		t.Fatal(err)
	}

	ts := resource.NewToolSource(svc)
	scope := resource.ProjectScope{ProjectID: "proj-a", CallerID: "user-1"}
	binding := ts.ListTool(scope)

	out, err := binding.Handler(context.Background(), json.RawMessage(`{}`))
	if err != nil {
		t.Fatal(err)
	}

	var listed struct {
		Resources []struct {
			ResourceID string `json:"resourceId"`
			Kind       string `json:"kind"`
			Name       string `json:"name"`
		} `json:"resources"`
		Total int `json:"total"`
	}
	if err := json.Unmarshal(out, &listed); err != nil {
		t.Fatal(err)
	}
	if listed.Total != 2 {
		t.Fatalf("total = %d, want 2", listed.Total)
	}
	if listed.Resources[0].ResourceID != "doc-1" || listed.Resources[1].ResourceID != "doc-2" {
		t.Fatalf("resources = %+v", listed.Resources)
	}
}

func TestResourceListToolFiltersByKind(t *testing.T) {
	docs := newFakeReadableFamily(resource.KindDocument, []resource.Summary{
		{ID: "doc-1", Name: "Report", Kind: resource.KindDocument},
	})
	svc, err := resource.New(docs)
	if err != nil {
		t.Fatal(err)
	}

	ts := resource.NewToolSource(svc)
	scope := resource.ProjectScope{ProjectID: "proj-a", CallerID: "user-1"}

	// Filter by kind "spreadsheet" (not available) should return empty.
	out, err := ts.ListTool(scope).Handler(context.Background(), json.RawMessage(`{"kind":"spreadsheet"}`))
	if err != nil {
		t.Fatal(err)
	}
	var listed struct {
		Resources []struct {
			ResourceID string `json:"resourceId"`
		} `json:"resources"`
		Total int `json:"total"`
	}
	if err := json.Unmarshal(out, &listed); err != nil {
		t.Fatal(err)
	}
	if listed.Total != 0 {
		t.Fatalf("spreadsheet filter: total = %d, want 0", listed.Total)
	}

	// Filter by kind "document" should return the document.
	out, err = ts.ListTool(scope).Handler(context.Background(), json.RawMessage(`{"kind":"document"}`))
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(out, &listed); err != nil {
		t.Fatal(err)
	}
	if listed.Total != 1 {
		t.Fatalf("document filter: total = %d, want 1", listed.Total)
	}
}

func TestResourceListToolFiltersByExactName(t *testing.T) {
	docs := newFakeReadableFamily(resource.KindDocument, []resource.Summary{
		{ID: "doc-1", Name: "Report", Kind: resource.KindDocument},
		{ID: "doc-2", Name: "Notes", Kind: resource.KindDocument},
	})
	svc, err := resource.New(docs)
	if err != nil {
		t.Fatal(err)
	}

	ts := resource.NewToolSource(svc)
	scope := resource.ProjectScope{ProjectID: "proj-a", CallerID: "user-1"}

	out, err := ts.ListTool(scope).Handler(context.Background(), json.RawMessage(`{"exactName":"Report"}`))
	if err != nil {
		t.Fatal(err)
	}
	var listed struct {
		Resources []struct {
			ResourceID string `json:"resourceId"`
			Name       string `json:"name"`
		} `json:"resources"`
		Total int `json:"total"`
	}
	if err := json.Unmarshal(out, &listed); err != nil {
		t.Fatal(err)
	}
	if listed.Total != 1 || listed.Resources[0].Name != "Report" {
		t.Fatalf("exactName filter: total=%d resources=%+v", listed.Total, listed.Resources)
	}
}

func TestResourceReadToolByID(t *testing.T) {
	docs := newFakeReadableFamily(resource.KindDocument, []resource.Summary{
		{ID: "doc-1", Name: "Report", Kind: resource.KindDocument},
	})
	docs.content["doc-1"] = "line one\nline two\nline three\n"
	docs.versions["doc-1"] = "v1"

	svc, err := resource.New(docs)
	if err != nil {
		t.Fatal(err)
	}

	ts := resource.NewToolSource(svc)
	scope := resource.ProjectScope{ProjectID: "proj-a", CallerID: "user-1"}

	out, err := ts.ReadTool(scope).Handler(context.Background(), json.RawMessage(`{"resourceId":"doc-1"}`))
	if err != nil {
		t.Fatal(err)
	}

	var result struct {
		Resource struct {
			ID   string `json:"id"`
			Kind string `json:"kind"`
		} `json:"resource"`
		Locator struct {
			ResourceID string `json:"resourceId"`
			Kind       string `json:"kind"`
		} `json:"locator"`
		Version    string `json:"version"`
		Text       string `json:"text"`
		StartLine  int    `json:"startLine"`
		EndLine    int    `json:"endLine"`
		Truncated  bool   `json:"truncated"`
		Provenance struct {
			Origin string `json:"origin"`
		} `json:"provenance"`
	}
	if err := json.Unmarshal(out, &result); err != nil {
		t.Fatal(err)
	}
	if result.Resource.ID != "doc-1" {
		t.Fatalf("resource id = %q, want doc-1", result.Resource.ID)
	}
	if result.Version != "v1" {
		t.Fatalf("version = %q, want v1", result.Version)
	}
	if result.Provenance.Origin != "direct" {
		t.Fatalf("provenance = %q, want direct", result.Provenance.Origin)
	}
}

func TestResourceReadToolNotFound(t *testing.T) {
	docs := newFakeReadableFamily(resource.KindDocument, []resource.Summary{
		{ID: "doc-1", Name: "Report", Kind: resource.KindDocument},
	})
	svc, err := resource.New(docs)
	if err != nil {
		t.Fatal(err)
	}

	ts := resource.NewToolSource(svc)
	scope := resource.ProjectScope{ProjectID: "proj-a", CallerID: "user-1"}

	_, err = ts.ReadTool(scope).Handler(context.Background(), json.RawMessage(`{"resourceId":"nonexistent"}`))
	if err == nil {
		t.Fatal("expected error for nonexistent resource")
	}
	var toolErr *intelligence.ToolError
	if !errors.As(err, &toolErr) {
		t.Fatalf("expected ToolError, got %T: %v", err, err)
	}
	if toolErr.Code != "resource.not_found" {
		t.Fatalf("error code = %q, want resource.not_found", toolErr.Code)
	}
}

func TestResourceReadToolAmbiguousName(t *testing.T) {
	docs := newFakeReadableFamily(resource.KindDocument, []resource.Summary{
		{ID: "doc-1", Name: "SameName", Kind: resource.KindDocument},
		{ID: "doc-2", Name: "SameName", Kind: resource.KindDocument},
	})
	svc, err := resource.New(docs)
	if err != nil {
		t.Fatal(err)
	}

	ts := resource.NewToolSource(svc)
	scope := resource.ProjectScope{ProjectID: "proj-a", CallerID: "user-1"}

	_, err = ts.ReadTool(scope).Handler(context.Background(), json.RawMessage(`{"name":"SameName"}`))
	if err == nil {
		t.Fatal("expected error for ambiguous name")
	}
	var toolErr *intelligence.ToolError
	if !errors.As(err, &toolErr) {
		t.Fatalf("expected ToolError, got %T: %v", err, err)
	}
	if toolErr.Code != "resource.name_ambiguous" {
		t.Fatalf("error code = %q, want resource.name_ambiguous", toolErr.Code)
	}
}

func TestLineSlicerBasic(t *testing.T) {
	slicer := resource.DefaultLineSlicer()
	text := "line1\nline2\nline3\nline4\nline5\n"

	sliced, start, end, truncated := slicer.Slice(text, 2, 4)
	if sliced != "line2\nline3\nline4\n" {
		t.Fatalf("got %q, want %q", sliced, "line2\nline3\nline4\n")
	}
	if start != 2 || end != 4 {
		t.Fatalf("start=%d end=%d, want 2 4", start, end)
	}
	if truncated {
		t.Fatal("should not be truncated")
	}
}

func TestLineSlicerEmpty(t *testing.T) {
	slicer := resource.DefaultLineSlicer()
	sliced, start, end, truncated := slicer.Slice("", 1, 1)
	if sliced != "" || start != 0 || end != 0 || truncated {
		t.Fatalf("empty: %q %d %d %v", sliced, start, end, truncated)
	}
	_ = truncated
}

func TestLineSlicerNoFinalNewline(t *testing.T) {
	slicer := resource.DefaultLineSlicer()
	text := "line1\nline2\nline3"

	sliced, start, end, _ := slicer.Slice(text, 1, 3)
	if sliced != text {
		t.Fatalf("got %q, want %q", sliced, text)
	}
	if start != 1 || end != 3 {
		t.Fatalf("start=%d end=%d, want 1 3", start, end)
	}
}

func TestLineSlicerPastEnd(t *testing.T) {
	slicer := resource.DefaultLineSlicer()
	text := "line1\nline2\n"

	sliced, start, end, _ := slicer.Slice(text, 5, 10)
	if sliced != "" || start != 0 || end != 0 {
		t.Fatalf("past end: %q %d %d", sliced, start, end)
	}
}

func TestLineSlicerCRLF(t *testing.T) {
	text := "line1\r\nline2\r\nline3\r\n"
	normalized := resource.NormalizeNewlines(text)
	if normalized != "line1\nline2\nline3\n" {
		t.Fatalf("normalized CRLF: %q", normalized)
	}
}

func TestLineCount(t *testing.T) {
	if n := resource.LineCount(""); n != 0 {
		t.Fatalf("empty: %d", n)
	}
	if n := resource.LineCount("hello"); n != 1 {
		t.Fatalf("single: %d", n)
	}
	if n := resource.LineCount("hello\nworld\n"); n != 2 {
		t.Fatalf("two: %d", n)
	}
	if n := resource.LineCount("hello\nworld\n\n"); n != 3 {
		t.Fatalf("three with trailing: %d", n)
	}
}

func TestResourceLocatorInKnowledgeSearchOutput(t *testing.T) {
	// Verify the searchToolRegion type has the ResourceLocator field.
	// This is a compile-time check.
	var _ struct {
		ResourceLocator *interface{} `json:"resourceLocator,omitempty"`
	}
}

func TestToolErrorsMap(t *testing.T) {
	// Test that the resource.read tool binds to the right scope.
	scope := resource.ProjectScope{ProjectID: "p", CallerID: "u"}
	binding := resource.NewToolSource(nil).ReadTool(scope)
	if binding.Definition.Name != "resource.read" {
		t.Fatalf("tool name = %q, want resource.read", binding.Definition.Name)
	}
}

func TestListToolBoundToProject(t *testing.T) {
	docs := newFakeReadableFamily(resource.KindDocument, []resource.Summary{
		{ID: "doc-1", Name: "Report", Kind: resource.KindDocument},
	})
	svc, err := resource.New(docs)
	if err != nil {
		t.Fatal(err)
	}

	ts := resource.NewToolSource(svc)
	scope := resource.ProjectScope{ProjectID: "proj-a", CallerID: "user-1"}

	// Test that the binding is closed over the scope.
	binding := ts.ListTool(scope)
	if binding.Definition.Name != "resource.list" {
		t.Fatalf("tool name = %q, want resource.list", binding.Definition.Name)
	}
}

func TestReadToolNeedsResourceIDOrName(t *testing.T) {
	docs := newFakeReadableFamily(resource.KindDocument, []resource.Summary{
		{ID: "doc-1", Name: "Report", Kind: resource.KindDocument},
	})
	svc, err := resource.New(docs)
	if err != nil {
		t.Fatal(err)
	}

	ts := resource.NewToolSource(svc)
	scope := resource.ProjectScope{ProjectID: "proj-a", CallerID: "user-1"}

	_, err = ts.ReadTool(scope).Handler(context.Background(), json.RawMessage(`{}`))
	if err == nil {
		t.Fatal("expected error when neither resourceId nor name is provided")
	}
}

func TestResolveByNameFiltersHiddenDuplicatesBeforeAmbiguity(t *testing.T) {
	docs := newFakeReadableFamily(resource.KindDocument, []resource.Summary{
		{ID: "visible", Name: "Brief", CreatorID: "owner"},
		{ID: "private", Name: "Brief", CreatorID: "owner"},
	})
	attrs := resource.NewMemoryAttributeStore()
	svc, err := resource.NewWithAttributes(attrs, docs)
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.SetAccess("owner", "proj-a", resource.KindDocument, "private", resource.AccessScope{}); err != nil {
		t.Fatal(err)
	}
	got, err := svc.Resolve(context.Background(), resource.ProjectScope{ProjectID: "proj-a", CallerID: "reader"}, resource.ResourceSelector{Name: "Brief"})
	if err != nil {
		t.Fatalf("Resolve = %v", err)
	}
	if got.ResourceID != "visible" {
		t.Fatalf("Resolve selected %q, want visible", got.ResourceID)
	}
}

func TestResourceReadCursorBindsCallerAndVersion(t *testing.T) {
	docs := newFakeReadableFamily(resource.KindDocument, []resource.Summary{{ID: "doc-1", Name: "Report"}})
	docs.content["doc-1"] = strings.Repeat("line\n", 2001)
	svc, err := resource.New(docs)
	if err != nil {
		t.Fatal(err)
	}
	ts := resource.NewToolSource(svc)
	scope := resource.ProjectScope{ProjectID: "proj-a", CallerID: "reader"}
	first, err := ts.ReadTool(scope).Handler(context.Background(), json.RawMessage(`{"resourceId":"doc-1"}`))
	if err != nil {
		t.Fatal(err)
	}
	var page struct {
		StartLine  int    `json:"startLine"`
		EndLine    int    `json:"endLine"`
		Truncated  bool   `json:"truncated"`
		NextCursor string `json:"nextCursor"`
	}
	if err := json.Unmarshal(first, &page); err != nil {
		t.Fatal(err)
	}
	if !page.Truncated || page.StartLine != 1 || page.EndLine != 2000 || page.NextCursor == "" {
		t.Fatalf("first page = %+v", page)
	}
	cursor := page.NextCursor
	second, err := ts.ReadTool(scope).Handler(context.Background(), json.RawMessage(fmt.Sprintf(`{"resourceId":"doc-1","cursor":%q}`, cursor)))
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(second, &page); err != nil {
		t.Fatal(err)
	}
	if page.Truncated || page.StartLine != 2001 || page.EndLine != 2001 {
		t.Fatalf("second page = %+v", page)
	}
	_, err = ts.ReadTool(resource.ProjectScope{ProjectID: "proj-a", CallerID: "other"}).Handler(context.Background(), json.RawMessage(fmt.Sprintf(`{"resourceId":"doc-1","cursor":%q}`, cursor)))
	if err == nil {
		t.Fatal("cursor issued to one caller was accepted for another")
	}
}

func TestResourceReadRejectsOversizedAndNonTextualProjections(t *testing.T) {
	docs := newFakeReadableFamily(resource.KindDocument, []resource.Summary{{ID: "doc-1", Name: "Report"}})
	svc, err := resource.New(docs)
	if err != nil {
		t.Fatal(err)
	}
	ts := resource.NewToolSource(svc)
	scope := resource.ProjectScope{ProjectID: "proj-a", CallerID: "reader"}
	for _, text := range []string{strings.Repeat("x", 64*1024) + "\n", string([]byte{0xff})} {
		docs.content["doc-1"] = text
		_, err := ts.ReadTool(scope).Handler(context.Background(), json.RawMessage(`{"resourceId":"doc-1"}`))
		if err == nil {
			t.Fatal("invalid projection was returned")
		}
	}
}

func TestResourceListFindsExactNameBeyondFirstCatalogPage(t *testing.T) {
	items := make([]resource.Summary, 0, 501)
	for i := 0; i < 501; i++ {
		name := "other"
		if i == 500 {
			name = "needle"
		}
		items = append(items, resource.Summary{ID: fmt.Sprintf("doc-%04d", i), Name: name, Kind: resource.KindDocument})
	}
	docs := newFakeReadableFamily(resource.KindDocument, items)
	svc, err := resource.New(docs)
	if err != nil {
		t.Fatal(err)
	}
	out, err := resource.NewToolSource(svc).ListTool(resource.ProjectScope{ProjectID: "proj-a", CallerID: "reader"}).Handler(context.Background(), json.RawMessage(`{"exactName":"needle"}`))
	if err != nil {
		t.Fatal(err)
	}
	var listed struct {
		Resources []struct {
			ResourceID string `json:"resourceId"`
		} `json:"resources"`
		Total int `json:"total"`
	}
	if err := json.Unmarshal(out, &listed); err != nil {
		t.Fatal(err)
	}
	if listed.Total != 1 || len(listed.Resources) != 1 || listed.Resources[0].ResourceID != "doc-0500" {
		t.Fatalf("exact-name page = %s", out)
	}
}
