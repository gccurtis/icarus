package resource

import (
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	resourcecap "github.com/gccurtis/taurus-omega/core/capability/resource"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

// ResourceGenerator populates a freshly created resource from a prompt, returning
// the durable task id doing the work. The composition root supplies it over the
// agent Action runner, so the resource handler never imports agent or persona.
type ResourceGenerator interface {
	Generate(projectID, requesterID, documentID, prompt string) (taskID string, err error)
}

// maxGeneratedNameLen bounds a resource name derived from a prompt.
const maxGeneratedNameLen = 80

// maxGeneratePromptLen bounds the prompt so the composed Action objective stays
// well under the agent task-text cap — otherwise a huge prompt would create the
// resource and then fail to start its populating Action, orphaning an empty doc.
const maxGeneratePromptLen = 4000

// Generate implements "Create with AI": it creates a resource in the selected
// project through the canonical family owner, then kicks off an agent Action to
// populate it. The resource and the populating task id are returned immediately;
// the client polls the task for completion. Today only documents are generatable.
func (h Handlers) Generate(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errorResponse(http.StatusForbidden, "read access cannot generate resources")
	}
	if h.generator == nil {
		return errorResponse(http.StatusNotImplemented, "resource generation is not configured")
	}
	var in struct {
		Kind   resourcecap.Kind `json:"kind"`
		Prompt string           `json:"prompt"`
		Name   string           `json:"name"`
	}
	if err := req.Bind(&in); err != nil {
		return errorResponse(http.StatusBadRequest, "invalid JSON body")
	}
	if in.Kind == "" {
		in.Kind = resourcecap.KindDocument
	}
	if in.Kind != resourcecap.KindDocument {
		return errorResponse(http.StatusBadRequest, "only documents can be generated today")
	}
	if strings.TrimSpace(in.Prompt) == "" {
		return errorResponse(http.StatusBadRequest, "a prompt is required")
	}
	if len(in.Prompt) > maxGeneratePromptLen {
		return errorResponse(http.StatusBadRequest, "prompt is too long")
	}

	name := strings.TrimSpace(in.Name)
	if name == "" {
		name = deriveName(in.Prompt)
	}
	summary, err := h.resources.Create(ctx.Project.ID, actor(ctx), in.Kind, name)
	if response := mutationError(err); response != nil {
		return *response
	}
	taskID, err := h.generator.Generate(ctx.Project.ID, ctx.User.ID, summary.ID, in.Prompt)
	if err != nil {
		// The resource exists; report the failure but surface the resource so the
		// client can retry population rather than orphan it.
		return endpoint.Response{Status: http.StatusBadGateway, Body: map[string]any{
			"error": "resource created but generation could not start", "resource": summaryView(summary),
		}}
	}
	return endpoint.Response{Status: http.StatusCreated, Body: map[string]any{
		"resource": summaryView(summary), "taskId": taskID,
	}}
}

// deriveName turns a prompt into a bounded resource name: its first line,
// trimmed to a reasonable length on a word boundary.
func deriveName(prompt string) string {
	name := strings.TrimSpace(prompt)
	if i := strings.IndexAny(name, "\r\n"); i >= 0 {
		name = strings.TrimSpace(name[:i])
	}
	if len(name) <= maxGeneratedNameLen {
		return name
	}
	// Truncate on a rune boundary (never mid-rune) and prefer a word boundary.
	trimmed := name[:maxGeneratedNameLen]
	for len(trimmed) > 0 && !utf8.RuneStart(trimmed[len(trimmed)-1]) {
		trimmed = trimmed[:len(trimmed)-1]
	}
	if sp := strings.LastIndex(trimmed, " "); sp > 0 {
		trimmed = trimmed[:sp]
	}
	return strings.TrimSpace(trimmed) + "…"
}
