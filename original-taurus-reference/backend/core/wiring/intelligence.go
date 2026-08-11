// Intelligence construction and the intelligence -> knowledge adapter.
//
// The intelligence service is built from configuration here, and the knowledge
// lattice reaches embeddings through a private adapter, so the knowledge
// capability never imports intelligence.
package wiring

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/integration/intelligence/openrouter"
	"github.com/gccurtis/taurus-omega/core/platform/config"
	"github.com/gccurtis/taurus-omega/core/platform/telemetry"
)

// buildIntelligence constructs the intelligence service from configuration: it
// instantiates each configured provider and assembles the per-endpoint-kind cast
// routes. A blank API key still yields a usable provider that fails calls with a
// clear "not configured" error, so the server starts with or without a key. A
// route naming an unknown provider, or an unrecognized provider, is fatal here.
func buildIntelligence(cfg config.Config) *intelligence.Intelligence {
	providers := make(map[string]intelligence.Provider, len(cfg.Intelligence.Providers))
	for name, p := range cfg.Intelligence.Providers {
		switch name {
		case "openrouter":
			timeout, _ := time.ParseDuration(p.Timeout)
			providers[name] = openrouter.New(p.APIKey, p.BaseURL, timeout)
		default:
			log.Fatalf("intelligence: unknown provider %q", name)
		}
	}

	routes := map[intelligence.Kind][]intelligence.Route{
		intelligence.KindReasoning: castRoutes(cfg.Intelligence.Casts.Reasoning),
		intelligence.KindInference: castRoutes(cfg.Intelligence.Casts.Inference),
		intelligence.KindEmbedding: castRoutes(cfg.Intelligence.Casts.Embedding),
	}

	intel, err := intelligence.New(intelligence.Options{
		Providers: providers, Routes: routes,
		Telemetry: intelligenceTelemetry{rec: telemetry.NewLogger()},
		Embedding: intelligence.EmbeddingOptions{
			MaxBatchInputs: cfg.Intelligence.Embedding.MaxBatchInputs,
			MaxWait:        parseDurationOrZero(cfg.Intelligence.Embedding.MaxWait),
			Backoff:        parseDurationOrZero(cfg.Intelligence.Embedding.Backoff),
		},
	})
	if err != nil {
		log.Fatalf("intelligence: %v", err)
	}
	return intel
}

// intelligenceTelemetry adapts the intelligence capability's measurement port to
// the central telemetry sink, so every provider call reports through the same
// contract as a connector sync rather than logging in its own shape.
type intelligenceTelemetry struct{ rec telemetry.Recorder }

func (t intelligenceTelemetry) RecordCall(e intelligence.CallEvent) {
	t.rec.RecordCall(telemetry.Call{
		Operation: e.Operation, Subject: e.Subject, Cast: e.Cast, Provider: e.Provider, Model: e.Model,
		Effort: e.Effort, Duration: e.Duration, ToolDuration: e.ToolDuration, Attempt: e.Attempt,
		Rounds: e.Rounds, Calls: e.Calls, Err: e.Err,
		Usage: telemetry.Usage{
			PromptTokens:     e.Usage.PromptTokens,
			CompletionTokens: e.Usage.CompletionTokens,
			ReasoningTokens:  e.Usage.ReasoningTokens,
			TotalTokens:      e.Usage.TotalTokens,
		},
	})
}

// knowledgeEmbedder adapts the intelligence embedding endpoint to the knowledge
// Embedder port, under one fixed cast, so the knowledge capability never imports
// the intelligence service.
type knowledgeEmbedder struct {
	intel *intelligence.Intelligence
	cast  intelligence.Cast
}

func (e knowledgeEmbedder) Embed(ctx context.Context, texts []string) (knowledge.Embedded, error) {
	res, err := e.intel.Embed(ctx, intelligence.EmbedRequest{Cast: e.cast, Inputs: texts})
	if err != nil {
		var partial *intelligence.PartialEmbeddingError
		if errors.As(err, &partial) {
			dims := 0
			if len(res.Vectors) > 0 {
				dims = len(res.Vectors[0])
			}
			return knowledge.Embedded{
					Vectors: res.Vectors,
					Usage: knowledge.Usage{
						PromptTokens: res.Usage.PromptTokens,
						TotalTokens:  res.Usage.TotalTokens,
						Requests:     res.Usage.Requests,
						CostUSD:      res.Usage.CostUSD,
					},
					Identity: knowledge.VectorIdentity{Provider: res.Provider, Model: res.Model, Dims: dims},
				}, &knowledge.PartialEmbeddingError{
					CompletedInputs: partial.CompletedInputs,
					Usage: knowledge.Usage{
						PromptTokens: partial.Usage.PromptTokens,
						TotalTokens:  partial.Usage.TotalTokens,
						Requests:     partial.Usage.Requests,
						CostUSD:      partial.Usage.CostUSD,
					},
					Cause: partial.Cause,
				}
		}
		return knowledge.Embedded{}, err
	}
	dims := 0
	if len(res.Vectors) > 0 {
		dims = len(res.Vectors[0])
	}
	return knowledge.Embedded{
		Vectors: res.Vectors,
		Usage: knowledge.Usage{
			PromptTokens: res.Usage.PromptTokens,
			TotalTokens:  res.Usage.TotalTokens,
			Requests:     res.Usage.Requests,
			CostUSD:      res.Usage.CostUSD,
		},
		Identity: knowledge.VectorIdentity{Provider: res.Provider, Model: res.Model, Dims: dims},
	}, nil
}

func (e knowledgeEmbedder) ConfiguredSpace(_ context.Context) (knowledge.EmbeddingSpace, error) {
	provider, model, err := e.intel.EmbeddingRoute(e.cast)
	if err != nil {
		return knowledge.EmbeddingSpace{}, err
	}
	// Dimensions are provider-discovered on the first response. Knowledge still
	// detects free provider/model drift before a no-op sync and verifies the full
	// dimension when it actually embeds.
	return knowledge.SpaceForIdentity(knowledge.VectorIdentity{Provider: provider, Model: model}), nil
}

func (e knowledgeEmbedder) EmbedInSpace(ctx context.Context, space knowledge.EmbeddingSpace, texts []string) (knowledge.Embedded, error) {
	res, err := e.intel.EmbedExact(ctx, space.Provider, space.Model, texts)
	if err != nil {
		return knowledge.Embedded{}, err
	}
	dims := 0
	if len(res.Vectors) > 0 {
		dims = len(res.Vectors[0])
	}
	return knowledge.Embedded{
		Vectors: res.Vectors,
		Usage: knowledge.Usage{
			PromptTokens: res.Usage.PromptTokens,
			TotalTokens:  res.Usage.TotalTokens,
			Requests:     res.Usage.Requests,
			CostUSD:      res.Usage.CostUSD,
		},
		Identity: knowledge.VectorIdentity{Provider: res.Provider, Model: res.Model, Dims: dims},
	}, nil
}
