package knowledge_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

func TestSearchToolIsBoundToItsProject(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 64}, smallWindows)
	ctx := context.Background()
	if _, err := k.Add(ctx, "project-one", knowledge.SourceTypeDocument, "one", "", strings.Repeat("orbit atlas guidance. ", 20), nil, 0); err != nil {
		t.Fatal(err)
	}
	if _, err := k.Add(ctx, "project-two", knowledge.SourceTypeDocument, "two", "", strings.Repeat("orbit private notes. ", 20), nil, 0); err != nil {
		t.Fatal(err)
	}
	tools, err := intelligence.NewToolSet(k.SearchTool("project-one"))
	if err != nil {
		t.Fatal(err)
	}

	result, err := tools.Execute(ctx, intelligence.ToolCall{
		ID:        "call-1",
		Name:      "knowledge.search",
		Version:   "v1",
		Arguments: json.RawMessage(`{"query":"orbit","projectId":"project-two"}`),
	}, intelligence.DefaultToolLimits())
	if err != nil {
		t.Fatal(err)
	}
	if result.OK || result.Error == nil || result.Error.Code != "invalid_arguments" {
		t.Fatalf("unexpected result for model-selected project: %+v", result)
	}
	result, err = tools.Execute(ctx, intelligence.ToolCall{
		ID:        "call-invalid-top-k",
		Name:      "knowledge.search",
		Version:   "v1",
		Arguments: json.RawMessage(`{"query":"orbit","topK":0}`),
	}, intelligence.DefaultToolLimits())
	if err != nil {
		t.Fatal(err)
	}
	if result.OK || result.Error == nil || result.Error.Code != "invalid_arguments" {
		t.Fatalf("unexpected result for invalid topK: %+v", result)
	}

	result, err = tools.Execute(ctx, intelligence.ToolCall{
		ID:        "call-2",
		Name:      "knowledge.search",
		Version:   "v1",
		Arguments: json.RawMessage(`{"query":"orbit"}`),
	}, intelligence.DefaultToolLimits())
	if err != nil {
		t.Fatal(err)
	}
	if !result.OK {
		t.Fatalf("search result = %+v", result)
	}
	var output struct {
		Regions []struct {
			SourceID string `json:"sourceId"`
		} `json:"regions"`
	}
	if err := json.Unmarshal(result.Output, &output); err != nil {
		t.Fatal(err)
	}
	if len(output.Regions) == 0 || output.Regions[0].SourceID != "one" {
		t.Errorf("regions = %+v, want only the bound Project's source", output.Regions)
	}
}

type testLocatorResolver struct{}

func (testLocatorResolver) ResolveResourceLocator(_ string, source knowledge.Source) (knowledge.ResourceLocator, bool) {
	if source.SourceType != knowledge.SourceTypeDocument {
		return knowledge.ResourceLocator{}, false
	}
	return knowledge.ResourceLocator{ResourceID: source.SourceID, Kind: "document", Projection: "text"}, true
}

func TestSearchToolReturnsResourceLocatorAndIndexedRevision(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 64}, smallWindows)
	k.UseResourceLocatorResolver(testLocatorResolver{})
	if _, err := k.Add(context.Background(), "project-one", knowledge.SourceTypeDocument, "doc-1", "Plan", strings.Repeat("quarterly assumptions. ", 20), nil, 7); err != nil {
		t.Fatal(err)
	}
	out, err := k.SearchTool("project-one").Handler(context.Background(), json.RawMessage(`{"query":"quarterly"}`))
	if err != nil {
		t.Fatal(err)
	}
	var result struct {
		Regions []struct {
			IndexedRevision int64 `json:"indexedRevision"`
			ResourceLocator *struct {
				ResourceID string `json:"resourceId"`
				Kind       string `json:"kind"`
				Projection string `json:"projection"`
			} `json:"resourceLocator"`
		} `json:"regions"`
	}
	if err := json.Unmarshal(out, &result); err != nil {
		t.Fatal(err)
	}
	if len(result.Regions) == 0 || result.Regions[0].IndexedRevision != 7 || result.Regions[0].ResourceLocator == nil {
		t.Fatalf("search result = %s", out)
	}
	locator := result.Regions[0].ResourceLocator
	if locator.ResourceID != "doc-1" || locator.Kind != "document" || locator.Projection != "text" {
		t.Fatalf("locator = %+v", locator)
	}
}
