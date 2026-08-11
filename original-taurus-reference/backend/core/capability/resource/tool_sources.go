package resource

import (
	"context"
	"encoding/json"

	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
)

const (
	listToolName    = "resource.list"
	listToolVersion = "v1"
	readToolName    = "resource.read"
	readToolVersion = "v1"

	maxListResources = 200
)

var (
	listToolInputSchema = json.RawMessage(`{
		"type":"object",
		"properties":{
			"kind":{"type":"string","enum":["document","connector","file","spreadsheet","slides","chat","general"]},
			"exactName":{"type":"string"},
			"cursor":{"type":"string"},
			"limit":{"type":"integer","minimum":1,"maximum":200}
		},
		"additionalProperties":false
	}`)
	listToolOutputSchema = json.RawMessage(`{
		"type":"object",
		"properties":{
			"resources":{"type":"array"},
			"total":{"type":"integer"},
			"nextCursor":{"type":"string"},
			"truncated":{"type":"boolean"}
		},
		"required":["resources","total","truncated"],
		"additionalProperties":false
	}`)
	readToolInputSchema = json.RawMessage(`{
		"type":"object",
		"properties":{
			"resourceId":{"type":"string","minLength":1},
			"name":{"type":"string","minLength":1},
			"kind":{"type":"string","enum":["document","connector","file","spreadsheet","slides","chat","general"]},
			"subpath":{"type":"string"},
			"projection":{"type":"string"},
			"startLine":{"type":"integer","minimum":1},
			"endLine":{"type":"integer","minimum":1},
			"cursor":{"type":"string"},
			"expectedVersion":{"type":"string"}
		},
		"anyOf":[
			{"required":["resourceId"]},
			{"required":["name"]}
		],
		"additionalProperties":false
	}`)
	readToolOutputSchema = json.RawMessage(`{
		"type":"object",
		"properties":{
			"resource":{"type":"object"},
			"locator":{"type":"object"},
			"version":{"type":"string"},
			"contentHash":{"type":"string"},
			"projection":{"type":"string"},
			"startLine":{"type":"integer"},
			"endLine":{"type":"integer"},
			"text":{"type":"string"},
			"regions":{"type":"array"},
			"truncated":{"type":"boolean"},
			"nextCursor":{"type":"string"},
			"provenance":{"type":"object"}
		},
		"required":["resource","locator","version","projection","startLine","endLine","text","regions","truncated","provenance"],
		"additionalProperties":false
	}`)
)

// ToolSource wraps a Resources catalog to produce model-callable tool bindings
// closed over a trusted ProjectScope.
type ToolSource struct {
	resources *Resources
}

// NewToolSource creates a ToolSource from a Resources catalog.
func NewToolSource(resources *Resources) *ToolSource {
	return &ToolSource{resources: resources}
}

// ListTool returns the binding for listing caller-visible resources.
func (ts *ToolSource) ListTool(scope ProjectScope) intelligence.ToolBinding {
	return intelligence.ToolBinding{
		Definition: intelligence.ToolDefinition{
			Name:    listToolName,
			Version: listToolVersion,
			Description: "List the Resources available in the current Project, optionally filtered by kind or exact name. " +
				"Each entry carries a resourceId and a name. Use this to discover what resources exist and to get a resourceId for resource.read. " +
				"It lists every resource the caller can see, regardless of whether it was indexed by Knowledge.",
			InputSchema:  listToolInputSchema,
			OutputSchema: listToolOutputSchema,
		},
		Handler: func(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
			if err := validToolScope(scope); err != nil {
				return nil, err
			}
			return ts.listTool(ctx, scope, raw)
		},
	}
}

// ReadTool returns the binding for reading a resource's exact current content.
func (ts *ToolSource) ReadTool(scope ProjectScope) intelligence.ToolBinding {
	return intelligence.ToolBinding{
		Definition: intelligence.ToolDefinition{
			Name:    readToolName,
			Version: readToolVersion,
			Description: "Read one Resource in the current Project exactly, identified by resourceId or by exact name plus optional kind. " +
				"Optionally limited to a line range (1-based, inclusive). " +
				"Returns the current content from the canonical origin, not from an indexed snapshot. " +
				"Use resource.list to discover resourceIds. Use knowledge.search to find relevant content; use resource.read to read it exactly.",
			InputSchema:  readToolInputSchema,
			OutputSchema: readToolOutputSchema,
		},
		Handler: func(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
			if err := validToolScope(scope); err != nil {
				return nil, err
			}
			return ts.readTool(ctx, scope, raw)
		},
	}
}

func validToolScope(scope ProjectScope) error {
	if scope.ProjectID == "" || scope.CallerID == "" {
		return &intelligence.ToolError{Code: "invalid_scope", Message: "a trusted Project and caller are required"}
	}
	return nil
}

type listToolInput struct {
	Kind      string `json:"kind"`
	ExactName string `json:"exactName"`
	Cursor    string `json:"cursor"`
	Limit     int    `json:"limit"`
}

type listedResourceJSON struct {
	ResourceID string `json:"resourceId"`
	Kind       string `json:"kind"`
	Name       string `json:"name"`
	Version    string `json:"version,omitempty"`
}

type listToolOutput struct {
	Resources  []listedResourceJSON `json:"resources"`
	Total      int                  `json:"total"`
	NextCursor string               `json:"nextCursor,omitempty"`
	Truncated  bool                 `json:"truncated"`
}

func (ts *ToolSource) listTool(ctx context.Context, scope ProjectScope, raw json.RawMessage) (json.RawMessage, error) {
	var input listToolInput
	if err := json.Unmarshal(raw, &input); err != nil {
		return nil, &intelligence.ToolError{Code: "invalid_arguments", Message: "input must match the tool schema"}
	}

	limit := input.Limit
	if limit <= 0 {
		limit = DefaultLimit
	}
	if limit > maxListResources {
		limit = maxListResources
	}
	if input.Kind != "" {
		if _, err := ParseKind(input.Kind); err != nil {
			return nil, &intelligence.ToolError{Code: "invalid_arguments", Message: "unknown resource kind: " + input.Kind}
		}
	}

	// Scan catalog pages until we have the complete caller-filtered result set.
	// The cursor we return is the last *matching* resource, never the end of an
	// unfiltered page, so an exact-name or kind filter cannot silently skip a
	// later match.
	cursor := input.Cursor
	var matches []Summary
	for {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		page, err := ts.resources.List(scope.ProjectID, PageRequest{Limit: MaxLimit, Cursor: cursor})
		if err != nil {
			return nil, err
		}
		accessible, err := ts.resources.FilterAccessible(scope.CallerID, page.Resources)
		if err != nil {
			return nil, err
		}
		for _, item := range accessible {
			if input.ExactName != "" && item.Name != input.ExactName {
				continue
			}
			if input.Kind != "" && string(item.Kind) != input.Kind {
				continue
			}
			matches = append(matches, item)
		}
		if page.NextCursor == "" {
			break
		}
		cursor = page.NextCursor
	}

	out := listToolOutput{Resources: make([]listedResourceJSON, 0, limit), Total: len(matches)}
	for i, s := range matches {
		if i == limit {
			out.Truncated = true
			out.NextCursor = encodeCursor(matches[i-1])
			break
		}
		out.Resources = append(out.Resources, listedResourceJSON{
			ResourceID: s.ID,
			Kind:       string(s.Kind),
			Name:       s.Name,
		})
	}
	return json.Marshal(out)
}

type readToolInput struct {
	ResourceID      string `json:"resourceId"`
	Name            string `json:"name"`
	Kind            string `json:"kind"`
	Subpath         string `json:"subpath"`
	Projection      string `json:"projection"`
	StartLine       int    `json:"startLine"`
	EndLine         int    `json:"endLine"`
	Cursor          string `json:"cursor"`
	ExpectedVersion string `json:"expectedVersion"`
}

type readToolOutput struct {
	Resource    ResourceSummaryJSON `json:"resource"`
	Locator     ResourceLocatorJSON `json:"locator"`
	Version     string              `json:"version"`
	ContentHash string              `json:"contentHash,omitempty"`
	Projection  string              `json:"projection"`
	StartLine   int                 `json:"startLine"`
	EndLine     int                 `json:"endLine"`
	Text        string              `json:"text"`
	Regions     []directReadRegion  `json:"regions"`
	Truncated   bool                `json:"truncated"`
	NextCursor  string              `json:"nextCursor,omitempty"`
	Provenance  ProvenanceJSON      `json:"provenance"`
}

// directReadRegion keeps Resource's direct-origin provenance consumable by the
// Agent evidence ledger. Start and End are one-based inclusive text-projection
// line numbers, distinct from Knowledge's indexed byte evidence.
type directReadRegion struct {
	SourceType string `json:"sourceType"`
	SourceID   string `json:"sourceId"`
	Start      int    `json:"start"`
	End        int    `json:"end"`
	Text       string `json:"text"`
}

type ResourceSummaryJSON struct {
	ID      string `json:"id"`
	Kind    string `json:"kind"`
	Name    string `json:"name"`
	Version string `json:"version,omitempty"`
}

type ResourceLocatorJSON struct {
	ResourceID string `json:"resourceId"`
	Kind       string `json:"kind"`
	Subpath    string `json:"subpath,omitempty"`
	Projection string `json:"projection,omitempty"`
}

type ProvenanceJSON struct {
	Origin string `json:"origin"`
}

func (ts *ToolSource) readTool(ctx context.Context, scope ProjectScope, raw json.RawMessage) (json.RawMessage, error) {
	var input readToolInput
	if err := json.Unmarshal(raw, &input); err != nil {
		return nil, &intelligence.ToolError{Code: "invalid_arguments", Message: "input must match the tool schema"}
	}

	selector := ResourceSelector{}
	if input.ResourceID != "" {
		selector.ID = input.ResourceID
	}
	if input.Name != "" {
		selector.Name = input.Name
	}
	if input.Kind != "" {
		kind, err := ParseKind(input.Kind)
		if err != nil {
			return nil, &intelligence.ToolError{Code: "invalid_arguments", Message: "unknown resource kind: " + input.Kind}
		}
		selector.Kind = kind
	}

	if selector.ID == "" && selector.Name == "" {
		return nil, &intelligence.ToolError{Code: "invalid_arguments", Message: "resourceId or name is required"}
	}

	req := ExactReadRequest{
		Selector:        selector,
		Subpath:         input.Subpath,
		Projection:      input.Projection,
		StartLine:       input.StartLine,
		EndLine:         input.EndLine,
		Cursor:          input.Cursor,
		ExpectedVersion: input.ExpectedVersion,
	}

	result, err := ts.resources.Read(ctx, scope, req)
	if err != nil {
		return nil, mapReadError(err)
	}

	out := readToolOutput{
		Resource: ResourceSummaryJSON{
			ID:      result.Resource.ID,
			Kind:    string(result.Resource.Kind),
			Name:    result.Resource.Name,
			Version: result.Version,
		},
		Locator: ResourceLocatorJSON{
			ResourceID: result.Locator.ResourceID,
			Kind:       string(result.Locator.Kind),
			Subpath:    result.Locator.Subpath,
			Projection: result.Locator.Projection,
		},
		Version:     result.Version,
		ContentHash: result.ContentHash,
		Projection:  result.Projection,
		StartLine:   result.StartLine,
		EndLine:     result.EndLine,
		Text:        result.Text,
		Regions:     []directReadRegion{directRegion(result)},
		Truncated:   result.Truncated,
		NextCursor:  result.NextCursor,
		Provenance:  ProvenanceJSON{Origin: "direct"},
	}
	return json.Marshal(out)
}

func directRegion(result ExactReadResult) directReadRegion {
	sourceID := result.Resource.ID
	if result.Resource.Kind == KindConnector && result.Locator.Subpath != "" {
		sourceID += "/" + result.Locator.Subpath
	}
	return directReadRegion{
		SourceType: string(result.Resource.Kind), SourceID: sourceID,
		Start: result.StartLine, End: result.EndLine, Text: result.Text,
	}
}

func mapReadError(err error) *intelligence.ToolError {
	switch {
	case err == nil:
		return nil
	case err == ErrNotFound:
		return &intelligence.ToolError{Code: "resource.not_found", Message: "no such resource in the current Project"}
	case err == ErrNameAmbiguous:
		return &intelligence.ToolError{Code: "resource.name_ambiguous", Message: "more than one resource matches that name; use resourceId instead"}
	case err == ErrAccessDenied:
		return &intelligence.ToolError{Code: "resource.access_denied", Message: "you do not have access to this resource"}
	case err == ErrTrashed:
		return &intelligence.ToolError{Code: "resource.trashed", Message: "this resource is in the trash"}
	case err == ErrInvalidSelector:
		return &intelligence.ToolError{Code: "resource.invalid_selector", Message: "resource selector is invalid"}
	case err == ErrProjectionUnsupported:
		return &intelligence.ToolError{Code: "resource.projection_unsupported", Message: "this resource does not support the requested projection"}
	case err == ErrContentNotTextual:
		return &intelligence.ToolError{Code: "resource.content_not_textual", Message: "this resource's content is not textual"}
	case err == ErrVersionChanged:
		return &intelligence.ToolError{Code: "resource.version_changed", Message: "the resource has changed since the expected version; re-read to get the current version"}
	case err == ErrOriginUnavailable:
		return &intelligence.ToolError{Code: "resource.origin_unavailable", Message: "the resource origin is temporarily unavailable"}
	case err == ErrOriginGone:
		return &intelligence.ToolError{Code: "resource.origin_gone", Message: "the resource origin no longer has this content"}
	case err == ErrReadLimitExceeded:
		return &intelligence.ToolError{Code: "resource.read_limit_exceeded", Message: "read limit exceeded"}
	case err == ErrReadCursorInvalid:
		return &intelligence.ToolError{Code: "resource.cursor_invalid", Message: "the read cursor is invalid"}
	case err == ErrUnknownKind, err == ErrInvalidLimit, err == ErrInvalidCursor:
		return &intelligence.ToolError{Code: "resource.invalid_selector", Message: "resource selector is invalid"}
	default:
		return &intelligence.ToolError{Code: "resource.read_failed", Message: err.Error()}
	}
}
