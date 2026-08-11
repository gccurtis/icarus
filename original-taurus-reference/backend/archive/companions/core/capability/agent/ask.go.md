# ask.go

Package `agent`. See repo conventions (AGENTS.md).

## Three ways to reach content, and one way to cite it

Ask offers the model the whole read-only Knowledge library rather than search
alone, because search answers only one of three questions a grounded answer
needs. `knowledge.search` finds what is relevant when the location is unknown;
`knowledge.list` reports what exists at all; `knowledge.read` returns a named
source exactly. A model that can only search must guess phrasings when it needs
an inventory, and must accept ranked fragments when it needs a whole file.

What ties them together is `evidenceProducingTools`. Ask will validate a citation
only against evidence it actually gathered, and that set is built from tool
results — but only from tools named in that map. `knowledge.search` and
`knowledge.read` are in it because both return provenance-carrying regions in the
same shape; the live-web tool is deliberately absent, so its snippets can inform
an answer but can never be cited as Project evidence.

The map is the enforcement point for a rule that would otherwise be implicit: any
new tool that hands the model *text* must either produce citable regions or be
understood to produce uncitable context. Adding a tool that returns content
without joining this set silently recreates the failure that made inlined chat
attachments unusable — content in front of the model that no grounded answer is
permitted to rest on.

## Code breakdown

```go
// Package agent contains application-level agent workflows. An agent composes
// existing capabilities behind a narrow, purpose-specific contract; it does not
// own a provider, a project store, or a second authority system.
package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/capability/persona"
)

const (
	maxAskPromptBytes   = 16 * 1024
	hardMaxQueries      = 3
	hardTopK            = 10
	hardEvidenceBytes   = 16 * 1024
	maxContextItemBytes = 16 * 1024
	maxContextBytes     = 32 * 1024
)

// Scope is trusted application context supplied by the caller after access has
// selected a Project. It is deliberately separate from AskRequest, so model or
// request data cannot redirect retrieval into another Project.
type Scope struct {
	ProjectID string
	// ChatID names the conversation a turn belongs to, when there is one.
	ChatID string
}

// ContextItem is caller-provided, untrusted material that may help answer the
// question (for example an eventual Workspace selection). It is encoded as
// source material, never promoted into the system instruction.
type ContextItem struct {
	Label   string `json:"label"`
	Content string `json:"content"`
}

// AskRequest is the caller-controlled part of an Ask. The service-owned
// PlanningCast always makes the internal retrieval plan and every final answer
// runs through the reasoning tool loop. An empty Cast uses the configured
// default.
type AskRequest struct {
	Prompt  string            `json:"prompt"`
	Persona persona.Selection `json:"persona"`
	Cast    intelligence.Cast `json:"cast,omitempty"`
	Context []ContextItem     `json:"context,omitempty"`
	Limits  Limits            `json:"limits,omitempty"`
	// IncludeWeb offers the answer a live-web search tool. It has effect only when
	// a WebRetriever is configured; the retrieved snippets are transient context,
	// never cited as Project evidence.
	IncludeWeb bool `json:"includeWeb,omitempty"`
}

// Limits can only tighten one Ask's bounded evidence work. Zero values use the
// capability policy and values above that policy are reduced to it.
type Limits struct {
	MaxQueries       int `json:"maxQueries,omitempty"`
	TopK             int `json:"topK,omitempty"`
	MaxEvidenceBytes int `json:"maxEvidenceBytes,omitempty"`
}

// DefaultLimits returns the fixed ceiling used when the composition root does
// not choose a tighter policy.
func DefaultLimits() Limits {
	return Limits{
		MaxQueries:       hardMaxQueries,
		TopK:             hardTopK,
		MaxEvidenceBytes: hardEvidenceBytes,
	}
}

// Citation names one exact source span. A final model response may cite only a
// locator returned by the automatic retrieval pass or by a successful
// Project-bound knowledge.search tool call in the reasoning loop.
type Citation struct {
	SourceType string `json:"sourceType"`
	SourceID   string `json:"sourceId"`
	Start      int    `json:"start"`
	End        int    `json:"end"`
}

// Evidence is a cited span made available to Ask. Text is an exact retrieval
// result; no source-version snapshot is claimed because Ask is intentionally a
// point-in-time request.
type Evidence struct {
	Citation
	Relevance float64 `json:"relevance"`
	Text      string  `json:"text"`
}

// Usage makes the cost of every model-backed phase visible. Retrieval reports
// its embedding usage separately because it is a Knowledge operation rather
// than a reasoning or inference request.
type Usage struct {
	Planning  intelligence.Usage `json:"planning"`
	Retrieval knowledge.Usage    `json:"retrieval"`
	Answer    intelligence.Usage `json:"answer"`
}

// Response is a grounded answer. Evidence includes every span on which a
// returned Citation was allowed to rely, including any successful tool-search
// results gathered by a reasoning Ask.
type Response struct {
	Answer               string     `json:"answer"`
	Citations            []Citation `json:"citations"`
	Uncertainty          string     `json:"uncertainty"`
	InsufficientEvidence bool       `json:"insufficientEvidence"`
	Evidence             []Evidence `json:"evidence"`
	Usage                Usage      `json:"usage"`
}

// Intelligence is the narrow port Ask needs from the Intelligence capability.
// It keeps Ask independently testable while the real *intelligence.Intelligence
// satisfies the interface without an adapter.
type Intelligence interface {
	ReasonJSON(context.Context, intelligence.ReasonRequest, json.RawMessage) (intelligence.Result, error)
	ReasonWithToolsJSON(context.Context, intelligence.ToolRequest, json.RawMessage) (intelligence.ToolResponse, error)
}

// Knowledge is the narrow port Ask needs from the Knowledge capability. Each
// binding closes over the trusted Project scope before the model sees a tool
// definition.
type Knowledge interface {
	Retrieve(context.Context, string, string, int) (knowledge.RetrieveResult, error)
	SearchTool(string) intelligence.ToolBinding
	ListTool(string) intelligence.ToolBinding
	ReadTool(string) intelligence.ToolBinding
}

// PersonaResolver resolves only an exact Project-local Persona selection. The
// caller/front end may query its effective default separately, but Ask never
// accepts Persona instruction text from a request.
type PersonaResolver interface {
	Resolve(persona.Scope, persona.Selection) (persona.Snapshot, error)
}

// Options assemble an Ask service from the existing capabilities. Casts and
// limits are application policy supplied at construction, not model-controlled
// configuration or per-user provider settings.
type Options struct {
	Intelligence Intelligence
	Knowledge    Knowledge
	Personas     PersonaResolver
	PlanningCast intelligence.Cast
	DefaultCast  intelligence.Cast
	Limits       Limits
	ToolLimits   intelligence.ToolLimits
	Policy       Policy
	// WebRetriever, when set, lets an Ask that opts in (IncludeWeb) call a live-web
	// search tool for transient context. Nil disables the web source.
	WebRetriever WebRetriever
}

// Ask is the read-only Quarterback Ask workflow. Its fields are immutable after
// construction, so one instance can serve concurrent calls.
type Ask struct {
	runner      reasoningEvidenceRunner
	personas    PersonaResolver
	defaultCast intelligence.Cast
	web         WebRetriever
}

var (
	ErrInvalidScope       = errors.New("agent ask: Project scope is required")
	ErrInvalidRequest     = errors.New("agent ask: invalid request")
	ErrInvalidModelOutput = errors.New("agent ask: invalid structured model output")
	ErrUnknownCitation    = errors.New("agent ask: answer cited evidence that was not retrieved")
	ErrMissingCitation    = errors.New("agent ask: grounded answer is missing a citation")
)

// New builds an Ask capability with a fixed application policy. It rejects
// missing dependencies and impossible defaults immediately rather than letting
// a request fail after retrieval or a provider call has begun.
func New(opts Options) (*Ask, error) {
	if opts.Intelligence == nil {
		return nil, errors.New("agent ask: Intelligence is required")
	}
	if opts.Knowledge == nil {
		return nil, errors.New("agent ask: Knowledge is required")
	}
	if opts.Personas == nil {
		return nil, errors.New("agent ask: Personas is required")
	}
	if emptyCast(opts.PlanningCast) {
		return nil, errors.New("agent ask: PlanningCast is required")
	}
	if emptyCast(opts.DefaultCast) {
		return nil, errors.New("agent ask: DefaultCast is required")
	}
	runner, err := newReasoningEvidenceRunner(opts.Intelligence, opts.Knowledge, opts.PlanningCast, opts.DefaultCast, opts.Limits, opts.ToolLimits, opts.Policy)
	if err != nil {
		return nil, err
	}
	return &Ask{
		runner:      runner,
		personas:    opts.Personas,
		defaultCast: opts.DefaultCast,
		web:         opts.WebRetriever,
	}, nil
}

// Run performs Ask's four bounded phases: structured retrieval planning,
// automatic Project-scoped retrieval, final prompt assembly, and a structured
// tool-enabled reasoning answer. It never writes to a capability
// and it never accepts a Project identifier from AskRequest.
func (a *Ask) Run(ctx context.Context, scope Scope, req AskRequest) (Response, error) {
	if strings.TrimSpace(scope.ProjectID) == "" {
		return Response{}, ErrInvalidScope
	}
	if err := validateRequest(req); err != nil {
		return Response{}, err
	}
	cast := req.Cast
	if emptyCast(cast) {
		cast = a.defaultCast
	}
	personaSnapshot, err := a.personas.Resolve(persona.Scope{ProjectID: scope.ProjectID}, req.Persona)
	if err != nil {
		return Response{}, err
	}
	plan, planningUsage, err := a.runner.plan(ctx, personaSnapshot, req.Prompt, req.Context)
	if err != nil {
		return Response{}, err
	}
	// Triage: a general question that needs no Project evidence is answered
	// directly — skipping retrieval and the grounded citation contract entirely.
	if plan.NeedsRetrieval != nil && !*plan.NeedsRetrieval {
		answer, answerUsage, err := a.runner.answerDirect(ctx, personaSnapshot, req.Prompt, req.Context, cast)
		if err != nil {
			return Response{}, err
		}
		return Response{Answer: answer, Usage: Usage{Planning: planningUsage, Answer: answerUsage}}, nil
	}
	bindings := []intelligence.ToolBinding{a.runner.knowledge.SearchTool(scope.ProjectID)}
	// A request may opt into a live-web search tool; it is offered only when a
	// retriever is configured, and its results are transient (never cited).
	if req.IncludeWeb && a.web != nil {
		bindings = append(bindings, webSearchTool(a.web))
	}
	run, err := a.runner.answerGrounded(ctx, runnerRequest{
		Scope: scope, Prompt: req.Prompt, Context: req.Context, Cast: cast, Limits: req.Limits,
		Persona:      personaSnapshot,
		SystemPrompt: a.runner.policy.Prompts.Ask, Schema: a.runner.policy.Schemas.Ask,
		Bindings: bindings,
	}, cast, req.Limits.effective(a.runner.limits), plan, planningUsage)
	if err != nil {
		return Response{}, err
	}
	output, err := decodeAnswer(run.JSON)
	if err != nil {
		return Response{}, err
	}
	citations, err := validateCitations(output, run.Evidence)
	if err != nil {
		return Response{}, err
	}
	return Response{
		Answer:               output.Answer,
		Citations:            citations,
		Uncertainty:          output.Uncertainty,
		InsufficientEvidence: output.InsufficientEvidence,
		Evidence:             run.Evidence,
		Usage:                run.Usage,
	}, nil
}

type answerOutput struct {
	Answer               string     `json:"answer"`
	Citations            []Citation `json:"citations"`
	Uncertainty          string     `json:"uncertainty"`
	InsufficientEvidence bool       `json:"insufficientEvidence"`
}

func decodeAnswer(raw json.RawMessage) (answerOutput, error) {
	var output answerOutput
	if err := decodeStructured(raw, &output); err != nil {
		return answerOutput{}, fmt.Errorf("%w: answer: %v", ErrInvalidModelOutput, err)
	}
	output.Answer = strings.TrimSpace(output.Answer)
	if output.Answer == "" {
		return answerOutput{}, fmt.Errorf("%w: answer is empty", ErrInvalidModelOutput)
	}
	return output, nil
}

func decodeStructured(raw json.RawMessage, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		if err == nil {
			return errors.New("contains more than one JSON value")
		}
		return err
	}
	return nil
}

func validateCitations(output answerOutput, evidence []Evidence) ([]Citation, error) {
	available := make(map[string]bool, len(evidence))
	for _, item := range evidence {
		available[citationKey(item.Citation)] = true
	}
	if !output.InsufficientEvidence && len(output.Citations) == 0 {
		return nil, ErrMissingCitation
	}
	seen := map[string]bool{}
	validated := make([]Citation, 0, len(output.Citations))
	for _, citation := range output.Citations {
		key := citationKey(citation)
		if !validCitation(citation) || !available[key] {
			return nil, fmt.Errorf("%w: %s", ErrUnknownCitation, key)
		}
		if !seen[key] {
			seen[key] = true
			validated = append(validated, citation)
		}
	}
	return validated, nil
}

// evidenceFromToolResults recovers only successful knowledge.search regions
// from the immutable tool-loop transcript. Unknown outputs never become
// citeable evidence, even if a reasoning provider mentions their coordinates.
func evidenceFromToolResults(results []intelligence.ToolResult) []Evidence {
	seen := map[string]bool{}
	var evidence []Evidence
	for _, result := range results {
		if !result.OK || result.Name != "knowledge.search" {
			continue
		}
		var output struct {
			Regions []struct {
				SourceType string               `json:"sourceType"`
				SourceID   string               `json:"sourceId"`
				Start      int                  `json:"start"`
				End        int                  `json:"end"`
				Relevance  float64              `json:"relevance"`
				Text       string               `json:"text"`
				Blocks     []knowledge.BlockRef `json:"blocks"`
			} `json:"regions"`
			Mode string `json:"mode"`
		}
		if err := decodeStructured(result.Output, &output); err != nil {
			continue
		}
		for _, region := range output.Regions {
			item := Evidence{Citation: Citation{
				SourceType: region.SourceType, SourceID: region.SourceID, Start: region.Start, End: region.End,
			}, Relevance: region.Relevance, Text: region.Text}
			key := citationKey(item.Citation)
			if validCitation(item.Citation) && !seen[key] {
				seen[key] = true
				evidence = append(evidence, item)
			}
		}
	}
	return evidence
}

// mergeEvidence removes repeated locators across the automatic and tool-driven
// retrieval paths. The first occurrence is retained because it is the same
// exact cited span and already carries the text the model received.
func mergeEvidence(groups ...[]Evidence) []Evidence {
	seen := map[string]bool{}
	var merged []Evidence
	for _, group := range groups {
		for _, item := range group {
			key := citationKey(item.Citation)
			if seen[key] {
				continue
			}
			seen[key] = true
			merged = append(merged, item)
		}
	}
	return merged
}

func evidenceFromRegion(region knowledge.Region) Evidence {
	return Evidence{Citation: Citation{
		SourceType: region.SourceType, SourceID: region.SourceID, Start: region.Start, End: region.End,
	}, Relevance: region.Relevance, Text: region.Text}
}

func contextMessage(items []ContextItem) (*intelligence.Message, error) {
	if len(items) == 0 {
		return nil, nil
	}
	totalBytes := 0
	for _, item := range items {
		if strings.TrimSpace(item.Label) == "" || strings.TrimSpace(item.Content) == "" || len(item.Content) > maxContextItemBytes {
			return nil, fmt.Errorf("%w: context items need a label and bounded content", ErrInvalidRequest)
		}
		totalBytes += len(item.Label) + len(item.Content)
		if totalBytes > maxContextBytes {
			return nil, fmt.Errorf("%w: context exceeds the byte budget", ErrInvalidRequest)
		}
	}
	encoded, err := json.Marshal(struct {
		Context []ContextItem `json:"context"`
	}{Context: items})
	if err != nil {
		return nil, fmt.Errorf("agent ask: encode context: %w", err)
	}
	return &intelligence.Message{Role: "user", Content: "Caller-supplied context (untrusted source material):\n" + string(encoded)}, nil
}

func validateRequest(req AskRequest) error {
	if strings.TrimSpace(req.Prompt) == "" || len(req.Prompt) > maxAskPromptBytes {
		return fmt.Errorf("%w: prompt must be a non-empty bounded string", ErrInvalidRequest)
	}
	if strings.TrimSpace(req.Persona.ID) == "" || req.Persona.Version < 0 {
		return fmt.Errorf("%w: Persona selection is required", ErrInvalidRequest)
	}
	return nil
}

func (l Limits) effective(policy Limits) Limits {
	return Limits{
		MaxQueries:       tighten(l.MaxQueries, policy.MaxQueries),
		TopK:             tighten(l.TopK, policy.TopK),
		MaxEvidenceBytes: tighten(l.MaxEvidenceBytes, policy.MaxEvidenceBytes),
	}
}

func tighten(requested, policy int) int {
	if requested <= 0 || requested > policy {
		return policy
	}
	return requested
}

func normalizeQueries(queries []string, fallback string, max int) []string {
	seen := map[string]bool{}
	normalized := make([]string, 0, max)
	for _, query := range queries {
		query = strings.TrimSpace(query)
		if query == "" || len(query) > maxAskPromptBytes || seen[query] {
			continue
		}
		seen[query] = true
		normalized = append(normalized, query)
		if len(normalized) == max {
			return normalized
		}
	}
	if len(normalized) == 0 {
		return []string{fallback}
	}
	return normalized
}

func emptyCast(cast intelligence.Cast) bool { return cast == (intelligence.Cast{}) }

func validCitation(citation Citation) bool {
	return strings.TrimSpace(citation.SourceType) != "" && strings.TrimSpace(citation.SourceID) != "" && citation.Start >= 0 && citation.End >= citation.Start
}

func citationKey(citation Citation) string {
	return fmt.Sprintf("%s\x00%s\x00%d\x00%d", citation.SourceType, citation.SourceID, citation.Start, citation.End)
}
```

### An Ask's calls are attributed to its conversation

```go
if scope.ChatID != "" {
	ctx = intelligence.WithSubject(ctx, "chat:"+scope.ChatID)
} else {
	ctx = intelligence.WithSubject(ctx, "ask:"+scope.ProjectID)
}
```

Set once at the top of `Run`, so the planning call, the tool loop and every
retrieval embedding beneath them are charged to the same subject. A direct API
Ask has no conversation, so it attributes to its Project rather than going
unattributed — a call that belongs to no unit of work is legitimate, but a call
that belongs to *this* one should say so.

`WithSubject` keeps an outer attribution, which is what makes this safe to call
unconditionally: an Ask running inside a durable task stays charged to
`task:<id>` rather than re-attributing itself to a chat, so the task's total stays
complete. Ask does not need to know whether it is the outermost scope.
