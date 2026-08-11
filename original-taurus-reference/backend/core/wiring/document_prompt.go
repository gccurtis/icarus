// The three ports a document prompt block resolves through.
//
// Resolving a prompt block reaches intelligence (plan + synthesize), knowledge
// (retrieve) and persona (instructions). Each is bound here by a private
// adapter, so the document capability imports none of them.
package wiring

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/capability/persona"
)

// documentPromptModel adapts the intelligence service to the document
// PromptModel port: the plan and synthesize steps are structured reasoning calls
// under their own configured casts, so document never imports intelligence.
type documentPromptModel struct {
	intel     *intelligence.Intelligence
	planCast  intelligence.Cast
	synthCast intelligence.Cast
}

func (m documentPromptModel) Plan(ctx context.Context, messages []document.PromptMessage, schema json.RawMessage) (json.RawMessage, document.Usage, error) {
	return m.reason(ctx, m.planCast, messages, schema)
}

func (m documentPromptModel) Synthesize(ctx context.Context, messages []document.PromptMessage, schema json.RawMessage) (json.RawMessage, document.Usage, error) {
	return m.reason(ctx, m.synthCast, messages, schema)
}

func (m documentPromptModel) reason(ctx context.Context, cast intelligence.Cast, messages []document.PromptMessage, schema json.RawMessage) (json.RawMessage, document.Usage, error) {
	msgs := make([]intelligence.Message, len(messages))
	for i, msg := range messages {
		msgs[i] = intelligence.Message{Role: msg.Role, Content: msg.Content}
	}
	res, err := m.intel.ReasonJSON(ctx, intelligence.ReasonRequest{Cast: cast, Messages: msgs}, schema)
	if err != nil {
		return nil, document.Usage{}, err
	}
	return res.JSON, document.Usage{PromptTokens: res.Usage.PromptTokens, TotalTokens: res.Usage.TotalTokens}, nil
}

// documentRetriever adapts the knowledge lattice to the document Retriever port,
// mapping grounded regions to the evidence spans a prompt block records.
type documentRetriever struct {
	know *knowledge.Knowledge
}

func (r documentRetriever) Retrieve(ctx context.Context, projectID string, queries []string, topK int) ([]document.EvidenceSpan, document.Usage, error) {
	res, err := r.know.RetrieveMany(ctx, projectID, queries, topK)
	if err != nil {
		return nil, document.Usage{}, err
	}
	spans := make([]document.EvidenceSpan, 0, len(res.Regions))
	for _, rg := range res.Regions {
		spans = append(spans, document.EvidenceSpan{
			SourceType: rg.SourceType, SourceID: rg.SourceID,
			Start: rg.Start, End: rg.End, Text: rg.Text,
			Relevance: rg.Relevance, Revision: rg.IndexedRevision,
			GenerationID: rg.GenerationID, SourceHash: rg.SourceHash,
			WindowIDs: append([]string(nil), rg.WindowIDs...),
		})
	}
	return spans, document.Usage{PromptTokens: res.Usage.PromptTokens, TotalTokens: res.Usage.TotalTokens}, nil
}

func (r documentRetriever) RetrieveScoped(ctx context.Context, projectID string, queries []string, topK int, allow []document.ScopeOrigin) ([]document.EvidenceSpan, document.Usage, error) {
	origins := make([]knowledge.Origin, len(allow))
	for i, o := range allow {
		// A document ScopeOrigin.Kind maps 1:1 to a knowledge sourceType
		// (document/connector), so the allow-set restricts retrieval to exactly
		// those sources.
		origins[i] = knowledge.Origin{SourceType: o.Kind, SourceID: o.ID}
	}
	res, err := r.know.RetrieveScopedMany(ctx, projectID, queries, topK, origins)
	if err != nil {
		return nil, document.Usage{}, err
	}
	spans := make([]document.EvidenceSpan, 0, len(res.Regions))
	for _, rg := range res.Regions {
		spans = append(spans, document.EvidenceSpan{
			SourceType: rg.SourceType, SourceID: rg.SourceID,
			Start: rg.Start, End: rg.End, Text: rg.Text,
			Relevance: rg.Relevance, Revision: rg.IndexedRevision,
			GenerationID: rg.GenerationID, SourceHash: rg.SourceHash,
			WindowIDs: append([]string(nil), rg.WindowIDs...),
		})
	}
	return spans, document.Usage{PromptTokens: res.Usage.PromptTokens, TotalTokens: res.Usage.TotalTokens}, nil
}

func (r documentRetriever) ChangedSince(_ context.Context, projectID string, since time.Time) (bool, error) {
	return r.know.ChangedSince(projectID, since)
}

// documentPersonaResolver adapts the persona service to the document
// PersonaResolver port: it resolves a prompt block's persona selection to a
// snapshot and composes its instruction text the same way the agent runner does,
// so a persona shapes a prompt-block resolution exactly as it shapes a chat turn.
type documentPersonaResolver struct {
	personas *persona.Personas
}

func (r documentPersonaResolver) PersonaInstructions(projectID string, ref document.PersonaRef) (string, error) {
	snap, err := r.personas.Resolve(persona.Scope{ProjectID: projectID}, persona.Selection{ID: ref.ID, Version: ref.Version})
	if err != nil {
		return "", err
	}
	parts := []string{snap.Instructions}
	if strings.TrimSpace(snap.Focus) != "" {
		parts = append(parts, "Focus: "+snap.Focus)
	}
	if strings.TrimSpace(snap.DefaultVerification) != "" {
		parts = append(parts, "Default verification: "+snap.DefaultVerification)
	}
	if strings.TrimSpace(snap.OutputPreferences) != "" {
		parts = append(parts, "Output preferences: "+snap.OutputPreferences)
	}
	return strings.Join(parts, " "), nil
}
