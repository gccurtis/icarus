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
	// ChatID names the conversation a turn belongs to, when there is one. It is
	// trusted for the same reason ProjectID is — the caller resolved it from the
	// request path, not from model output — so a tool bound to it can never be
	// pointed at another conversation. Empty for work that has no chat.
	ChatID string
	// CallerID is the authenticated user making the request, passed through for
	// resource tool authorization. It is never model-supplied.
	CallerID string
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
// result from one generation-pinned indexed source revision; the immutable
// provenance fields below let downstream consumers retain that claim.
type Evidence struct {
	Citation
	Relevance       float64  `json:"relevance"`
	Text            string   `json:"text"`
	GenerationID    string   `json:"generationId,omitempty"`
	SourceHash      string   `json:"sourceHash,omitempty"`
	WindowIDs       []string `json:"windowIds,omitempty"`
	IndexedRevision int64    `json:"indexedRevision,omitempty"`
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
//
// Knowledge is deliberately only a search/evidence projection. Resource owns
// exact catalog listing and origin reads, so Knowledge cannot become a second
// resource registry.
type Knowledge interface {
	Retrieve(context.Context, string, string, int) (knowledge.RetrieveResult, error)
	SearchTool(string) intelligence.ToolBinding
}

// knowledgeTools is the model-facing Knowledge search binding for one Project.
func knowledgeTools(k Knowledge, projectID string) []intelligence.ToolBinding {
	return []intelligence.ToolBinding{k.SearchTool(projectID)}
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
	// Attachments, when set, lets a turn inside a chat enumerate that chat's
	// uploads — including ones whose content could not be indexed. Nil omits the
	// tool, which is correct for a deployment without chat attachments.
	Attachments Attachments
	// ResourceTools, when set, adds resource.list and resource.read bindings
	// so the model can list and read resources independently of Knowledge admission.
	ResourceTools ResourceToolSource
}

// ResourceToolSource provides model-callable resource.list and resource.read
// bindings closed over a trusted ProjectScope.
type ResourceToolSource interface {
	ListTool(scope ResourceScope) intelligence.ToolBinding
	ReadTool(scope ResourceScope) intelligence.ToolBinding
}

// resourceScope is the minimal caller context needed for resource tools.
type ResourceScope struct {
	ProjectID string
	CallerID  string
}

// Ask is the read-only Quarterback Ask workflow. Its fields are immutable after
// construction, so one instance can serve concurrent calls.
type Ask struct {
	runner      reasoningEvidenceRunner
	personas    PersonaResolver
	defaultCast intelligence.Cast
	web         WebRetriever
	attachments Attachments
	resTools    ResourceToolSource
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
		attachments: opts.Attachments,
		resTools:    opts.ResourceTools,
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
	// Attribute this Ask's calls to the conversation it belongs to, or to the
	// Project when it is a direct request. WithSubject keeps an outer attribution,
	// so an Ask running inside a task stays charged to that task.
	if scope.ChatID != "" {
		ctx = intelligence.WithSubject(ctx, "chat:"+scope.ChatID)
	} else {
		ctx = intelligence.WithSubject(ctx, "ask:"+scope.ProjectID)
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
	bindings := knowledgeTools(a.runner.knowledge, scope.ProjectID)
	// Resource tools let the model list and read resources independently of
	// Knowledge admission. They are added when a ResourceToolSource is configured.
	if a.resTools != nil {
		rs := ResourceScope{ProjectID: scope.ProjectID, CallerID: scope.CallerID}
		bindings = append(bindings, a.resTools.ListTool(rs), a.resTools.ReadTool(rs))
	}
	// A turn inside a chat can enumerate that chat's uploads, so a question about
	// "the attached file" is answerable by name rather than by guesswork — and an
	// attachment whose content could not be indexed is reported as unreadable
	// instead of appearing not to exist.
	if a.attachments != nil && scope.ChatID != "" {
		bindings = append(bindings, attachmentListTool(a.attachments, scope.ProjectID, scope.ChatID))
	}
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
		// Say how much evidence the answer had to work with. The two failures that
		// produce this error need opposite fixes — a model ignoring the citation
		// contract despite ample evidence, versus retrieval finding nothing and the
		// model answering from memory instead of reporting insufficient evidence —
		// and the bare error cannot tell them apart.
		return nil, fmt.Errorf("%w: %d evidence span(s) were available", ErrMissingCitation, len(evidence))
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

// evidenceFromToolResults recovers successful provenance-bearing regions from
// the immutable tool-loop transcript. Unknown outputs never become citeable
// evidence, even if a reasoning provider mentions their coordinates.
// evidenceProducingTools are the tools whose results carry provenance-bearing
// regions, and so may be cited. Knowledge returns indexed evidence while
// Resource returns direct-origin line evidence; their provenance classes remain
// distinct even though the citation ledger records the same compact shape.
var evidenceProducingTools = map[string]bool{
	"knowledge.search": true,
	"resource.read":    true,
}

func evidenceFromToolResults(results []intelligence.ToolResult) []Evidence {
	seen := map[string]bool{}
	var evidence []Evidence
	for _, result := range results {
		if !result.OK || !evidenceProducingTools[result.Name] {
			continue
		}
		var output struct {
			Regions []struct {
				SourceType      string               `json:"sourceType"`
				SourceID        string               `json:"sourceId"`
				Start           int                  `json:"start"`
				End             int                  `json:"end"`
				Relevance       float64              `json:"relevance"`
				Text            string               `json:"text"`
				Blocks          []knowledge.BlockRef `json:"blocks"`
				GenerationID    string               `json:"generationId"`
				SourceHash      string               `json:"sourceHash"`
				WindowIDs       []string             `json:"windowIds"`
				IndexedRevision int64                `json:"indexedRevision"`
			} `json:"regions"`
			Mode string `json:"mode"`
		}
		if err := decodeStructured(result.Output, &output); err != nil {
			continue
		}
		for _, region := range output.Regions {
			item := Evidence{Citation: Citation{
				SourceType: region.SourceType, SourceID: region.SourceID, Start: region.Start, End: region.End,
			}, Relevance: region.Relevance, Text: region.Text,
				GenerationID: region.GenerationID, SourceHash: region.SourceHash,
				WindowIDs:       append([]string(nil), region.WindowIDs...),
				IndexedRevision: region.IndexedRevision,
			}
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
	}, Relevance: region.Relevance, Text: region.Text,
		GenerationID: region.GenerationID, SourceHash: region.SourceHash,
		WindowIDs:       append([]string(nil), region.WindowIDs...),
		IndexedRevision: region.IndexedRevision,
	}
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
