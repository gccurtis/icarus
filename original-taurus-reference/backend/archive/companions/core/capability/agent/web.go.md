# web.go

Web-search source for the agent: the WebRetriever port, the WebResult type, and the web.search tool binding an Ask offers when it opts in and a retriever is configured. Web results are transient context — never cited as Project evidence. See repo conventions (AGENTS.md).

## Code breakdown

```go
package agent

import (
	"context"
	"encoding/json"

	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
)

// WebResult is one live-web hit: a title, its URL, and a short snippet. It is
// transient evidence for a single answer — never written to the Project lattice.
type WebResult struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Snippet string `json:"snippet"`
}

// WebRetriever fetches live-web results for a query, bounded by limit. The
// composition root supplies it over a web-search integration adapter; when no
// web provider is configured it is nil and the web source is simply unavailable.
type WebRetriever interface {
	SearchWeb(ctx context.Context, query string, limit int) ([]WebResult, error)
}

// Web-search tool descriptor. The tool name is versioned like the other agent
// tools so the model sees a stable contract.
const (
	webSearchToolName    = "web.search"
	webSearchToolVersion = "1"
	webSearchDefaultTopK = 5
	webSearchMaxTopK     = 10
)

var (
	webSearchInputSchema  = json.RawMessage(`{"type":"object","properties":{"query":{"type":"string","minLength":1},"topK":{"type":"integer","minimum":1,"maximum":10}},"required":["query"],"additionalProperties":false}`)
	webSearchOutputSchema = json.RawMessage(`{"type":"object","properties":{"results":{"type":"array","items":{"type":"object","properties":{"title":{"type":"string"},"url":{"type":"string"},"snippet":{"type":"string"}}}}},"required":["results"],"additionalProperties":false}`)
)

type webSearchInput struct {
	Query string `json:"query"`
	TopK  *int   `json:"topK"`
}

type webSearchOutput struct {
	Results []WebResult `json:"results"`
}

// webSearchTool builds the web.search tool binding over a WebRetriever. Its
// results are returned to the model as transient context; unlike knowledge
// search they carry no lattice locator, so they can inform an answer but can
// never be cited as Project evidence.
func webSearchTool(retriever WebRetriever) intelligence.ToolBinding {
	return intelligence.ToolBinding{
		Definition: intelligence.ToolDefinition{
			Name:         webSearchToolName,
			Version:      webSearchToolVersion,
			Description:  "Search the live web for background context. Results are transient and cannot be cited as Project evidence; use them only to inform the answer.",
			InputSchema:  webSearchInputSchema,
			OutputSchema: webSearchOutputSchema,
		},
		Handler: func(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
			var in webSearchInput
			if err := json.Unmarshal(raw, &in); err != nil || in.Query == "" {
				return nil, &intelligence.ToolError{Code: "invalid_input", Message: "web.search needs a non-empty query"}
			}
			topK := webSearchDefaultTopK
			if in.TopK != nil {
				topK = *in.TopK
			}
			if topK < 1 {
				topK = 1
			}
			if topK > webSearchMaxTopK {
				topK = webSearchMaxTopK
			}
			results, err := retriever.SearchWeb(ctx, in.Query, topK)
			if err != nil {
				return nil, &intelligence.ToolError{Code: "web_unavailable", Message: "web search failed"}
			}
			if results == nil {
				results = []WebResult{}
			}
			return json.Marshal(webSearchOutput{Results: results})
		},
	}
}
```
