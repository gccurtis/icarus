package knowledge

import (
	"bytes"
	"context"
	"encoding/json"
	"strings"

	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
)

const (
	searchToolName          = "knowledge.search"
	searchToolVersion       = "v1"
	maxSearchToolQueryBytes = 8 * 1024
	maxSearchToolTopK       = 20
)

var (
	searchToolInputSchema = json.RawMessage(`{
		"type":"object",
		"properties":{
			"query":{"type":"string","minLength":1},
			"topK":{"type":"integer","minimum":1,"maximum":20}
		},
		"required":["query"],
		"additionalProperties":false
	}`)
	searchToolOutputSchema = json.RawMessage(`{
		"type":"object",
		"properties":{
			"regions":{"type":"array"},
			"mode":{"type":"string"}
		},
		"required":["regions","mode"],
		"additionalProperties":false
	}`)
)

// SearchTool returns the predefined read-only Knowledge binding for one current
// Project. projectID is closed over by the handler rather than accepted from a
// model, so every call remains inside the surrounding service's Project scope.
func (k *Knowledge) SearchTool(projectID string) intelligence.ToolBinding {
	return intelligence.ToolBinding{
		Definition: intelligence.ToolDefinition{
			Name:         searchToolName,
			Version:      searchToolVersion,
			Description:  "Search admitted Knowledge sources in the current Project and return cited regions.",
			InputSchema:  searchToolInputSchema,
			OutputSchema: searchToolOutputSchema,
		},
		Handler: func(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
			return k.searchTool(ctx, projectID, raw)
		},
	}
}

type searchToolInput struct {
	Query string `json:"query"`
	TopK  *int   `json:"topK"`
}

type searchToolOutput struct {
	Regions []searchToolRegion `json:"regions"`
	Mode    string             `json:"mode"`
}

// searchTool validates the compact public input, retrieves only from its bound
// Project, and shapes provenance-carrying regions into JSON for the tool loop.
func (k *Knowledge) searchTool(ctx context.Context, projectID string, raw json.RawMessage) (json.RawMessage, error) {
	if projectID == "" {
		return nil, &intelligence.ToolError{Code: "invalid_scope", Message: "no Project is bound to this tool call"}
	}
	var input searchToolInput
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		return nil, &intelligence.ToolError{Code: "invalid_arguments", Message: "query and topK must match the tool schema"}
	}
	input.Query = strings.TrimSpace(input.Query)
	if input.Query == "" || len(input.Query) > maxSearchToolQueryBytes {
		return nil, &intelligence.ToolError{Code: "invalid_arguments", Message: "query must be a non-empty bounded string"}
	}
	topK := 0
	if input.TopK != nil {
		topK = *input.TopK
		if topK < 1 || topK > maxSearchToolTopK {
			return nil, &intelligence.ToolError{Code: "invalid_arguments", Message: "topK is outside the supported range"}
		}
	}

	retrieved, err := k.Retrieve(ctx, projectID, input.Query, topK)
	if err != nil {
		return nil, err
	}
	output := searchToolOutput{Mode: retrieved.Mode, Regions: make([]searchToolRegion, len(retrieved.Regions))}
	for i, region := range retrieved.Regions {
		output.Regions[i] = searchToolRegion{
			SourceType:      region.SourceType,
			SourceID:        region.SourceID,
			IndexedRevision: region.IndexedRevision,
			Start:           region.Start,
			End:             region.End,
			Relevance:       region.Relevance,
			Text:            region.Text,
			Blocks:          region.Blocks,
		}
		if k.locators != nil {
			if locator, ok := k.locators.ResolveResourceLocator(projectID, Source{
				SourceType: region.SourceType, SourceID: region.SourceID,
				Label: region.SourceLabel, Revision: region.IndexedRevision,
			}); ok {
				output.Regions[i].ResourceLocator = &locator
			}
		}
	}
	return json.Marshal(output)
}

// searchToolRegion is one cited retrieval span. It omits storage-local IDs and
// the bound Project because neither is a model-selectable capability.
type searchToolRegion struct {
	SourceType      string     `json:"sourceType"`
	SourceID        string     `json:"sourceId"`
	IndexedRevision int64      `json:"indexedRevision"`
	Start           int        `json:"start"`
	End             int        `json:"end"`
	Relevance       float64    `json:"relevance"`
	Text            string     `json:"text"`
	Blocks          []BlockRef `json:"blocks,omitempty"`
	// ResourceLocator, when present, lets the caller pass this result to
	// resource.read for exact current content. It is the Knowledge-indexed
	// revision — the resource may have changed since indexing.
	ResourceLocator *ResourceLocator `json:"resourceLocator,omitempty"`
}

// ResourceLocator is a stable pointer to a resource, returned by Knowledge
// search so the model can pass it to resource.read. It carries the revision
// that was indexed; the current resource revision may differ.
type ResourceLocator struct {
	ResourceID string `json:"resourceId"`
	Kind       string `json:"kind"`
	Subpath    string `json:"subpath,omitempty"`
	Projection string `json:"projection,omitempty"`
}

// ResourceLocatorResolver is the narrow composition seam that maps a
// Knowledge origin to the canonical Resource it can lead a caller to. Returning
// false is honest for evidence (such as an old attachment) that has no current
// readable Resource; a locator never authorizes the later read.
type ResourceLocatorResolver interface {
	ResolveResourceLocator(projectID string, source Source) (ResourceLocator, bool)
}
